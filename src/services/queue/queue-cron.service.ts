import { QueuePersonStatus } from '@interfaces/queue/queue.interface';
import { BookingStatus } from '@interfaces/booking/booking.interface';
import queueModel from '@models/queue/queue.model';
import bookingModel from '@models/booking/booking.model';
import agentModel from '@models/user/agent.model';
import userModel from '@models/user/users.model';
import { logger } from '@utils/logger';
import NotificationService from '@services/realtime/notification.service';
import { getStartOfToday, populateBookingForNotify, finalizeQueuePerson, finalizeBooking, resolveLoungeInfo } from '@services/queue/queue-helpers';

/** Shared result shape for all cron operations. */
export interface CronResult {
  processed: number;
  errors: string[];
}

/** Non-terminal statuses that still need cleanup. */
const ACTIVE_STATUSES = [QueuePersonStatus.WAITING, QueuePersonStatus.IN_SERVICE, QueuePersonStatus.ABSENT];
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

class QueueCronService {
  private notificationService = NotificationService.getInstance();

  // ─── Public Cron Jobs ───────────────────────────────────────────

  /** Populate queues for today from confirmed bookings. */
  public async populateDailyQueues(): Promise<CronResult> {
    const QueueService = (await import('@services/queue/queue.service')).default;
    const queueService = new QueueService();

    const todayStart = getStartOfToday();
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const bookings = await bookingModel.find({
      status: BookingStatus.CONFIRMED,
      bookingDate: { $gte: todayStart, $lt: todayEnd },
    });

    const result = this.emptyResult();

    for (const booking of bookings) {
      try {
        booking.status = BookingStatus.IN_QUEUE;
        await booking.save();

        for (const agentId of booking.agentIds ?? []) {
          try {
            await queueService.addPersonToQueue(agentId.toString(), { bookingId: (booking as any)._id.toString() });
          } catch (err) {
            result.errors.push(`Booking ${(booking as any)._id} → agent ${agentId}: ${err.message}`);
          }
        }

        result.processed++;
      } catch (err) {
        result.errors.push(`Booking ${(booking as any)._id}: ${err.message}`);
      }
    }

    logger.info(`QueueCron.populateDailyQueues: ${result.processed}/${bookings.length} bookings, ${result.errors.length} errors`);
    return result;
  }

  /** Finalize persons in past-date queues. */
  public async cleanupPastQueues(): Promise<CronResult> {
    const today = getStartOfToday();

    const pastQueues = await queueModel.find({
      date: { $lt: today },
      'persons.status': { $in: ACTIVE_STATUSES },
    });

    return this.cleanupQueues(pastQueues);
  }

  /** Send ~15-min reminders to waiting persons. */
  public async sendQueueReminders(): Promise<{ sent: number; errors: string[] }> {
    let sent = 0;
    const errors: string[] = [];
    const today = getStartOfToday();

    const queues = await queueModel.find({
      date: today,
      'persons.status': QueuePersonStatus.WAITING,
      'persons.reminderSent': false,
    });

    for (const queue of queues) {
      const cumulativeBase = await this.estimateInServiceRemaining(queue);
      const waitingPersons = queue.persons.filter(p => p.status === QueuePersonStatus.WAITING).sort((a, b) => a.position - b.position);

      const durationMap = await this.buildDurationMap(waitingPersons);
      let cumulativeWait = cumulativeBase;

      for (const person of waitingPersons) {
        const duration = durationMap.get(person.bookingId.toString()) ?? 0;

        if (person.reminderSent) {
          cumulativeWait += duration;
          continue;
        }

        if (cumulativeWait <= 15) {
          try {
            const booking = await populateBookingForNotify(person.bookingId.toString());
            if (booking) {
              await this.notificationService.notifyQueueReminder(booking, Math.max(1, Math.round(cumulativeWait)));
              person.reminderSent = true;
              sent++;
            }
          } catch (err) {
            errors.push(`Reminder for booking ${person.bookingId}: ${err.message}`);
          }
        }

        cumulativeWait += duration;
      }

      await queue.save();
    }

    return { sent, errors };
  }

  /** Cleanup queues for lounges that have closed today. */
  public async cleanupClosedLoungeQueues(): Promise<CronResult> {
    const now = new Date();
    const today = getStartOfToday();
    const todayDay = DAY_NAMES[now.getUTCDay()];

    const queues = await queueModel.find({
      date: today,
      'persons.status': { $in: ACTIVE_STATUSES },
    });

    const result = this.emptyResult();

    for (const queue of queues) {
      try {
        const closingTime = await this.getLoungeClosingTime(queue.agentId, todayDay, today);
        if (!closingTime || now < closingTime) continue;

        const agent = await agentModel.findById(queue.agentId);
        const lounge = agent?.loungeId ? await userModel.findById(agent.loungeId) : null;
        const loungeInfo = {
          loungeId: lounge?._id?.toString() ?? '',
          loungeTitle: lounge?.loungeTitle || 'the lounge',
        };

        const queueResult = await this.cleanupPersons(queue.persons, loungeInfo, queue.agentId?.toString());
        result.processed += queueResult.processed;
        result.errors.push(...queueResult.errors);

        await queue.save();
      } catch (err) {
        result.errors.push(`Queue ${(queue as any)._id}: ${err.message}`);
      }
    }

    return result;
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private emptyResult(): CronResult {
    return { processed: 0, errors: [] };
  }

  /** Shared cleanup loop for past queues. */
  private async cleanupQueues(queues: any[]): Promise<CronResult> {
    const result = this.emptyResult();

    for (const queue of queues) {
      const loungeInfo = await resolveLoungeInfo(queue.agentId);
      const queueResult = await this.cleanupPersons(queue.persons, loungeInfo, queue.agentId?.toString());
      result.processed += queueResult.processed;
      result.errors.push(...queueResult.errors);
      await queue.save();
    }

    return result;
  }

  /** Finalize all non-terminal persons in a queue. */
  private async cleanupPersons(persons: any[], loungeInfo: { loungeId: string; loungeTitle: string }, agentId?: string): Promise<CronResult> {
    const result = this.emptyResult();

    for (const person of persons) {
      try {
        if (await finalizeQueuePerson(person, loungeInfo, agentId)) result.processed++;
      } catch (err) {
        result.errors.push(`Booking ${person.bookingId}: ${err.message}`);
      }
    }

    // Safety net: cancel any bookings still stuck in inQueue after all persons were processed.
    // This guards against orphaned bookings (e.g. agent marked person absent without removing them).
    await this.finalizeOrphanedBookings(persons, loungeInfo, agentId);

    return result;
  }

  /** Cancel bookings that are still inQueue after their queue persons have been finalized. */
  private async finalizeOrphanedBookings(persons: any[], loungeInfo: { loungeId: string; loungeTitle: string }, agentId?: string): Promise<void> {
    const bookingIds = persons.map(p => p.bookingId).filter(Boolean);
    if (bookingIds.length === 0) return;

    const orphaned = await bookingModel
      .find({ _id: { $in: bookingIds }, status: BookingStatus.IN_QUEUE })
      .select('_id')
      .lean()
      .exec();

    for (const booking of orphaned) {
      try {
        await finalizeBooking((booking as any)._id.toString(), BookingStatus.CANCELLED, {
          cancelledBy: { idUser: loungeInfo.loungeId, cancelledByName: loungeInfo.loungeTitle },
          notify: 'autoCancelled',
          loungeTitle: loungeInfo.loungeTitle,
          agentId,
        });
        logger.info(`QueueCron: finalized orphaned inQueue booking ${(booking as any)._id}`);
      } catch (err) {
        logger.warn(`QueueCron: failed to finalize orphaned booking ${(booking as any)._id}: ${err.message}`);
      }
    }
  }

  /** Estimate remaining time (minutes) for the current in-service person. */
  private async estimateInServiceRemaining(queue: any): Promise<number> {
    const inServicePerson = queue.persons.find(p => p.status === QueuePersonStatus.IN_SERVICE);
    if (!inServicePerson) return 0;

    const booking = await bookingModel.findById(inServicePerson.bookingId).lean();
    return booking?.totalDuration ?? 0;
  }

  /** Batch-fetch durations for a list of persons. */
  private async buildDurationMap(persons: any[]): Promise<Map<string, number>> {
    const ids = persons.map(p => p.bookingId);
    const bookings = await bookingModel.find({ _id: { $in: ids } }).lean();
    const map = new Map<string, number>();
    for (const b of bookings) map.set((b as any)._id.toString(), b.totalDuration || 0);
    return map;
  }

  /** Get the lounge closing time for a given agent and day, or null if not determinable. */
  private async getLoungeClosingTime(agentId: any, day: string, today: Date): Promise<Date | null> {
    const agent = await agentModel.findById(agentId);
    if (!agent?.loungeId) return null;

    const lounge = await userModel.findById(agent.loungeId);
    const hours = (lounge?.openingHours as any)?.[day];
    if (!hours?.to) return null;

    const [h, m] = hours.to.split(':').map(Number);
    const closing = new Date(today);
    closing.setUTCHours(h, m, 0, 0);
    return closing;
  }
}

export default QueueCronService;
