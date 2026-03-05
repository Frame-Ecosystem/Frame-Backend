import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import BookingService from '@services/booking.service';
import { CreateBookingDto, UpdateBookingDto } from '@dtos/booking.dto';
import { RequestWithUser } from '@interfaces/auth.interface';
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
      if (req.user.type === 'client' && booking.clientId._id.toString() !== userId) {
        throw new HttpException(403, 'You can only view your own bookings');
      }
      if (req.user.type === 'lounge' && booking.loungeId._id.toString() !== userId) {
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

      // Validate permissions
      this.validateUpdatePermissions(req.user, booking, bookingData);

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

  private validateUpdatePermissions(user: any, booking: any, bookingData: UpdateBookingDto): void {
    const userType = user.type;
    const userId = user._id.toString();
    const clientId = booking.clientId._id.toString();
    const loungeId = booking.loungeId._id.toString();

    // Automatically set cancelledBy when status is set to cancelled and not already provided
    if (bookingData.status === 'cancelled' && !bookingData.cancelledBy) {
      if (userType === 'client') {
        bookingData.cancelledBy = 'client';
      } else if (userType === 'lounge') {
        bookingData.cancelledBy = 'lounge';
      } else if (userType === 'admin') {
        bookingData.cancelledBy = 'admin';
      }
    }

    // Validate that cancelledBy is provided when status is cancelled
    if (bookingData.status === 'cancelled' && !bookingData.cancelledBy) {
      throw new HttpException(400, 'cancelledBy is required when status is cancelled');
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

  public getClientBookingStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const userId = req.user._id.toString();

      if (req.user.type === 'client' && userId !== clientId) {
        throw new HttpException(403, 'You can only view your own stats');
      }

      const stats = await this.bookingService.getClientBookingStats(clientId);
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Client booking stats retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getClientBookingStats: ${error.message}`);
      next(error);
    }
  };

  public getLoungeBookingStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const userId = req.user._id.toString();

      if (req.user.type === 'lounge' && userId !== loungeId) {
        throw new HttpException(403, 'You can only view your own lounge stats');
      }

      const stats = await this.bookingService.getLoungeBookingStats(loungeId);
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Lounge booking stats retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getLoungeBookingStats: ${error.message}`);
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
