import { NotFoundException, BadRequestException, InternalServerException } from '@exceptions/HttpException';
import { Booking, BookingStatus } from '@interfaces/booking/booking.interface';
import bookingModel from '@models/booking/booking.model';
import agentModel from '@models/user/agent.model';
import userModel from '@models/user/users.model';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { CreateBookingDto, UpdateBookingDto } from '@dtos/booking/booking.dto';
import mongoose from 'mongoose';
import QueueService from '@services/queue/queue.service';
import SocketService from '@services/realtime/socket.service';
import NotificationService from '@services/realtime/notification.service';
import BookingAnalyticsService from '@services/booking/booking-analytics.service';
import { validateLoungeServices, validateAgents, calculateServiceTotals } from '@services/booking/booking-helpers';

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
  private agents = agentModel;
  private queueService = new QueueService();
  private socketService = SocketService.getInstance();
  private notificationService = NotificationService.getInstance();
  private analyticsService = new BookingAnalyticsService();

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
        await validateAgents(uniqueAgentIds, bookingData.loungeId);
      }

      // Validate and calculate lounge services
      let totalPrice = bookingData.totalPrice;
      let totalDuration = bookingData.totalDuration;

      if (bookingData.loungeServiceIds && bookingData.loungeServiceIds.length > 0) {
        await validateLoungeServices(bookingData.loungeServiceIds, bookingData.loungeId);
        if (totalPrice === undefined || totalDuration === undefined) {
          const { price, duration } = await calculateServiceTotals(bookingData.loungeServiceIds);
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
      await validateAgents([bookingData.agentId], bookingData.loungeId);

      // Check if agent accepts queue bookings
      const agent = await this.agents.findById(bookingData.agentId);
      if (!agent.acceptQueueBooking) {
        throw new BadRequestException('This agent does not accept queue bookings', 'QUEUE_BOOKING_DISABLED');
      }

      // Validate and auto-calculate price & duration from services
      let totalPrice = 0;
      let totalDuration = 0;

      if (bookingData.loungeServiceIds && bookingData.loungeServiceIds.length > 0) {
        await validateLoungeServices(bookingData.loungeServiceIds, bookingData.loungeId);
        const { price, duration } = await calculateServiceTotals(bookingData.loungeServiceIds);
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

  /**
   * Lounge-initiated queue booking.
   * Two cases:
   *   1. Visitor (walk-in): no account — uses visitorName
   *   2. Existing client: looked up by clientPhone or clientEmail
   */
  public async createLoungeQueueBooking(bookingData: {
    loungeId: string;
    agentId: string;
    visitorName?: string;
    clientPhone?: string;
    clientEmail?: string;
    loungeServiceIds?: string[];
    notes?: string;
  }): Promise<Booking> {
    try {
      if (isEmpty(bookingData)) {
        throw new BadRequestException('Booking data is required');
      }

      const hasVisitor = !!bookingData.visitorName;
      const hasClient = !!bookingData.clientPhone || !!bookingData.clientEmail;

      if (!hasVisitor && !hasClient) {
        throw new BadRequestException(
          'Either visitorName or clientPhone/clientEmail is required',
          'MISSING_CLIENT_OR_VISITOR',
        );
      }

      if (hasVisitor && hasClient) {
        throw new BadRequestException(
          'Provide either visitorName or clientPhone/clientEmail, not both',
          'AMBIGUOUS_CLIENT_VISITOR',
        );
      }

      // Validate lounge
      const lounge = await this.users.findById(bookingData.loungeId);
      if (!lounge || lounge.type !== 'lounge') {
        throw new BadRequestException('Lounge not found or is not a valid lounge', 'INVALID_LOUNGE');
      }

      // Validate the single agent belongs to this lounge
      await validateAgents([bookingData.agentId], bookingData.loungeId);

      // Check if agent accepts queue bookings
      const agent = await this.agents.findById(bookingData.agentId);
      if (!agent.acceptQueueBooking) {
        throw new BadRequestException('This agent does not accept queue bookings', 'QUEUE_BOOKING_DISABLED');
      }

      // Resolve client or visitor
      let clientId: string | undefined;
      let visitorName: string | undefined;

      if (hasClient) {
        const query: any = {};
        if (bookingData.clientPhone) query.phoneNumber = bookingData.clientPhone;
        if (bookingData.clientEmail) query.email = bookingData.clientEmail;

        const client = await this.users.findOne({ ...query, type: 'client' });
        if (!client) {
          throw new BadRequestException(
            'No client found with the provided phone or email',
            'CLIENT_NOT_FOUND',
          );
        }
        clientId = client._id.toString();
      } else {
        visitorName = bookingData.visitorName;
      }

      // Validate and auto-calculate price & duration from services
      let totalPrice = 0;
      let totalDuration = 0;

      if (bookingData.loungeServiceIds && bookingData.loungeServiceIds.length > 0) {
        await validateLoungeServices(bookingData.loungeServiceIds, bookingData.loungeId);
        const { price, duration } = await calculateServiceTotals(bookingData.loungeServiceIds);
        totalPrice = price;
        totalDuration = duration;
      }

      const bookingDate = new Date();

      // Create booking
      const booking = await this.bookings.create({
        ...(clientId ? { clientId } : {}),
        ...(visitorName ? { visitorName } : {}),
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
        logger.info(`Lounge queue booking ${booking._id} added to agent ${bookingData.agentId} queue`);
      } catch (queueError) {
        await this.bookings.findByIdAndDelete(booking._id);
        throw new BadRequestException(`Failed to add to queue: ${queueError.message}`, 'QUEUE_ADD_FAILED');
      }

      logger.info(`Lounge queue booking created: ${booking._id} (${clientId ? 'client' : 'visitor'})`);
      const populatedBooking = await this.getBookingById(booking._id.toString());
      this.socketService.emitBookingCreated(populatedBooking);

      // Only send client notifications if there's an actual client
      if (clientId) {
        await this.notificationService.notifyQueueBookingCreated(populatedBooking);
        await this.notificationService.notifyBookingInQueue(populatedBooking);
      }

      return populatedBooking;
    } catch (error) {
      logger.error(`Error creating lounge queue booking: ${error.message}`);
      throw error;
    }
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

  // --- Delegated to BookingAnalyticsService ---

  public async getClientBookingStats(clientId: string): Promise<any> {
    return this.analyticsService.getClientBookingStats(clientId);
  }

  public async getLoungeBookingStats(loungeId: string): Promise<any> {
    return this.analyticsService.getLoungeBookingStats(loungeId);
  }

  public async cleanupStaleInQueueBookings(): Promise<{ processed: number; errors: string[] }> {
    return this.analyticsService.cleanupStaleInQueueBookings();
  }

  public async getAgentUnavailability(agentIds: string[]): Promise<any> {
    return this.analyticsService.getAgentUnavailability(agentIds);
  }
}

export default BookingService;
