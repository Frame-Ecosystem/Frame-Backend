import cron from 'node-cron';
import QueueService from '@services/queue/queue.service';
import BookingService from '@services/booking/booking.service';
import { logger } from '@utils/logger';

const queueService = new QueueService();
const bookingService = new BookingService();

/**
 * Wrap a cron handler with standard error handling and optional result logging.
 */
const cronHandler = (
  name: string,
  fn: () => Promise<{ processed?: number; sent?: number; errors: string[] }>,
  options: { logAlways?: boolean } = {},
) => {
  return async () => {
    try {
      const result = await fn();
      const count = result.processed ?? result.sent ?? 0;
      if (options.logAlways || count > 0) {
        logger.info(`CronJob [${name}]: ${count} items processed, ${result.errors.length} errors`);
      }
      if (result.errors.length > 0) {
        logger.warn(`CronJob [${name}] errors:`, result.errors);
      }
    } catch (error) {
      logger.error(`CronJob [${name}] failed:`, error);
    }
  };
};

/**
 * Initialize all cron jobs.
 * Call this after the app has started and the database is connected.
 */
export const initializeCronJobs = (): void => {
  // Daily at 00:01 — populate agent queues from confirmed bookings
  cron.schedule(
    '1 0 * * *',
    cronHandler('DailyQueuePopulation', () => queueService.populateDailyQueues(), { logAlways: true }),
  );

  // Daily at 00:05 — cleanup past queues (safety net)
  cron.schedule(
    '5 0 * * *',
    cronHandler('PastQueueCleanup', () => queueService.cleanupPastQueues(), { logAlways: true }),
  );

  // Every 10 minutes — send ~15-min queue reminders
  cron.schedule(
    '*/10 * * * *',
    cronHandler('QueueReminders', () => queueService.sendQueueReminders()),
  );

  // Every 30 minutes — cleanup queues for closed lounges
  cron.schedule(
    '*/30 * * * *',
    cronHandler('ClosedLoungeCleanup', () => queueService.cleanupClosedLoungeQueues()),
  );

  // Daily at 00:10 — complete stale inQueue bookings from past days
  cron.schedule(
    '10 0 * * *',
    cronHandler('StaleInQueueCleanup', () => bookingService.cleanupStaleInQueueBookings(), { logAlways: true }),
  );

  logger.info('CronJob: All cron jobs initialized (populate@00:01, cleanup@00:05, staleInQueue@00:10, reminders@*/10, close@*/30)');
};
