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

const POPULATE_FIELDS = {
  CLIENT: 'firstName lastName email profileImage location',
  LOUNGE: 'firstName lastName email profileImage loungeTitle location',
  AGENT: 'agentName profileImage',
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

      // Validate agent (if provided)
      if (bookingData.agentId) {
        const agent = await this.agents.findById(bookingData.agentId);
        if (!agent) {
          throw new BadRequestException('Agent not found', 'INVALID_AGENT');
        }
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
        agentId: bookingData.agentId,
        loungeServiceIds: bookingData.loungeServiceIds,
        bookingDate,
        totalPrice,
        totalDuration,
        status: bookingData.status || BookingStatus.PENDING,
        notes: bookingData.notes,
      });

      logger.info(`Booking created: ${booking._id}`);
      return this.getBookingById(booking._id.toString());
    } catch (error) {
      logger.error(`Error creating booking: ${error.message}`);
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

  private async calculateServiceTotals(serviceIds: string[]): Promise<{ price: number; duration: number }> {
    const services = await this.loungeServices.find({ _id: { $in: serviceIds } });
    const price = services.reduce((sum, s) => sum + (s.price || 0), 0);
    const duration = services.reduce((sum, s) => sum + (s.duration || 0), 0);
    return { price, duration };
  }

  public async getAllBookings(): Promise<Booking[]> {
    try {
      return await this.bookings
        .find()
        .populate('clientId', POPULATE_FIELDS.CLIENT)
        .populate('loungeId', POPULATE_FIELDS.LOUNGE)
        .populate('agentId', POPULATE_FIELDS.AGENT)
        .populate(POPULATE_FIELDS.SERVICE)
        .sort({ createdAt: -1 });
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
      const booking = await this.bookings
        .findById(bookingId)
        .populate('clientId', POPULATE_FIELDS.CLIENT)
        .populate('loungeId', POPULATE_FIELDS.LOUNGE)
        .populate('agentId', POPULATE_FIELDS.AGENT)
        .populate(POPULATE_FIELDS.SERVICE);
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
      return await this.bookings
        .find({ clientId })
        .populate('clientId', POPULATE_FIELDS.CLIENT)
        .populate('loungeId', POPULATE_FIELDS.LOUNGE)
        .populate('agentId', POPULATE_FIELDS.AGENT)
        .populate(POPULATE_FIELDS.SERVICE)
        .sort({ createdAt: -1 });
    } catch (error) {
      logger.error(`Error fetching bookings for client ${clientId}: ${error.message}`);
      throw error;
    }
  }

  public async getBookingsByLoungeId(loungeId: string): Promise<Booking[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(loungeId)) {
        throw new BadRequestException('Invalid lounge ID format', 'INVALID_LOUNGE_ID');
      }
      return await this.bookings
        .find({ loungeId })
        .populate('clientId', POPULATE_FIELDS.CLIENT)
        .populate('loungeId', POPULATE_FIELDS.LOUNGE)
        .populate('agentId', POPULATE_FIELDS.AGENT)
        .populate(POPULATE_FIELDS.SERVICE)
        .sort({ createdAt: -1 });
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
      if (bookingData.status === 'cancelled' && !bookingData.cancelledBy) {
        throw new BadRequestException('cancelledBy is required when status is cancelled', 'MISSING_CANCELLED_BY');
      }

      const booking = await this.bookings.findByIdAndUpdate(bookingId, bookingData, { new: true });
      if (!booking) {
        throw new NotFoundException('Booking not found', 'BOOKING_NOT_FOUND');
      }
      logger.info(`Booking updated: ${bookingId}`);
      return this.getBookingById(bookingId);
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
      await this.bookings.findByIdAndDelete(bookingId);
      logger.info(`Booking deleted: ${bookingId}`);
    } catch (error) {
      logger.error(`Error deleting booking ${bookingId}: ${error.message}`);
      throw error;
    }
  }

  public async getClientBookingStats(clientId: string): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        throw new BadRequestException('Invalid client ID format', 'INVALID_CLIENT_ID');
      }
      const stats = await this.bookings.aggregate([
        { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalSpent: { $sum: '$totalPrice' },
          },
        },
      ]);
      return stats;
    } catch (error) {
      logger.error(`Error fetching stats for client ${clientId}: ${error.message}`);
      throw new InternalServerException('Failed to fetch client booking stats');
    }
  }

  public async getLoungeBookingStats(loungeId: string): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(loungeId)) {
        throw new BadRequestException('Invalid lounge ID format', 'INVALID_LOUNGE_ID');
      }
      const stats = await this.bookings.aggregate([
        { $match: { loungeId: new mongoose.Types.ObjectId(loungeId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalPrice' },
          },
        },
      ]);
      return stats;
    } catch (error) {
      logger.error(`Error fetching stats for lounge ${loungeId}: ${error.message}`);
      throw new InternalServerException('Failed to fetch lounge booking stats');
    }
  }
}

export default BookingService;
