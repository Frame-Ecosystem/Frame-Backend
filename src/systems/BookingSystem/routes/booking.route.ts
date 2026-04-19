import { Router } from 'express';
import BookingController from '@systems/BookingSystem/controllers/booking.controller';
import { CreateBookingDto, CreateQueueBookingDto, CreateLoungeQueueBookingDto, UpdateBookingDto } from '@systems/BookingSystem/dtos/booking.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

class BookingRoute implements Routes {
  public path = '/v1/bookings';
  public router = Router();
  public bookingController = new BookingController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // All booking routes require authentication
    this.router.use(authMiddleware);

    // Booking CRUD
    this.router.post('/', validationMiddleware(CreateBookingDto, 'body'), this.bookingController.createBooking);
    this.router.post('/queue', validationMiddleware(CreateQueueBookingDto, 'body'), this.bookingController.createQueueBooking);
    this.router.post('/queue/lounge', validationMiddleware(CreateLoungeQueueBookingDto, 'body'), this.bookingController.createLoungeQueueBooking);
    this.router.get('/', this.bookingController.getAllBookings);

    // Availability (must come before /:id to avoid route conflict)
    this.router.get('/availability', this.bookingController.getAgentAvailability);

    // Booking history (completed + cancelled) for the current user
    this.router.get('/history', this.bookingController.getBookingHistory);

    this.router.get('/:id', this.bookingController.getBookingById);
    this.router.put('/:id', validationMiddleware(UpdateBookingDto, 'body'), this.bookingController.updateBooking);
    this.router.delete('/:id', this.bookingController.deleteBooking);

    // Stats
    this.router.get('/stats/client/:clientId', this.bookingController.getClientBookingStats);
    this.router.get('/stats/lounge/:loungeId', this.bookingController.getLoungeBookingStats);
  }
}

export default BookingRoute;
