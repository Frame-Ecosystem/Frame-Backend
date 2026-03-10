import { Queue, QueuePersonStatus } from '@interfaces/queue.interface';
import { BookingStatus } from '@interfaces/booking.interface';
import queueModel from '@models/queue.model';
import bookingModel from '@models/booking.model';
import agentModel from '@models/agent.model';
import userModel from '@models/users.model';
import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { AddToQueueDto, UpdateQueuePersonDto, ReorderQueuePersonDto } from '@dtos/queue.dto';
import SocketService from '@services/socket.service';
import NotificationService from '@services/notification.service';

/** Populate fields for queue agent info */
const QUEUE_POPULATE = {
  AGENT: 'agentName profileImage coverImage',
  BOOKING: 'totalDuration totalPrice loungeServiceIds status bookingDate notes',
  CLIENT: 'firstName lastName email profileImage coverImage',
} as const;

/** Populate fields used when fetching bookings for notifications */
const BOOKING_NOTIFY_POPULATE = {
  CLIENT: 'firstName lastName',
  LOUNGE: 'loungeTitle firstName lastName',
} as const;

class QueueService {
  public queues = queueModel;
  private bookings = bookingModel;
  private agents = agentModel;
  private users = userModel;
  private socketService = SocketService.getInstance();
  private notificationService = NotificationService.getInstance();

  /**
   * Emit queue update via WebSocket to agent and lounge rooms.
   */
  private async emitQueueUpdate(agentId: string, queue: any): Promise<void> {
    try {
      this.socketService.emitQueueUpdated(agentId, queue);
      // Also emit to lounge room
      const agent = await this.agents.findById(agentId);
      if (agent?.loungeId) {
        this.socketService.emitLoungeQueuesUpdated(agent.loungeId.toString(), queue);
      }
    } catch (err) {
      logger.warn(`Failed to emit queue WebSocket update: ${err.message}`);
    }
  }

  /**
   * Create an empty queue for an agent for a given date.
   * Called automatically when an agent is created or at daily reset.
   */
  public async createQueue(agentId: string, date?: Date): Promise<Queue> {
    try {
      if (isEmpty(agentId)) {
        throw new BadRequestException('Agent ID is required', 'MISSING_AGENT_ID');
      }

      const agent = await this.agents.findById(agentId);
      if (!agent) {
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      const queueDate = date || this.getStartOfToday();

      // Upsert: create if not exists, return existing if it does
      const queue = await this.queues.findOneAndUpdate(
        { agentId, date: queueDate },
        { $setOnInsert: { agentId, date: queueDate, persons: [] } },
        { upsert: true, new: true },
      );

      logger.info(`QueueService.createQueue: queue created/found for agent ${agentId} on ${queueDate.toISOString()}`);
      return queue;
    } catch (error) {
      logger.error('QueueService.createQueue: error creating queue', error);
      throw error;
    }
  }

  /**
   * Get an agent's queue for a specific date (defaults to today).
   * Populates booking and client details.
   */
  public async getQueueByAgent(agentId: string, date?: Date): Promise<Queue> {
    try {
      if (isEmpty(agentId)) {
        throw new BadRequestException('Agent ID is required', 'MISSING_AGENT_ID');
      }

      const queueDate = date || this.getStartOfToday();

      const queue = await this.queues
        .findOne({ agentId, date: queueDate })
        .populate('agentId', QUEUE_POPULATE.AGENT)
        .populate('persons.bookingId', QUEUE_POPULATE.BOOKING)
        .populate('persons.clientId', QUEUE_POPULATE.CLIENT);

      if (!queue) {
        throw new NotFoundException('Queue not found for this agent on this date', 'QUEUE_NOT_FOUND');
      }

      return queue;
    } catch (error) {
      logger.error('QueueService.getQueueByAgent: error fetching queue', error);
      throw error;
    }
  }

  /**
   * Get all queues for a lounge on a specific date (defaults to today).
   */
  public async getQueuesByLounge(loungeId: string, date?: Date): Promise<Queue[]> {
    try {
      if (isEmpty(loungeId)) {
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }

      const queueDate = date || this.getStartOfToday();

      // Find all agents belonging to this lounge
      const agents = await this.agents.find({ loungeId, isBlocked: false });
      const agentIds = agents.map(a => a._id);

      const queues = await this.queues
        .find({ agentId: { $in: agentIds }, date: queueDate })
        .populate('agentId', QUEUE_POPULATE.AGENT)
        .populate('persons.bookingId', QUEUE_POPULATE.BOOKING)
        .populate('persons.clientId', QUEUE_POPULATE.CLIENT);

      return queues;
    } catch (error) {
      logger.error('QueueService.getQueuesByLounge: error fetching lounge queues', error);
      throw error;
    }
  }

  /**
   * Add a booking to an agent's queue.
   * Validates the booking exists, is IN_QUEUE status, and the agent is assigned.
   */
  public async addPersonToQueue(agentId: string, data: AddToQueueDto): Promise<Queue> {
    try {
      if (isEmpty(data) || isEmpty(data.bookingId)) {
        throw new BadRequestException('Booking ID is required', 'MISSING_BOOKING_ID');
      }

      // Validate booking
      const booking = await this.bookings.findById(data.bookingId);
      if (!booking) {
        throw new NotFoundException('Booking not found', 'BOOKING_NOT_FOUND');
      }
      if (booking.status !== BookingStatus.IN_QUEUE) {
        throw new BadRequestException('Only bookings with inQueue status can be added to the queue', 'INVALID_BOOKING_STATUS');
      }

      // Validate agent is assigned to this booking
      const agentAssigned = booking.agentIds?.some(id => id.toString() === agentId);
      if (!agentAssigned) {
        throw new BadRequestException('Agent is not assigned to this booking', 'AGENT_NOT_ASSIGNED');
      }

      const queueDate = this.getStartOfToday();
      let queue = await this.queues.findOne({ agentId, date: queueDate });

      if (!queue) {
        queue = await this.queues.create({ agentId, date: queueDate, persons: [] });
      }

      // Check if booking is already in the queue
      const alreadyInQueue = queue.persons.some(p => p.bookingId.toString() === data.bookingId);
      if (alreadyInQueue) {
        throw new BadRequestException('Booking is already in this queue', 'ALREADY_IN_QUEUE');
      }

      // Determine position: use provided or append at end
      const position = data.position || queue.persons.length + 1;

      // If inserting at a specific position, shift others
      if (data.position && data.position <= queue.persons.length) {
        queue.persons.forEach(p => {
          if (p.position >= position) {
            p.position += 1;
          }
        });
      }

      queue.persons.push({
        bookingId: data.bookingId,
        clientId: (booking as any).clientId.toString(),
        position,
        status: QueuePersonStatus.WAITING,
        joinedAt: new Date(),
      });

      // Sort by position
      queue.persons.sort((a, b) => a.position - b.position);

      await queue.save();

      logger.info(`QueueService.addPersonToQueue: booking ${data.bookingId} added to agent ${agentId} queue at position ${position}`);

      const updatedQueue = await this.getQueueByAgent(agentId, queueDate);
      await this.emitQueueUpdate(agentId, updatedQueue);
      return updatedQueue;
    } catch (error) {
      logger.error('QueueService.addPersonToQueue: error adding person to queue', error);
      throw error;
    }
  }

  /**
   * Update a person's status in the queue (waiting → inService → completed / skipped).
   */
  public async updatePersonStatus(agentId: string, bookingId: string, data: UpdateQueuePersonDto): Promise<Queue> {
    try {
      const queueDate = this.getStartOfToday();
      const queue = await this.queues.findOne({ agentId, date: queueDate });

      if (!queue) {
        throw new NotFoundException('Queue not found', 'QUEUE_NOT_FOUND');
      }

      const person = queue.persons.find(p => p.bookingId.toString() === bookingId);
      if (!person) {
        throw new NotFoundException('Booking not found in this queue', 'PERSON_NOT_IN_QUEUE');
      }

      // Validate status transitions
      this.validateStatusTransition(person.status, data.status);

      person.status = data.status;
      await queue.save();

      // Handle side effects of the status change (booking update, notifications)
      await this.handlePersonStatusSideEffects(bookingId, data.status);

      logger.info(`QueueService.updatePersonStatus: booking ${bookingId} in agent ${agentId} queue updated to ${data.status}`);

      const updatedQueue = await this.getQueueByAgent(agentId, queueDate);
      await this.emitQueueUpdate(agentId, updatedQueue);
      return updatedQueue;
    } catch (error) {
      logger.error('QueueService.updatePersonStatus: error updating person status', error);
      throw error;
    }
  }

  /**
   * Remove a person from the queue and re-order positions.
   * If markAbsent is true, also set the booking status to ABSENT.
   */
  public async removePersonFromQueue(agentId: string, bookingId: string, markAbsent = false): Promise<Queue> {
    try {
      const queueDate = this.getStartOfToday();
      const queue = await this.queues.findOne({ agentId, date: queueDate });

      if (!queue) {
        throw new NotFoundException('Queue not found', 'QUEUE_NOT_FOUND');
      }

      const personIndex = queue.persons.findIndex(p => p.bookingId.toString() === bookingId);
      if (personIndex === -1) {
        throw new NotFoundException('Booking not found in this queue', 'PERSON_NOT_IN_QUEUE');
      }

      const removedPosition = queue.persons[personIndex].position;
      queue.persons.splice(personIndex, 1);

      // Re-order positions after removal
      queue.persons.forEach(p => {
        if (p.position > removedPosition) {
          p.position -= 1;
        }
      });

      await queue.save();

      // Mark booking as absent if requested
      if (markAbsent) {
        await this.finalizeBooking(bookingId, BookingStatus.ABSENT, { notify: 'absent' });
        logger.info(`QueueService.removePersonFromQueue: booking ${bookingId} marked as absent`);
      }

      logger.info(`QueueService.removePersonFromQueue: booking ${bookingId} removed from agent ${agentId} queue`);

      const updatedQueue = await this.getQueueByAgent(agentId, queueDate);
      await this.emitQueueUpdate(agentId, updatedQueue);
      return updatedQueue;
    } catch (error) {
      logger.error('QueueService.removePersonFromQueue: error removing person from queue', error);
      throw error;
    }
  }

  /**
   * Remove a person from any queue by bookingId (used when a booking is deleted).
   * Silently succeeds if no queue contains this booking.
   */
  public async removePersonByBookingId(bookingId: string): Promise<void> {
    try {
      const queue = await this.queues.findOne({ 'persons.bookingId': bookingId });
      if (!queue) return;

      const personIndex = queue.persons.findIndex(p => p.bookingId.toString() === bookingId);
      if (personIndex === -1) return;

      const removedPosition = queue.persons[personIndex].position;
      queue.persons.splice(personIndex, 1);

      // Re-order positions after removal
      queue.persons.forEach(p => {
        if (p.position > removedPosition) {
          p.position -= 1;
        }
      });

      await queue.save();

      const agentId = queue.agentId.toString();
      const updatedQueue = await this.getQueueByAgent(agentId, queue.date);
      await this.emitQueueUpdate(agentId, updatedQueue);
      logger.info(`QueueService.removePersonByBookingId: booking ${bookingId} removed from queue`);
    } catch (error) {
      logger.error(`QueueService.removePersonByBookingId: error for booking ${bookingId}`, error);
    }
  }

  /**
   * Reorder a person's position in the queue.
   * Shifts other persons' positions accordingly and emits real-time update.
   */
  public async reorderPerson(agentId: string, bookingId: string, data: ReorderQueuePersonDto): Promise<Queue> {
    try {
      if (isEmpty(agentId) || isEmpty(bookingId)) {
        throw new BadRequestException('Agent ID and Booking ID are required', 'MISSING_IDS');
      }

      const queueDate = this.getStartOfToday();
      const queue = await this.queues.findOne({ agentId, date: queueDate });

      if (!queue) {
        throw new NotFoundException('Queue not found', 'QUEUE_NOT_FOUND');
      }

      const person = queue.persons.find(p => p.bookingId.toString() === bookingId);
      if (!person) {
        throw new NotFoundException('Booking not found in this queue', 'PERSON_NOT_IN_QUEUE');
      }

      const oldPosition = person.position;
      const newPosition = Math.min(data.newPosition, queue.persons.length);

      if (oldPosition === newPosition) {
        // No change needed
        return this.getQueueByAgent(agentId, queueDate);
      }

      // Shift positions of affected persons
      if (newPosition < oldPosition) {
        // Moving up: shift persons in [newPosition, oldPosition-1] down by 1
        queue.persons.forEach(p => {
          if (p.position >= newPosition && p.position < oldPosition) {
            p.position += 1;
          }
        });
      } else {
        // Moving down: shift persons in [oldPosition+1, newPosition] up by 1
        queue.persons.forEach(p => {
          if (p.position > oldPosition && p.position <= newPosition) {
            p.position -= 1;
          }
        });
      }

      // Set the target person's new position
      person.position = newPosition;

      // Sort by position for consistency
      queue.persons.sort((a, b) => a.position - b.position);

      await queue.save();

      logger.info(`QueueService.reorderPerson: booking ${bookingId} moved from position ${oldPosition} to ${newPosition} in agent ${agentId} queue`);

      const updatedQueue = await this.getQueueByAgent(agentId, queueDate);
      await this.emitQueueUpdate(agentId, updatedQueue);
      return updatedQueue;
    } catch (error) {
      logger.error('QueueService.reorderPerson: error reordering person in queue', error);
      throw error;
    }
  }

  /**
   * Populate queues for today: find all confirmed bookings with bookingDate = today,
   * set their status to IN_QUEUE, and add them to each assigned agent's queue.
   */
  public async populateDailyQueues(): Promise<{ processed: number; errors: string[] }> {
    try {
      const todayStart = this.getStartOfToday();
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // Find confirmed bookings for today
      const bookings = await this.bookings.find({
        status: BookingStatus.CONFIRMED,
        bookingDate: { $gte: todayStart, $lt: todayEnd },
      });

      let processed = 0;
      const errors: string[] = [];

      for (const booking of bookings) {
        try {
          // Update booking status to IN_QUEUE
          booking.status = BookingStatus.IN_QUEUE;
          await booking.save();

          // Add to each assigned agent's queue
          if (booking.agentIds && booking.agentIds.length > 0) {
            for (const agentId of booking.agentIds) {
              try {
                await this.addPersonToQueue(agentId.toString(), {
                  bookingId: (booking as any)._id.toString(),
                });
              } catch (agentError) {
                errors.push(`Failed to add booking ${(booking as any)._id} to agent ${agentId}: ${agentError.message}`);
              }
            }
          }

          processed++;
        } catch (bookingError) {
          errors.push(`Failed to process booking ${(booking as any)._id}: ${bookingError.message}`);
        }
      }

      logger.info(`QueueService.populateDailyQueues: processed ${processed}/${bookings.length} bookings, ${errors.length} errors`);
      return { processed, errors };
    } catch (error) {
      logger.error('QueueService.populateDailyQueues: error populating daily queues', error);
      throw error;
    }
  }

  /**
   * Cleanup past queues: finalize any queue persons still in non-terminal statuses
   * when their queue date has passed.
   *
   * - waiting  → queue person: absent, booking: cancelled (cancelledBy = lounge title)
   * - absent   → booking: absent
   * - inService → queue person: completed, booking: completed
   */
  public async cleanupPastQueues(): Promise<{ processed: number; errors: string[] }> {
    const today = this.getStartOfToday();
    const errors: string[] = [];
    let processed = 0;

    try {
      const pastQueues = await this.queues.find({
        date: { $lt: today },
        'persons.status': { $in: [QueuePersonStatus.WAITING, QueuePersonStatus.ABSENT, QueuePersonStatus.IN_SERVICE] },
      });

      for (const queue of pastQueues) {
        const loungeInfo = await this.resolveLoungeInfo(queue.agentId);

        for (const person of queue.persons) {
          try {
            const result = await this.finalizeQueuePerson(person, loungeInfo);
            if (result) processed++;
          } catch (personErr) {
            errors.push(`Failed to cleanup booking ${person.bookingId} in queue ${(queue as any)._id}: ${personErr.message}`);
          }
        }

        await queue.save();
      }

      return { processed, errors };
    } catch (error) {
      logger.error('QueueService.cleanupPastQueues: error cleaning up past queues', error);
      throw error;
    }
  }

  /**
   * Send ~15-minute reminders to waiting queue persons.
   * For each queue today, calculate estimated wait time by summing totalDuration
   * of persons ahead (inService + waiting with lower position).
   * If estimated wait <= 15 min and reminderSent is false, send notification.
   */
  public async sendQueueReminders(): Promise<{ sent: number; errors: string[] }> {
    let sent = 0;
    const errors: string[] = [];

    try {
      const today = this.getStartOfToday();

      // Find today's queues that have waiting persons who haven't received a reminder
      const queues = await this.queues.find({
        date: today,
        'persons.status': QueuePersonStatus.WAITING,
        'persons.reminderSent': false,
      });

      for (const queue of queues) {
        // Get the person currently inService (their remaining time counts)
        const inServicePerson = queue.persons.find(p => p.status === QueuePersonStatus.IN_SERVICE);
        let inServiceRemainingMin = 0;

        if (inServicePerson) {
          // Estimate remaining time for the inService person
          const inServiceBooking = await this.bookings.findById(inServicePerson.bookingId).lean();
          if (inServiceBooking?.totalDuration) {
            // No exact start time tracked, so we conservatively use full duration
            inServiceRemainingMin = inServiceBooking.totalDuration;
          }
        }

        // Sort waiting persons by position
        const waitingPersons = queue.persons
          .filter(p => p.status === QueuePersonStatus.WAITING)
          .sort((a, b) => a.position - b.position);

        // Pre-load all booking durations for waiting persons
        const bookingIds = waitingPersons.map(p => p.bookingId);
        const bookings = await this.bookings.find({ _id: { $in: bookingIds } }).lean();
        const durationMap = new Map<string, number>();
        for (const b of bookings) {
          durationMap.set((b as any)._id.toString(), b.totalDuration || 0);
        }

        let cumulativeWait = inServiceRemainingMin;

        for (const person of waitingPersons) {
          if (person.reminderSent) {
            // Already sent — just accumulate their duration for the next person
            cumulativeWait += durationMap.get(person.bookingId.toString()) || 0;
            continue;
          }

          if (cumulativeWait <= 15) {
            // This person is within ~15 min — send reminder
            try {
              const booking = await this.populateBookingForNotify(person.bookingId.toString());

              if (booking) {
                await this.notificationService.notifyQueueReminder(booking, Math.max(1, Math.round(cumulativeWait)));
                person.reminderSent = true;
                sent++;
              }
            } catch (err) {
              errors.push(`Failed to send reminder for booking ${person.bookingId}: ${err.message}`);
            }
          }

          // Add this person's duration for the next person's wait calculation
          cumulativeWait += durationMap.get(person.bookingId.toString()) || 0;
        }

        await queue.save();
      }

      return { sent, errors };
    } catch (error) {
      logger.error('QueueService.sendQueueReminders: error sending reminders', error);
      throw error;
    }
  }

  /**
   * Cleanup queues for lounges that have closed today.
   * Reads each lounge's openingHours for the current day of the week.
   * If current time >= closing time, finalize any open queue persons.
   */
  public async cleanupClosedLoungeQueues(): Promise<{ processed: number; errors: string[] }> {
    let processed = 0;
    const errors: string[] = [];

    try {
      const now = new Date();
      const today = this.getStartOfToday();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayDay = dayNames[now.getUTCDay()];

      const queues = await this.queues.find({
        date: today,
        'persons.status': { $in: [QueuePersonStatus.WAITING, QueuePersonStatus.IN_SERVICE, QueuePersonStatus.ABSENT] },
      });

      for (const queue of queues) {
        try {
          const agent = await this.agents.findById(queue.agentId);
          if (!agent?.loungeId) continue;

          const lounge = await this.users.findById(agent.loungeId);
          if (!lounge?.openingHours) continue;

          const todayHours = (lounge.openingHours as any)[todayDay];
          if (!todayHours?.to) continue;

          // Parse closing time (HH:MM format, assumed UTC)
          const [closeHour, closeMin] = todayHours.to.split(':').map(Number);
          const closingTime = new Date(today);
          closingTime.setUTCHours(closeHour, closeMin, 0, 0);

          if (now < closingTime) continue;

          const loungeInfo = { loungeId: lounge._id.toString(), loungeTitle: lounge.loungeTitle || 'the lounge' };

          for (const person of queue.persons) {
            try {
              const result = await this.finalizeQueuePerson(person, loungeInfo);
              if (result) processed++;
            } catch (personErr) {
              errors.push(`Failed to cleanup booking ${person.bookingId} in closed lounge queue: ${personErr.message}`);
            }
          }

          await queue.save();
        } catch (queueErr) {
          errors.push(`Failed to process queue ${(queue as any)._id}: ${queueErr.message}`);
        }
      }

      return { processed, errors };
    } catch (error) {
      logger.error('QueueService.cleanupClosedLoungeQueues: error', error);
      throw error;
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  /**
   * Fetch a booking with notification-ready populates.
   */
  private populateBookingForNotify(bookingId: string) {
    return this.bookings.findById(bookingId)
      .populate('clientId', BOOKING_NOTIFY_POPULATE.CLIENT)
      .populate('loungeId', BOOKING_NOTIFY_POPULATE.LOUNGE);
  }

  /**
   * Update a booking's status, emit socket event, and return the populated booking.
   */
  private async finalizeBooking(
    bookingId: string,
    status: BookingStatus,
    options: { cancelledBy?: { idUser: string; cancelledByName: string }; notify?: 'completed' | 'absent' | 'autoCancelled'; loungeTitle?: string } = {},
  ): Promise<void> {
    try {
      const update: any = { status };
      if (options.cancelledBy) update.cancelledBy = options.cancelledBy;

      const booking = await this.bookings.findByIdAndUpdate(bookingId, update, { new: true })
        .populate('clientId', BOOKING_NOTIFY_POPULATE.CLIENT)
        .populate('loungeId', BOOKING_NOTIFY_POPULATE.LOUNGE);

      if (!booking) return;

      this.socketService.emitBookingUpdated(booking);

      if (options.notify === 'completed') {
        this.notificationService.notifyBookingCompleted(booking);
      } else if (options.notify === 'absent') {
        this.notificationService.notifyBookingAbsent(booking);
      } else if (options.notify === 'autoCancelled' && options.loungeTitle) {
        this.notificationService.notifyQueueAutoCancelled(booking, options.loungeTitle);
      }
    } catch (err) {
      logger.warn(`QueueService.finalizeBooking: failed for booking ${bookingId}: ${err.message}`);
    }
  }

  /**
   * Handle side effects when a queue person's status changes.
   * Maps status → booking update + notification.
   */
  private async handlePersonStatusSideEffects(bookingId: string, status: QueuePersonStatus): Promise<void> {
    try {
      switch (status) {
        case QueuePersonStatus.COMPLETED:
          await this.finalizeBooking(bookingId, BookingStatus.COMPLETED, { notify: 'completed' });
          logger.info(`QueueService: booking ${bookingId} status updated to completed`);
          break;
        case QueuePersonStatus.IN_SERVICE: {
          const booking = await this.populateBookingForNotify(bookingId);
          if (booking) this.notificationService.notifyQueueInService(booking);
          break;
        }
        case QueuePersonStatus.ABSENT: {
          const booking = await this.populateBookingForNotify(bookingId);
          if (booking) this.notificationService.notifyBookingAbsent(booking);
          break;
        }
        case QueuePersonStatus.WAITING: {
          const booking = await this.populateBookingForNotify(bookingId);
          if (booking) this.notificationService.notifyBackInQueue(booking);
          break;
        }
      }
    } catch (err) {
      logger.warn(`QueueService.handlePersonStatusSideEffects: failed for booking ${bookingId}: ${err.message}`);
    }
  }

  /**
   * Finalize a single queue person during cleanup (past queues or closed lounges).
   * Returns true if the person was processed, false if skipped (already terminal).
   *
   * - waiting  → queue person: absent, booking: cancelled
   * - absent   → booking: absent (no queue status change)
   * - inService → queue person: completed, booking: completed
   */
  private async finalizeQueuePerson(person: any, loungeInfo: { loungeId: string; loungeTitle: string }): Promise<boolean> {
    switch (person.status) {
      case QueuePersonStatus.WAITING:
        person.status = QueuePersonStatus.ABSENT;
        await this.finalizeBooking(person.bookingId, BookingStatus.CANCELLED, {
          cancelledBy: { idUser: loungeInfo.loungeId, cancelledByName: loungeInfo.loungeTitle },
          notify: 'autoCancelled',
          loungeTitle: loungeInfo.loungeTitle,
        });
        return true;

      case QueuePersonStatus.ABSENT:
        await this.finalizeBooking(person.bookingId, BookingStatus.ABSENT, { notify: 'absent' });
        return true;

      case QueuePersonStatus.IN_SERVICE:
        person.status = QueuePersonStatus.COMPLETED;
        await this.finalizeBooking(person.bookingId, BookingStatus.COMPLETED, { notify: 'completed' });
        return true;

      default:
        return false;
    }
  }

  /**
   * Resolve the lounge info for an agent (used in cleanup notifications).
   * Returns { loungeId, loungeTitle } for building cancelledBy.
   */
  private async resolveLoungeInfo(agentId: any): Promise<{ loungeId: string; loungeTitle: string }> {
    try {
      const agent = await this.agents.findById(agentId);
      if (agent?.loungeId) {
        const lounge = await this.users.findById(agent.loungeId);
        if (lounge) {
          return {
            loungeId: lounge._id.toString(),
            loungeTitle: lounge.loungeTitle || 'Lounge',
          };
        }
      }
    } catch (err) {
      logger.warn(`QueueService: could not resolve lounge info for agent ${agentId}: ${err.message}`);
    }
    return { loungeId: '', loungeTitle: 'Lounge' };
  }

  /**
   * Validate status transition rules.
   */
  private validateStatusTransition(current: QueuePersonStatus, next: QueuePersonStatus): void {
    const allowed: Record<QueuePersonStatus, QueuePersonStatus[]> = {
      [QueuePersonStatus.WAITING]: [QueuePersonStatus.IN_SERVICE, QueuePersonStatus.ABSENT],
      [QueuePersonStatus.IN_SERVICE]: [QueuePersonStatus.COMPLETED, QueuePersonStatus.WAITING],
      [QueuePersonStatus.COMPLETED]: [],
      [QueuePersonStatus.ABSENT]: [QueuePersonStatus.WAITING],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(`Cannot transition from '${current}' to '${next}'`, 'INVALID_STATUS_TRANSITION');
    }
  }

  /**
   * Get start of today (midnight, UTC).
   */
  private getStartOfToday(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }
}

export default QueueService;
