import { BookingStatus } from '@systems/BookingSystem/interfaces/booking.interface';
import { QueuePersonStatus } from '@systems/BookingSystem/interfaces/queue.interface';
import bookingModel from '@systems/BookingSystem/models/booking.model';
import agentModel from '@systems/UserManager/models/agent.model';
import userModel from '@systems/UserManager/models/user.model';
import { logger } from '@utils/logger';
import SocketService from '@systems/NotificationSystem/services/socket.service';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { BadRequestException } from '@exceptions/HttpException';

/** Populate fields used when fetching bookings for notifications. */
const BOOKING_NOTIFY_POPULATE = {
  CLIENT: 'firstName lastName',
  LOUNGE: 'loungeTitle firstName lastName',
} as const;

/** Valid status transitions for queue persons. */
const STATUS_TRANSITIONS: Record<QueuePersonStatus, QueuePersonStatus[]> = {
  [QueuePersonStatus.WAITING]: [QueuePersonStatus.IN_SERVICE, QueuePersonStatus.ABSENT],
  [QueuePersonStatus.IN_SERVICE]: [QueuePersonStatus.COMPLETED, QueuePersonStatus.WAITING],
  [QueuePersonStatus.COMPLETED]: [],
  [QueuePersonStatus.ABSENT]: [QueuePersonStatus.WAITING],
};

// ─── Pure Helpers ───────────────────────────────────────────────

/** Get start of today (midnight, UTC). */
export function getStartOfToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

/**
 * Remove a person from the queue array by index, rebalance positions,
 * and return the removed position for downstream notifications.
 */
export function removeAndRebalance(persons: any[], personIndex: number): number {
  const removedPosition = persons[personIndex].position;
  persons.splice(personIndex, 1);
  for (const p of persons) {
    if (p.position > removedPosition) p.position -= 1;
  }
  return removedPosition;
}

/** Validate that a status transition is allowed, or throw. */
export function validateStatusTransition(current: QueuePersonStatus, next: QueuePersonStatus): void {
  if (!STATUS_TRANSITIONS[current].includes(next)) {
    throw new BadRequestException(`Cannot transition from '${current}' to '${next}'`, 'INVALID_STATUS_TRANSITION');
  }
}

// ─── DB Helpers ─────────────────────────────────────────────────

/** Fetch a booking with notification-ready populates. */
export function populateBookingForNotify(bookingId: string) {
  return bookingModel.findById(bookingId).populate('clientId', BOOKING_NOTIFY_POPULATE.CLIENT).populate('loungeId', BOOKING_NOTIFY_POPULATE.LOUNGE);
}

interface FinalizeOptions {
  cancelledBy?: { idUser: string; cancelledByName: string; note?: string };
  notify?: 'completed' | 'absent' | 'autoCancelled';
  loungeTitle?: string;
  agentId?: string;
}

/** Update a booking's status, emit a socket event, and optionally send a notification. */
export async function finalizeBooking(bookingId: string, status: BookingStatus, options: FinalizeOptions = {}): Promise<void> {
  try {
    const update: any = { status };
    if (options.cancelledBy) update.cancelledBy = options.cancelledBy;

    const booking = await bookingModel
      .findByIdAndUpdate(bookingId, update, { new: true })
      .populate('clientId', BOOKING_NOTIFY_POPULATE.CLIENT)
      .populate('loungeId', BOOKING_NOTIFY_POPULATE.LOUNGE);

    if (!booking) return;
    if (options.agentId) (booking as any).agentId = options.agentId;

    const socketService = SocketService.getInstance();
    const notificationService = NotificationService.getInstance();

    socketService.emitBookingUpdated(booking);

    switch (options.notify) {
      case 'completed':
        notificationService.notifyBookingCompleted(booking);
        break;
      case 'absent':
        notificationService.notifyBookingAbsent(booking);
        break;
      case 'autoCancelled':
        if (options.loungeTitle) notificationService.notifyQueueAutoCancelled(booking, options.loungeTitle);
        break;
    }
  } catch (err) {
    logger.warn(`QueueHelpers.finalizeBooking: failed for booking ${bookingId}: ${err.message}`);
  }
}

/**
 * Finalize a single queue person during cleanup (past queues or closed lounges).
 * Returns true if the person was processed, false if already terminal.
 */
export async function finalizeQueuePerson(person: any, loungeInfo: { loungeId: string; loungeTitle: string }, agentId?: string): Promise<boolean> {
  switch (person.status) {
    case QueuePersonStatus.WAITING:
      person.status = QueuePersonStatus.ABSENT;
      await finalizeBooking(person.bookingId, BookingStatus.CANCELLED, {
        cancelledBy: { idUser: loungeInfo.loungeId, cancelledByName: loungeInfo.loungeTitle },
        notify: 'autoCancelled',
        loungeTitle: loungeInfo.loungeTitle,
        agentId,
      });
      return true;

    case QueuePersonStatus.ABSENT: {
      // Only finalize if the booking is still inQueue.
      // Avoids overwriting a CANCELLED booking set by the WAITING → ABSENT cleanup path.
      const booking = await bookingModel.findById(person.bookingId).select('status').lean().exec();
      if (booking && booking.status === BookingStatus.IN_QUEUE) {
        await finalizeBooking(person.bookingId, BookingStatus.ABSENT, { notify: 'absent', agentId });
      }
      return true;
    }

    case QueuePersonStatus.IN_SERVICE:
      person.status = QueuePersonStatus.COMPLETED;
      await finalizeBooking(person.bookingId, BookingStatus.COMPLETED, { notify: 'completed', agentId });
      return true;

    default:
      return false;
  }
}

/** Resolve lounge info for an agent (used in cleanup notifications). */
export async function resolveLoungeInfo(agentId: any): Promise<{ loungeId: string; loungeTitle: string }> {
  const DEFAULT_INFO = { loungeId: '', loungeTitle: 'Lounge' };
  try {
    const agent = await agentModel.findById(agentId);
    if (!agent?.loungeId) return DEFAULT_INFO;

    const lounge = await userModel.findById(agent.loungeId);
    if (!lounge) return DEFAULT_INFO;

    return { loungeId: lounge._id.toString(), loungeTitle: lounge.loungeTitle || 'Lounge' };
  } catch (err) {
    logger.warn(`QueueHelpers.resolveLoungeInfo: could not resolve for agent ${agentId}: ${err.message}`);
    return DEFAULT_INFO;
  }
}
