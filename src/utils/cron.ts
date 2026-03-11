import cron from 'node-cron';
import QueueService from '@services/queue.service';
import { logger } from '@utils/logger';

const queueService = new QueueService();

/**
 * Initialize all cron jobs.
 * Call this after the app has started and the database is connected.
 */
export const initializeCronJobs = (): void => {
  // Run daily at 00:01 — find confirmed bookings for today, set to inQueue, populate agent queues
  cron.schedule('1 0 * * *', async () => {
    logger.info('CronJob: Daily queue population started');
    try {
      const result = await queueService.populateDailyQueues();
      logger.info(`CronJob: Daily queue population completed — ${result.processed} bookings processed, ${result.errors.length} errors`);
      if (result.errors.length > 0) {
        logger.warn('CronJob: Daily queue population errors:', result.errors);
      }
    } catch (error) {
      logger.error('CronJob: Daily queue population failed:', error);
    }
  });

  logger.info('CronJob: Daily queue population scheduled at 00:01');
};
