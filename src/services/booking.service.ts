import { NotFoundException, BadRequestException, InternalServerException } from '@exceptions/HttpException';
import { Booking, BookingStatus } from '@interfaces/booking.interface';
import bookingModel from '@models/booking.model';
import agentModel from '@models/agent.model';
import loungeServiceModel from '@models/loungeService.model';
import userModel from '@models/users.model';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { CreateBookingDto, UpdateBookingDto } from '@dtos/booking.dto';
import mongoose from 'mongoose';
import QueueService from '@services/queue.service';
import SocketService from '@services/socket.service';
import NotificationService from '@services/notification.service';

const POPULATE_FIELDS = {
  CLIENT: 'firstName lastName email profileImage coverImage location',
  LOUNGE: 'firstName lastName email profileImage coverImage loungeTitle location',
  AGENTS: {
    path: 'agentIds',
    select: 'firstName lastName agentName profileImage coverImage',
  },
  SERVICE: {
    path: 'loungeServiceIds',
    select: 'price duration image',
    populate: { path: 'serviceId', select: 'name' },
  },
};

class BookingService {
  private bookings = bookingModel;
  private users = userModel;
  private loungeServices = loungeServiceModel;
  private agents = agentModel;
  private queueService = new QueueService();
  private socketService = SocketService.getInstance();
  private notificationService = NotificationService.getInstance();

  /**
   * Apply standard populate chain for fully-populated booking responses.
   */
  private populateBooking(query: any) {
    return query
      .populate('clientId', POPULATE_FIELDS.CLIENT)
      .populate('loungeId', POPULATE_FIELDS.LOUNGE)
      .populate(POPULATE_FIELDS.AGENTS)
      .populate(POPULATE_FIELDS.SERVICE);
  }

  public async createBooking(bookingData: CreateBookingDto): Promise<Booking> {
    try {
      if (isEmpty(bookingData)) {
        throw new BadRequestException('Booking data is required');
      }

      // Validate booking date is in the future
      const bookingDate = new Date(bookingData.bookingDate);
      if (bookingDate <= new Date()) {
        throw new BadRequestException('Booking date must be in the future');
      }

      // Validate client
      const client = await this.users.findById(bookingData.clientId);
      if (!client || client.type !== 'client') {
        throw new BadRequestException('Client not found or is not a valid client', 'INVALID_CLIENT');
      }

      // Validate lounge
      const lounge = await this.users.findById(bookingData.loungeId);
      if (!lounge || lounge.type !== 'lounge') {
        throw new BadRequestException('Lounge not found or is not a valid lounge', 'INVALID_LOUNGE');
      }

      // Validate agents (if provided)
      let uniqueAgentIds: string[] = [];
      if (bookingData.agentIds && bookingData.agentIds.length > 0) {
        // Remove duplicates from agentIds
        uniqueAgentIds = [...new Set(bookingData.agentIds)];
        await this.validateAgents(uniqueAgentIds, bookingData.loungeId);
      }

      // Validate and calculate lounge services
      let totalPrice = bookingData.totalPrice;
      let totalDuration = bookingData.totalDuration;

      if (bookingData.loungeServiceIds && bookingData.loungeServiceIds.length > 0) {
        await this.validateLoungeServices(bookingData.loungeServiceIds, bookingData.loungeId);
        if (totalPrice === undefined || totalDuration === undefined) {
          const { price, duration } = await this.calculateServiceTotals(bookingData.loungeServiceIds);
          totalPrice = totalPrice ?? price;
          totalDuration = totalDuration ?? duration;
        }
      }

      const booking = await this.bookings.create({
        clientId: bookingData.clientId,
        loungeId: bookingData.loungeId,
        agentIds: uniqueAgentIds,
        loungeServiceIds: bookingData.loungeServiceIds,
        bookingDate,
        totalPrice,
        totalDuration,
        status: bookingData.status || BookingStatus.PENDING,
        notes: bookingData.notes,
      });

      logger.info(`Booking created: ${booking._id}`);
      const populatedBooking = await this.getBookingById(booking._id.toString());
      this.socketService.emitBookingCreated(populatedBooking);
      await this.notificationService.notifyBookingCreated(populatedBooking);
      return populatedBooking;
    } catch (error) {
      logger.error(`Error creating booking: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a booking and immediately add it to the agent's queue for today.
   * Status: booking = inQueue, queue person = waiting.
   * Price and duration are always auto-calculated from loungeServiceIds.
   */
  public async createQueueBooking(bookingData: {
    clientId: string;
    loungeId: string;
    agentId: string;
    loungeServiceIds?: string[];
    notes?: string;
  }): Promise<Booking> {
    try {
      if (isEmpty(bookingData)) {
        throw new BadRequestException('Booking data is required');
      }

      // Validate client
      const client = await this.users.findById(bookingData.clientId);
      if (!client || client.type !== 'client') {
        throw new BadRequestException('Client not found or is not a valid client', 'INVALID_CLIENT');
      }

      // Validate lounge
      const lounge = await this.users.findById(bookingData.loungeId);
      if (!lounge || lounge.type !== 'lounge') {
        throw new BadRequestException('Lounge not found or is not a valid lounge', 'INVALID_LOUNGE');
      }

      // Validate the single agent belongs to this lounge
      await this.validateAgents([bookingData.agentId], bookingData.loungeId);

      // Check if agent accepts queue bookings
      const agent = await this.agents.findById(bookingData.agentId);
      if (!agent.acceptQueueBooking) {
        throw new BadRequestException('This agent does not accept queue bookings', 'QUEUE_BOOKING_DISABLED');
      }

      // Validate and auto-calculate price & duration from services
      let totalPrice = 0;
      let totalDuration = 0;

      if (bookingData.loungeServiceIds && bookingData.loungeServiceIds.length > 0) {
        await this.validateLoungeServices(bookingData.loungeServiceIds, bookingData.loungeId);
        const { price, duration } = await this.calculateServiceTotals(bookingData.loungeServiceIds);
        totalPrice = price;
        totalDuration = duration;
      }

      // Booking date is current date/time
      const bookingDate = new Date();

      // Create booking with inQueue status
      const booking = await this.bookings.create({
        clientId: bookingData.clientId,
        loungeId: bookingData.loungeId,
        agentIds: [bookingData.agentId],
        loungeServiceIds: bookingData.loungeServiceIds,
        bookingDate,
        totalPrice,
        totalDuration,
        status: BookingStatus.IN_QUEUE,
        notes: bookingData.notes,
      });

      // Add to agent's queue immediately
      try {
        await this.queueService.addPersonToQueue(bookingData.agentId, {
          bookingId: booking._id.toString(),
        });
        logger.info(`Queue booking ${booking._id} added to agent ${bookingData.agentId} queue`);
      } catch (queueError) {
        // If queue addition fails, delete the booking to avoid orphans
        await this.bookings.findByIdAndDelete(booking._id);
        throw new BadRequestException(`Failed to add to queue: ${queueError.message}`, 'QUEUE_ADD_FAILED');
      }

      logger.info(`Queue booking created: ${booking._id}`);
      const populatedBooking = await this.getBookingById(booking._id.toString());
      this.socketService.emitBookingCreated(populatedBooking);
      await this.notificationService.notifyQueueBookingCreated(populatedBooking);
      await this.notificationService.notifyBookingInQueue(populatedBooking);
      return populatedBooking;
    } catch (error) {
      logger.error(`Error creating queue booking: ${error.message}`);
      throw error;
    }
  }

  private async validateLoungeServices(serviceIds: string[], loungeId: string): Promise<void> {
    const services = await this.loungeServices.find({ _id: { $in: serviceIds } });
    if (services.length !== serviceIds.length) {
      throw new BadRequestException('One or more lounge services not found', 'INVALID_SERVICES');
    }
    const invalidServices = services.filter(s => s.loungeId.toString() !== loungeId);
    if (invalidServices.length > 0) {
      throw new BadRequestException('All lounge services must belong to the specified lounge', 'SERVICE_LOUNGE_MISMATCH');
    }
  }

  private async validateAgents(agentIds: string[], loungeId: string): Promise<void> {
    // Remove duplicates from agentIds
    const uniqueAgentIds = [...new Set(agentIds)];

    const agents = await this.agents.find({ _id: { $in: uniqueAgentIds } });
    if (agents.length !== uniqueAgentIds.length) {
      throw new BadRequestException('One or more agents not found', 'INVALID_AGENTS');
    }
    const invalidAgents = agents.filter(a => a.loungeId?.toString() !== loungeId);
    if (invalidAgents.length > 0) {
      throw new BadRequestException('All agents must belong to the specified lounge', 'AGENT_LOUNGE_MISMATCH');
    }
  }

  private async calculateServiceTotals(serviceIds: string[]): Promise<{ price: number; duration: number }> {
    const services = await this.loungeServices.find({ _id: { $in: serviceIds } });
    const price = services.reduce((sum, s) => sum + (s.price || 0), 0);
    const duration = services.reduce((sum, s) => sum + (s.duration || 0), 0);
    return { price, duration };
  }

  public async getAllBookings(): Promise<Booking[]> {
    try {
      return await this.populateBooking(
        this.bookings.find(),
      ).sort({ bookingDate: -1 });
    } catch (error) {
      logger.error(`Error fetching all bookings: ${error.message}`);
      throw new InternalServerException('Failed to fetch bookings');
    }
  }

  public async getBookingById(bookingId: string): Promise<Booking> {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        throw new BadRequestException('Invalid booking ID format', 'INVALID_BOOKING_ID');
      }
      const booking = await this.populateBooking(
        this.bookings.findById(bookingId),
      );
      if (!booking) {
        throw new NotFoundException('Booking not found', 'BOOKING_NOT_FOUND');
      }
      return booking;
    } catch (error) {
      logger.error(`Error fetching booking ${bookingId}: ${error.message}`);
      throw error;
    }
  }

  public async getBookingsByClientId(clientId: string): Promise<Booking[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        throw new BadRequestException('Invalid client ID format', 'INVALID_CLIENT_ID');
      }
      return await this.populateBooking(
        this.bookings.find({ clientId }),
      ).sort({ bookingDate: -1 });
    } catch (error) {
      logger.error(`Error fetching bookings for client ${clientId}: ${error.message}`);
      throw error;
    }
  }

  public async getBookingHistory(userId: string, userType: string): Promise<Booking[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format', 'INVALID_USER_ID');
      }

      const filter: any = { status: { $in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.ABSENT] } };

      if (userType === 'client') {
        filter.clientId = userId;
      } else if (userType === 'lounge') {
        filter.loungeId = userId;
      }
      // admin: no extra filter — gets all history bookings

      return await this.populateBooking(
        this.bookings.find(filter),
      ).sort({ bookingDate: -1 });
    } catch (error) {
      logger.error(`Error fetching booking history for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  public async getBookingsByLoungeId(loungeId: string): Promise<Booking[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(loungeId)) {
        throw new BadRequestException('Invalid lounge ID format', 'INVALID_LOUNGE_ID');
      }
      return await this.populateBooking(
        this.bookings.find({ loungeId }),
      ).sort({ bookingDate: -1 });
    } catch (error) {
      logger.error(`Error fetching bookings for lounge ${loungeId}: ${error.message}`);
      throw error;
    }
  }

  public async updateBooking(bookingId: string, bookingData: UpdateBookingDto): Promise<Booking> {
    try {
      if (isEmpty(bookingData)) {
        throw new BadRequestException('No update data provided', 'EMPTY_UPDATE');
      }
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        throw new BadRequestException('Invalid booking ID format', 'INVALID_BOOKING_ID');
      }

      // Validate that cancelledBy is required when status is cancelled
      if (bookingData.status === 'cancelled' && !bookingData.cancelledBy?.idUser) {
        throw new BadRequestException('cancelledBy is required when status is cancelled', 'MISSING_CANCELLED_BY');
      }

      const booking = await this.bookings.findByIdAndUpdate(bookingId, bookingData, { new: true });
      if (!booking) {
        throw new NotFoundException('Booking not found', 'BOOKING_NOT_FOUND');
      }
      logger.info(`Booking updated: ${bookingId}`);

      // Auto-add booking to each assigned agent's queue when status changes to inQueue
      if (bookingData.status === BookingStatus.IN_QUEUE && booking.agentIds && booking.agentIds.length > 0) {
        for (const agentId of booking.agentIds) {
          try {
            await this.queueService.addPersonToQueue(agentId.toString(), { bookingId });
            logger.info(`Booking ${bookingId} auto-added to agent ${agentId} queue`);
          } catch (queueError) {
            // Don't fail the booking update if queue addition fails (e.g., already in queue)
            logger.warn(`Failed to auto-add booking ${bookingId} to agent ${agentId} queue: ${queueError.message}`);
          }
        }
      }

      const populatedBooking = await this.getBookingById(bookingId);
      this.socketService.emitBookingUpdated(populatedBooking);

      // Send notifications based on status change
      if (bookingData.status) {
        switch (bookingData.status) {
          case BookingStatus.CONFIRMED:
            await this.notificationService.notifyBookingConfirmed(populatedBooking);
            break;
          case BookingStatus.CANCELLED:
            await this.notificationService.notifyBookingCancelled(populatedBooking);
            break;
          case BookingStatus.IN_QUEUE:
            await this.notificationService.notifyBookingInQueue(populatedBooking);
            break;
          case BookingStatus.COMPLETED:
            await this.notificationService.notifyBookingCompleted(populatedBooking);
            break;
          case BookingStatus.ABSENT:
            await this.notificationService.notifyBookingAbsent(populatedBooking);
            break;
        }
      }

      return populatedBooking;
    } catch (error) {
      logger.error(`Error updating booking ${bookingId}: ${error.message}`);
      throw error;
    }
  }

  public async deleteBooking(bookingId: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        throw new BadRequestException('Invalid booking ID format', 'INVALID_BOOKING_ID');
      }
      const booking = await this.bookings.findById(bookingId);
      if (!booking) {
        throw new NotFoundException('Booking not found', 'BOOKING_NOT_FOUND');
      }
      const clientId = booking.clientId?.toString();
      const loungeId = booking.loungeId?.toString();

      // Remove from queue if this booking has a queue entry
      await this.queueService.removePersonByBookingId(bookingId);

      await this.bookings.findByIdAndDelete(bookingId);
      this.socketService.emitBookingDeleted(bookingId, clientId, loungeId);
      logger.info(`Booking deleted: ${bookingId}`);
    } catch (error) {
      logger.error(`Error deleting booking ${bookingId}: ${error.message}`);
      throw error;
    }
  }

  public async getClientBookingStats(clientId: string): Promise<any> {
    return this.getBookingStats('clientId', clientId, 'client');
  }

  public async getLoungeBookingStats(loungeId: string): Promise<any> {
    return this.getBookingStats('loungeId', loungeId, 'lounge');
  }

  private async getBookingStats(field: string, id: string, label: string): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid ${label} ID format`, `INVALID_${label.toUpperCase()}_ID`);
      }
      return await this.bookings.aggregate([
        { $match: { [field]: new mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        },
      ]);
    } catch (error) {
      logger.error(`Error fetching stats for ${label} ${id}: ${error.message}`);
      throw error instanceof BadRequestException ? error : new InternalServerException(`Failed to fetch ${label} booking stats`);
    }
  }

  public async getAgentUnavailability(agentIds: string[]): Promise<any> {
    let uniqueAgentIds: string[] = [];

    try {
      // Remove duplicates from agentIds
      uniqueAgentIds = [...new Set(agentIds)];

      // Validate agent IDs format
      for (const id of uniqueAgentIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new BadRequestException(`Invalid agent ID format: ${id}`);
        }
      }

      // Find agents
      const agents = await this.agents.find({ _id: { $in: uniqueAgentIds } }).populate('loungeId');
      if (agents.length === 0) {
        throw new NotFoundException('No agents found with the provided IDs');
      }

      if (agents.length !== uniqueAgentIds.length) {
        throw new NotFoundException('Some agent IDs do not exist');
      }

      // Check all agents have loungeId
      const agentsWithoutLounge = agents.filter(a => !a.loungeId);
      if (agentsWithoutLounge.length > 0) {
        throw new BadRequestException('Some agents do not have an associated lounge');
      }

      // Check all agents from same lounge
      const loungeIds = [...new Set(agents.map(a => (a.loungeId as any)._id.toString()))];
      if (loungeIds.length > 1) {
        throw new BadRequestException('All agents must be from the same lounge');
      }

      const loungeId = loungeIds[0];
      if (!mongoose.Types.ObjectId.isValid(loungeId)) {
        throw new BadRequestException('Invalid lounge ID format');
      }

      const lounge = await this.users.findById(loungeId);
      if (!lounge || lounge.type !== 'lounge') {
        throw new NotFoundException('Lounge not found or is not a valid lounge');
      }

      // Get bookings for these agents, not cancelled, future dates
      const bookings = await this.bookings.find({
        agentIds: { $in: uniqueAgentIds },
        status: { $ne: BookingStatus.CANCELLED },
        bookingDate: { $gte: new Date() },
      });

      // Generate unavailable times based on opening hours and bookings
      const unavailableSlots = [];
      const today = new Date();

      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
        const hours = lounge.openingHours[dayOfWeek];

        if (!hours || !hours.from || !hours.to) {
          continue; // Lounge is closed this day
        }

        const fromTime = new Date(`${dateStr}T${hours.from}:00`);
        const toTime = new Date(`${dateStr}T${hours.to}:00`);
        const dayUnavailableTimes = [];

        // Generate 30-min slots during opening hours
        let current = new Date(fromTime);
        while (current < toTime) {
          const slotStart = new Date(current);
          const slotEnd = new Date(current.getTime() + 30 * 60 * 1000);

          // Check if this slot overlaps with any booking
          let isUnavailable = false;
          for (const booking of bookings) {
            const bookingStart = new Date(booking.bookingDate);
            const bookingEnd = new Date(bookingStart.getTime() + (booking.totalDuration || 60) * 60 * 1000);

            // Check overlap: booking starts before slot ends AND booking ends after slot starts
            if (bookingStart < slotEnd && bookingEnd > slotStart) {
              isUnavailable = true;
              break;
            }
          }

          if (isUnavailable) {
            dayUnavailableTimes.push(current.toTimeString().substring(0, 5)); // HH:MM
          }

          current = new Date(current.getTime() + 30 * 60 * 1000);
        }

        if (dayUnavailableTimes.length > 0) {
          unavailableSlots.push({
            date: dateStr,
            unavailableTimes: dayUnavailableTimes,
          });
        }
      }

      // Also return lounge opening hours for reference
      const openingHours = {
        monday: lounge.openingHours.monday,
        tuesday: lounge.openingHours.tuesday,
        wednesday: lounge.openingHours.wednesday,
        thursday: lounge.openingHours.thursday,
        friday: lounge.openingHours.friday,
        saturday: lounge.openingHours.saturday,
        sunday: lounge.openingHours.sunday,
      };

      return {
        unavailableSlots,
        loungeOpeningHours: openingHours,
      };
    } catch (error) {
      logger.error(`Error fetching agent availability: ${error.message}`, { error, agentIds: uniqueAgentIds });
      throw error; // Re-throw the original error with its specific message
    }
  }
}

export default BookingService;
