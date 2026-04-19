import { Queue, QueuePersonStatus } from '@systems/BookingSystem/interfaces/queue.interface';
import { BookingStatus } from '@systems/BookingSystem/interfaces/booking.interface';
import queueModel from '@systems/BookingSystem/models/queue.model';
import bookingModel from '@systems/BookingSystem/models/booking.model';
import agentModel from '@systems/UserManager/models/agent.model';
import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { AddToQueueDto, UpdateQueuePersonDto, ReorderQueuePersonDto } from '@systems/BookingSystem/dtos/queue.dto';
import SocketService from '@systems/NotificationSystem/services/socket.service';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import QueueCronService from '@systems/BookingSystem/services/queueCron.service';
import {
  getStartOfToday,
  removeAndRebalance,
  validateStatusTransition,
  finalizeBooking,
  populateBookingForNotify,
} from '@systems/BookingSystem/services/queue.helpers';

/** Populate fields for queue agent info */
const QUEUE_POPULATE = {
  AGENT: 'agentName profileImage coverImage',
  BOOKING: 'totalDuration totalPrice loungeServiceIds status bookingDate notes visitorName',
  CLIENT: 'firstName lastName email profileImage coverImage',
} as const;

class QueueService {
  private queues = queueModel;
  private bookings = bookingModel;
  private agents = agentModel;
  private socketService = SocketService.getInstance();
  private notificationService = NotificationService.getInstance();
  private cronService = new QueueCronService();

  // ─── Shared internal helpers ──────────────────────────────────────

  /** Apply the standard populate chain for fully-populated queue responses. */
  private populateQueue(query: any): any {
    return query
      .populate('agentId', QUEUE_POPULATE.AGENT)
      .populate('persons.bookingId', QUEUE_POPULATE.BOOKING)
      .populate('persons.clientId', QUEUE_POPULATE.CLIENT);
  }

  /** Find the queue for a given agent on a given date (defaults to today). */
  private async findQueueOrThrow(agentId: string, date?: Date): Promise<any> {
    const queue = await this.queues.findOne({ agentId, date: date || getStartOfToday() });
    if (!queue) throw new NotFoundException('Queue not found', 'QUEUE_NOT_FOUND');
    return queue;
  }

  /** Find a person inside a queue by bookingId, or throw. */
  private findPersonOrThrow(queue: any, bookingId: string): any {
    const person = queue.persons.find((p: any) => p.bookingId.toString() === bookingId);
    if (!person) throw new NotFoundException('Booking not found in this queue', 'PERSON_NOT_IN_QUEUE');
    return person;
  }

  /** Save queue, re-fetch populated, emit WebSocket updates, and return. */
  private async saveAndEmit(agentId: string, queue: any, date?: Date): Promise<Queue> {
    await queue.save();
    return this.fetchAndEmit(agentId, date);
  }

  /** Re-fetch a populated queue and emit WebSocket updates. */
  private async fetchAndEmit(agentId: string, date?: Date): Promise<Queue> {
    const populated = await this.getQueueByAgent(agentId, date);
    await this.emitQueueUpdate(agentId, populated);
    return populated;
  }

  private async emitQueueUpdate(agentId: string, queue: any): Promise<void> {
    try {
      this.socketService.emitQueueUpdated(agentId, queue);
      const agent = await this.agents.findById(agentId);
      if (agent?.loungeId) {
        this.socketService.emitLoungeQueuesUpdated(agent.loungeId.toString(), queue);
      }
    } catch (err: any) {
      logger.warn(`Failed to emit queue WebSocket update: ${err.message}`);
    }
  }

  // ─── Public CRUD ──────────────────────────────────────────────────

  public async createQueue(agentId: string, date?: Date): Promise<Queue> {
    if (isEmpty(agentId)) throw new BadRequestException('Agent ID is required', 'MISSING_AGENT_ID');

    const agent = await this.agents.findById(agentId);
    if (!agent) throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');

    const queueDate = date || getStartOfToday();
    const queue = await this.queues.findOneAndUpdate(
      { agentId, date: queueDate },
      { $setOnInsert: { agentId, date: queueDate, persons: [] } },
      { upsert: true, new: true },
    );

    logger.info(`QueueService.createQueue: queue created/found for agent ${agentId} on ${queueDate.toISOString()}`);
    return queue;
  }

  public async getQueueByAgent(agentId: string, date?: Date): Promise<Queue> {
    if (isEmpty(agentId)) throw new BadRequestException('Agent ID is required', 'MISSING_AGENT_ID');

    const queue = await this.populateQueue(this.queues.findOne({ agentId, date: date || getStartOfToday() }));
    if (!queue) throw new NotFoundException('Queue not found for this agent on this date', 'QUEUE_NOT_FOUND');

    return queue;
  }

  public async getQueuesByLounge(loungeId: string, date?: Date): Promise<Queue[]> {
    if (isEmpty(loungeId)) throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');

    const agents = await this.agents.find({ loungeId, isBlocked: false });
    const agentIds = agents.map(a => a._id);

    return this.populateQueue(this.queues.find({ agentId: { $in: agentIds }, date: date || getStartOfToday() }));
  }

  // ─── Queue Person Operations ──────────────────────────────────────

  public async addPersonToQueue(agentId: string, data: AddToQueueDto): Promise<Queue> {
    if (isEmpty(data) || isEmpty(data.bookingId)) {
      throw new BadRequestException('Booking ID is required', 'MISSING_BOOKING_ID');
    }

    const booking = await this.bookings.findById(data.bookingId);
    if (!booking) throw new NotFoundException('Booking not found', 'BOOKING_NOT_FOUND');
    if (booking.status !== BookingStatus.IN_QUEUE) {
      throw new BadRequestException('Only bookings with inQueue status can be added to the queue', 'INVALID_BOOKING_STATUS');
    }

    const agentAssigned = booking.agentIds?.some(id => id.toString() === agentId);
    if (!agentAssigned) {
      throw new BadRequestException('Agent is not assigned to this booking', 'AGENT_NOT_ASSIGNED');
    }

    const queueDate = getStartOfToday();
    let queue = await this.queues.findOne({ agentId, date: queueDate });
    if (!queue) {
      queue = await this.queues.create({ agentId, date: queueDate, persons: [] });
    }

    if (queue.persons.some((p: any) => p.bookingId.toString() === data.bookingId)) {
      throw new BadRequestException('Booking is already in this queue', 'ALREADY_IN_QUEUE');
    }

    // Use the highest active position (ignoring completed/position-0) to determine next slot
    const maxActivePosition = queue.persons.reduce((max: number, p: any) => Math.max(max, p.position), 0);
    const position = data.position || maxActivePosition + 1;

    // Shift existing persons down if inserting at a specific position
    if (data.position && data.position <= maxActivePosition) {
      queue.persons.forEach((p: any) => {
        if (p.position >= position) p.position += 1;
      });
    }

    const clientId = (booking as any).clientId?.toString();
    const visitorName = (booking as any).visitorName;

    queue.persons.push({
      bookingId: data.bookingId,
      ...(clientId && { clientId }),
      ...(visitorName && { visitorName }),
      position,
      status: QueuePersonStatus.WAITING,
      joinedAt: new Date(),
      reminderSent: false,
    } as any);

    queue.persons.sort((a: any, b: any) => a.position - b.position);

    logger.info(`QueueService.addPersonToQueue: booking ${data.bookingId} added at position ${position}`);
    return this.saveAndEmit(agentId, queue, queueDate);
  }

  public async updatePersonStatus(agentId: string, bookingId: string, data: UpdateQueuePersonDto): Promise<Queue> {
    const queueDate = getStartOfToday();
    const queue = await this.findQueueOrThrow(agentId, queueDate);
    const person = this.findPersonOrThrow(queue, bookingId);

    validateStatusTransition(person.status, data.status);
    person.status = data.status;

    // When completed, set position to 0 and shift remaining persons up
    let shiftedPersons: any[] = [];
    if (data.status === QueuePersonStatus.COMPLETED) {
      const oldPosition = person.position;
      person.position = 0;

      shiftedPersons = queue.persons.filter((p: any) => p.bookingId.toString() !== bookingId && p.position > oldPosition);
      shiftedPersons.forEach((p: any) => {
        p.position -= 1;
      });
      queue.persons.sort((a: any, b: any) => a.position - b.position);
    }

    await queue.save();
    await this.handlePersonStatusSideEffects(bookingId, data.status, agentId);

    if (shiftedPersons.length > 0) {
      await this.notifyPositionChanges(shiftedPersons);
    }

    logger.info(`QueueService.updatePersonStatus: booking ${bookingId} → ${data.status}`);
    return this.fetchAndEmit(agentId, queueDate);
  }

  public async removePersonFromQueue(agentId: string, bookingId: string, markAbsent = false): Promise<Queue> {
    const queueDate = getStartOfToday();
    const queue = await this.findQueueOrThrow(agentId, queueDate);

    const personIndex = queue.persons.findIndex((p: any) => p.bookingId.toString() === bookingId);
    if (personIndex === -1) throw new NotFoundException('Booking not found in this queue', 'PERSON_NOT_IN_QUEUE');

    const removedPosition = removeAndRebalance(queue.persons, personIndex);

    if (markAbsent) {
      await finalizeBooking(bookingId, BookingStatus.ABSENT, { notify: 'absent' });
      logger.info(`QueueService.removePersonFromQueue: booking ${bookingId} marked as absent`);
    }

    logger.info(`QueueService.removePersonFromQueue: booking ${bookingId} removed from agent ${agentId} queue`);
    const updatedQueue = await this.saveAndEmit(agentId, queue, queueDate);

    await this.notifyShiftedPersons(queue.persons, removedPosition);
    return updatedQueue;
  }

  public async removePersonByBookingId(bookingId: string): Promise<void> {
    const queue = await this.queues.findOne({ 'persons.bookingId': bookingId });
    if (!queue) return;

    const personIndex = queue.persons.findIndex((p: any) => p.bookingId.toString() === bookingId);
    if (personIndex === -1) return;

    const removedPosition = removeAndRebalance(queue.persons, personIndex);
    const agentId = queue.agentId.toString();

    await this.saveAndEmit(agentId, queue, queue.date);
    logger.info(`QueueService.removePersonByBookingId: booking ${bookingId} removed from queue`);

    await this.notifyShiftedPersons(queue.persons, removedPosition);
  }

  public async reorderPerson(agentId: string, bookingId: string, data: ReorderQueuePersonDto): Promise<Queue> {
    if (isEmpty(agentId) || isEmpty(bookingId)) {
      throw new BadRequestException('Agent ID and Booking ID are required', 'MISSING_IDS');
    }

    const queueDate = getStartOfToday();
    const queue = await this.findQueueOrThrow(agentId, queueDate);
    const person = this.findPersonOrThrow(queue, bookingId);

    const oldPosition = person.position;
    const newPosition = Math.min(data.newPosition, queue.persons.length);

    if (oldPosition === newPosition) {
      return this.getQueueByAgent(agentId, queueDate);
    }

    // Shift affected persons
    const [lower, upper] = newPosition < oldPosition ? [newPosition, oldPosition] : [oldPosition, newPosition];

    queue.persons.forEach((p: any) => {
      if (newPosition < oldPosition) {
        if (p.position >= newPosition && p.position < oldPosition) p.position += 1;
      } else {
        if (p.position > oldPosition && p.position <= newPosition) p.position -= 1;
      }
    });

    person.position = newPosition;
    queue.persons.sort((a: any, b: any) => a.position - b.position);

    logger.info(`QueueService.reorderPerson: booking ${bookingId} moved ${oldPosition} → ${newPosition}`);
    const updatedQueue = await this.saveAndEmit(agentId, queue, queueDate);

    await this.notifyAffectedPersonsInRange(queue.persons, lower, upper);
    return updatedQueue;
  }

  // ─── Delegated to QueueCronService ────────────────────────────────

  public populateDailyQueues() {
    return this.cronService.populateDailyQueues();
  }
  public cleanupPastQueues() {
    return this.cronService.cleanupPastQueues();
  }
  public sendQueueReminders() {
    return this.cronService.sendQueueReminders();
  }
  public cleanupClosedLoungeQueues() {
    return this.cronService.cleanupClosedLoungeQueues();
  }

  // ─── Private Notification Helpers ─────────────────────────────────

  /** Notify WAITING persons in a position range (used after reorder). */
  private async notifyAffectedPersonsInRange(persons: any[], from: number, to: number): Promise<void> {
    const affected = persons.filter((p: any) => p.position >= from && p.position <= to);
    await this.notifyPositionChanges(affected);
  }

  /** Notify WAITING persons whose position shifted after a removal. */
  private async notifyShiftedPersons(persons: any[], fromPosition: number): Promise<void> {
    const shifted = persons.filter((p: any) => p.position >= fromPosition);
    if (shifted.length > 0) await this.notifyPositionChanges(shifted);
  }

  /**
   * Notify each WAITING person about their new queue position.
   * Shared by reorder, removal, and completion flows.
   */
  private async notifyPositionChanges(persons: any[]): Promise<void> {
    try {
      const waiting = persons.filter((p: any) => p.status === QueuePersonStatus.WAITING);
      await Promise.all(
        waiting.map(async (p: any) => {
          const booking = await populateBookingForNotify(p.bookingId.toString());
          if (booking) {
            this.notificationService.notifyQueuePositionChanged(booking, p.position);
          }
        }),
      );
    } catch (err: any) {
      logger.warn(`QueueService.notifyPositionChanges: ${err.message}`);
    }
  }

  /**
   * Handle booking status update + notifications triggered by a queue status change.
   *
   * - COMPLETED  → finalise booking as completed
   * - ABSENT     → notification only (booking stays inQueue; actual absent is set via remove with markAbsent)
   * - IN_SERVICE → notification only (booking stays inQueue)
   * - WAITING    → restore booking to inQueue + notification
   */
  private async handlePersonStatusSideEffects(bookingId: string, status: QueuePersonStatus, agentId: string): Promise<void> {
    try {
      switch (status) {
        case QueuePersonStatus.COMPLETED:
          await finalizeBooking(bookingId, BookingStatus.COMPLETED, { notify: 'completed', agentId });
          break;
        case QueuePersonStatus.ABSENT:
          // Booking stays inQueue — actual absent status is set via removePersonFromQueue(markAbsent).
          // Still notify the client so they know they were marked absent in the queue.
          await this.notifyWithoutStatusChange(bookingId, agentId, booking => this.notificationService.notifyBookingAbsent(booking));
          break;
        case QueuePersonStatus.IN_SERVICE:
          // Only notify — booking status remains inQueue
          await this.notifyWithoutStatusChange(bookingId, agentId, booking => this.notificationService.notifyQueueInService(booking));
          break;
        case QueuePersonStatus.WAITING:
          await this.updateBookingAndNotify(bookingId, BookingStatus.IN_QUEUE, agentId, booking =>
            this.notificationService.notifyBackInQueue(booking),
          );
          break;
      }
    } catch (err: any) {
      logger.warn(`QueueService.handlePersonStatusSideEffects: failed for booking ${bookingId}: ${err.message}`);
    }
  }

  /** Update booking status, emit socket update, and invoke a notification callback. */
  private async updateBookingAndNotify(
    bookingId: string,
    bookingStatus: BookingStatus,
    agentId: string,
    notify: (booking: any) => void,
  ): Promise<void> {
    await this.bookings.findByIdAndUpdate(bookingId, { status: bookingStatus });
    const booking = await populateBookingForNotify(bookingId);
    if (booking) {
      (booking as any).agentId = agentId;
      this.socketService.emitBookingUpdated(booking);
      notify(booking);
    }
  }

  /** Emit socket update and send notification WITHOUT changing booking status. */
  private async notifyWithoutStatusChange(bookingId: string, agentId: string, notify: (booking: any) => void): Promise<void> {
    const booking = await populateBookingForNotify(bookingId);
    if (booking) {
      (booking as any).agentId = agentId;
      notify(booking);
    }
  }
}

export default QueueService;
