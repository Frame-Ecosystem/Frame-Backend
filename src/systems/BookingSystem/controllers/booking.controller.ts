import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import BookingService from '@systems/BookingSystem/services/booking.service';
import { CreateBookingDto, CreateQueueBookingDto, CreateLoungeQueueBookingDto, UpdateBookingDto } from '@systems/BookingSystem/dtos/booking.dto';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { logger } from '@utils/logger';

class BookingController {
  private bookingService = new BookingService();

  public createBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookingData: CreateBookingDto = req.body;
      const booking = await this.bookingService.createBooking(bookingData);
      res.status(201).json({
        success: true,
        data: booking,
        message: 'Booking created successfully',
      });
    } catch (error) {
      logger.error(`Error in createBooking: ${error.message}`);
      next(error);
    }
  };

  public createQueueBooking = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userType = req.user.type;
      if (!['client'].includes(userType)) {
        throw new HttpException(403, 'Only clients can create queue bookings via this endpoint');
      }

      const bookingData: CreateQueueBookingDto = req.body;
      const booking = await this.bookingService.createQueueBooking(bookingData);
      res.status(201).json({
        success: true,
        data: booking,
        message: 'Queue booking created successfully',
      });
    } catch (error) {
      logger.error(`Error in createQueueBooking: ${error.message}`);
      next(error);
    }
  };

  public createLoungeQueueBooking = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userType = req.user.type;
      if (userType !== 'lounge') {
        throw new HttpException(403, 'Only lounges can create lounge queue bookings');
      }

      const bookingData: CreateLoungeQueueBookingDto = req.body;
      // Inject the authenticated lounge's ID
      bookingData.loungeId = req.user._id.toString();

      const booking = await this.bookingService.createLoungeQueueBooking(bookingData);
      res.status(201).json({
        success: true,
        data: booking,
        message: 'Lounge queue booking created successfully',
      });
    } catch (error) {
      logger.error(`Error in createLoungeQueueBooking: ${error.message}`);
      next(error);
    }
  };

  public getAllBookings = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      let bookings;
      const userId = req.user._id.toString();

      if (req.user.type === 'client') {
        bookings = await this.bookingService.getBookingsByClientId(userId);
      } else if (req.user.type === 'lounge') {
        bookings = await this.bookingService.getBookingsByLoungeId(userId);
      } else if (req.user.type === 'admin') {
        bookings = await this.bookingService.getAllBookings();
      } else {
        throw new HttpException(403, 'Unauthorized access');
      }

      res.status(200).json({
        success: true,
        data: bookings,
        count: bookings.length,
        message: 'Bookings retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getAllBookings: ${error.message}`);
      next(error);
    }
  };

  public getBookingById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const booking = await this.bookingService.getBookingById(id);
      const userId = req.user._id.toString();

      // Check permissions
      if (req.user.type === 'client' && (booking.clientId as any)._id.toString() !== userId) {
        throw new HttpException(403, 'You can only view your own bookings');
      }
      if (req.user.type === 'lounge' && (booking.loungeId as any)._id.toString() !== userId) {
        throw new HttpException(403, 'You can only view bookings for your lounge');
      }

      res.status(200).json({
        success: true,
        data: booking,
        message: 'Booking retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getBookingById: ${error.message}`);
      next(error);
    }
  };

  public updateBooking = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const bookingData: UpdateBookingDto = req.body;
      const booking = await this.bookingService.getBookingById(id);

      this.enforceUpdatePermissions(req.user, booking, bookingData);

      const updatedBooking = await this.bookingService.updateBooking(id, bookingData);
      res.status(200).json({
        success: true,
        data: updatedBooking,
        message: 'Booking updated successfully',
      });
    } catch (error) {
      logger.error(`Error in updateBooking: ${error.message}`);
      next(error);
    }
  };

  /**
   * Enforce update permissions and enrich cancellation data.
   * NOTE: Mutates bookingData.cancelledBy when status is 'cancelled'.
   */
  private enforceUpdatePermissions(user: any, booking: any, bookingData: any): void {
    const userType = user.type;
    const userId = user._id.toString();
    const clientId = booking.clientId._id.toString();
    const loungeId = booking.loungeId._id.toString();

    if (bookingData.status === 'cancelled') {
      const cancelledByName = this.deriveCancelledByName(user);
      bookingData.cancelledBy = {
        idUser: userId,
        cancelledByName,
        ...(bookingData.cancellationNote && { note: bookingData.cancellationNote }),
      };
    }

    if (userType === 'client') {
      if (clientId !== userId) {
        throw new HttpException(403, 'You can only update your own bookings');
      }
      if (bookingData.status && bookingData.status !== 'cancelled') {
        throw new HttpException(403, 'Clients can only cancel bookings');
      }
      if (bookingData.bookingDate || bookingData.totalPrice || bookingData.totalDuration) {
        throw new HttpException(403, 'Clients can only update status and notes');
      }
    } else if (userType === 'lounge') {
      if (loungeId !== userId) {
        throw new HttpException(403, 'You can only update bookings for your lounge');
      }
    } else if (userType !== 'admin') {
      throw new HttpException(403, 'Unauthorized to update bookings');
    }
  }

  private deriveCancelledByName(user: any): string {
    if (user.type === 'client') {
      return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Client';
    }
    if (user.type === 'lounge') {
      return user.loungeTitle || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Lounge';
    }
    return 'Admin';
  }

  public deleteBooking = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (req.user.type !== 'admin') {
        throw new HttpException(403, 'Only admins can delete bookings');
      }

      await this.bookingService.deleteBooking(id);
      res.status(200).json({
        success: true,
        message: 'Booking deleted successfully',
      });
    } catch (error) {
      logger.error(`Error in deleteBooking: ${error.message}`);
      next(error);
    }
  };

  public getBookingHistory = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const userType = req.user.type;

      if (!['client', 'lounge', 'admin'].includes(userType)) {
        throw new HttpException(403, 'Unauthorized access');
      }

      const bookings = await this.bookingService.getBookingHistory(userId, userType);
      res.status(200).json({
        success: true,
        data: bookings,
        count: bookings.length,
        message: 'Booking history retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getBookingHistory: ${error.message}`);
      next(error);
    }
  };

  public getClientBookingStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    return this.getBookingStats(req, res, next, 'clientId', 'client', id => this.bookingService.getClientBookingStats(id), 'Client');
  };

  public getLoungeBookingStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    return this.getBookingStats(req, res, next, 'loungeId', 'lounge', id => this.bookingService.getLoungeBookingStats(id), 'Lounge');
  };

  private getBookingStats = async (
    req: RequestWithUser,
    res: Response,
    next: NextFunction,
    paramKey: string,
    ownerType: string,
    fetchStats: (id: string) => Promise<any>,
    label: string,
  ) => {
    try {
      const targetId = req.params[paramKey];
      const userId = req.user._id.toString();

      if (req.user.type === ownerType && userId !== targetId) {
        throw new HttpException(403, `You can only view your own ${label.toLowerCase()} stats`);
      }

      const stats = await fetchStats(targetId);
      res.status(200).json({
        success: true,
        data: stats,
        message: `${label} booking stats retrieved successfully`,
      });
    } catch (error) {
      logger.error(`Error in get${label}BookingStats: ${error.message}`);
      next(error);
    }
  };

  public getAgentAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentIds } = req.query;
      if (!agentIds || typeof agentIds !== 'string') {
        throw new HttpException(400, 'Agent IDs are required');
      }
      const ids = agentIds.split(',').map(id => id.trim());
      if (ids.length === 0) {
        throw new HttpException(400, 'At least one agent ID is required');
      }

      const unavailability = await this.bookingService.getAgentUnavailability(ids);
      res.status(200).json({
        success: true,
        data: unavailability,
        message: 'Agent unavailability retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getAgentAvailability: ${error.message}`);
      next(error);
    }
  };
}

export default BookingController;
