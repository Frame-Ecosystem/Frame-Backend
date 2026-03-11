import { Queue } from '@interfaces/queue.interface';
import { QueuePersonStatus } from '@interfaces/queue.interface';
import { BookingStatus } from '@interfaces/booking.interface';
import queueModel from '@models/queue.model';
import bookingModel from '@models/booking.model';
import agentModel from '@models/agent.model';
import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { AddToQueueDto, UpdateQueuePersonDto, ReorderQueuePersonDto } from '@dtos/queue.dto';
import SocketService from '@services/socket.service';

class QueueService {
  public queues = queueModel;
  private bookings = bookingModel;
  private agents = agentModel;
  private socketService = SocketService.getInstance();

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
        .populate('agentId', 'agentName profileImage coverImage')
        .populate('persons.bookingId', 'totalDuration totalPrice loungeServiceIds status bookingDate notes')
        .populate('persons.clientId', 'firstName lastName email profileImage coverImage');

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
        .populate('agentId', 'agentName profileImage coverImage')
        .populate('persons.bookingId', 'totalDuration totalPrice loungeServiceIds status bookingDate notes')
        .populate('persons.clientId', 'firstName lastName email profileImage coverImage');

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

      // When queue person is completed, also mark the booking as completed
      if (data.status === QueuePersonStatus.COMPLETED) {
        try {
          const booking = await this.bookings.findByIdAndUpdate(bookingId, { status: BookingStatus.COMPLETED }, { new: true });
          if (booking) {
            this.socketService.emitBookingUpdated(booking);
            logger.info(`QueueService.updatePersonStatus: booking ${bookingId} status updated to completed`);
          }
        } catch (bookingErr) {
          logger.warn(`QueueService.updatePersonStatus: failed to update booking ${bookingId} status: ${bookingErr.message}`);
        }
      }

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
        try {
          const booking = await this.bookings.findByIdAndUpdate(bookingId, { status: BookingStatus.ABSENT }, { new: true });
          if (booking) {
            this.socketService.emitBookingUpdated(booking);
            logger.info(`QueueService.removePersonFromQueue: booking ${bookingId} marked as absent`);
          }
        } catch (bookingErr) {
          logger.warn(`QueueService.removePersonFromQueue: failed to mark booking ${bookingId} as absent: ${bookingErr.message}`);
        }
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
