import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '@utils/logger';

/**
 * Socket.IO event names for real-time updates.
 */
export const SocketEvents = {
  // Queue events
  QUEUE_UPDATED: 'queue:updated', // Emitted when an agent's queue changes
  LOUNGE_QUEUES_UPDATED: 'queue:lounge:updated', // Emitted when any queue in a lounge changes

  // Booking events
  BOOKING_CREATED: 'booking:created',
  BOOKING_UPDATED: 'booking:updated',
  BOOKING_DELETED: 'booking:deleted',
  BOOKINGS_UPDATED: 'bookings:updated', // Batch update for list views
} as const;

/**
 * Room naming conventions:
 * - queue:agent:{agentId}        → agent's queue subscribers
 * - queue:lounge:{loungeId}      → lounge-wide queue subscribers
 * - booking:{bookingId}          → single booking subscribers
 * - bookings:client:{clientId}   → client's bookings list
 * - bookings:lounge:{loungeId}   → lounge's bookings list
 * - bookings:admin               → admin bookings list (all)
 */

class SocketService {
  private static instance: SocketService;
  private io: Server | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize Socket.IO with the HTTP server.
   */
  public initialize(httpServer: HTTPServer): Server {
    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow same origins as Express CORS config
          if (!origin) return callback(null, true);
          if (origin.startsWith('http://localhost')) return callback(null, true);
          if (origin.startsWith('http://127.0.0.1')) return callback(null, true);
          if (origin.startsWith('http://0.0.0.0')) return callback(null, true);
          if (origin.match(/^http:\/\/192\.168\.\d+\.\d+/)) return callback(null, true);
          if (origin.match(/^http:\/\/172\.\d+\.\d+\.\d+/)) return callback(null, true);
          if (origin.match(/^http:\/\/10\.\d+\.\d+\.\d+/)) return callback(null, true);
          return callback(null, true); // Allow all in dev; tighten in production
        },
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // Join rooms based on client requests
      socket.on('join', (rooms: string | string[]) => {
        const roomList = Array.isArray(rooms) ? rooms : [rooms];
        roomList.forEach(room => {
          socket.join(room);
          logger.info(`Socket ${socket.id} joined room: ${room}`);
        });
      });

      // Leave rooms
      socket.on('leave', (rooms: string | string[]) => {
        const roomList = Array.isArray(rooms) ? rooms : [rooms];
        roomList.forEach(room => {
          socket.leave(room);
          logger.info(`Socket ${socket.id} left room: ${room}`);
        });
      });

      socket.on('disconnect', reason => {
        logger.info(`Socket disconnected: ${socket.id} (${reason})`);
      });
    });

    logger.info('Socket.IO initialized');
    return this.io;
  }

  public getIO(): Server | null {
    return this.io;
  }

  // ─── Queue Emissions ──────────────────────────────────────────────

  /**
   * Emit queue update to subscribers of a specific agent's queue.
   */
  public emitQueueUpdated(agentId: string, data: any): void {
    if (!this.io) return;
    this.io.to(`queue:agent:${agentId}`).emit(SocketEvents.QUEUE_UPDATED, {
      agentId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit lounge-wide queue update (when any agent queue in the lounge changes).
   */
  public emitLoungeQueuesUpdated(loungeId: string, data: any): void {
    if (!this.io) return;
    this.io.to(`queue:lounge:${loungeId}`).emit(SocketEvents.LOUNGE_QUEUES_UPDATED, {
      loungeId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Booking Emissions ────────────────────────────────────────────

  /**
   * Emit when a new booking is created.
   * Notifies the client, lounge, and admin rooms.
   */
  public emitBookingCreated(booking: any): void {
    if (!this.io) return;
    const payload = { data: booking, timestamp: new Date().toISOString() };

    const clientId = booking.clientId?._id || booking.clientId;
    const loungeId = booking.loungeId?._id || booking.loungeId;

    if (clientId) this.io.to(`bookings:client:${clientId}`).emit(SocketEvents.BOOKING_CREATED, payload);
    if (loungeId) this.io.to(`bookings:lounge:${loungeId}`).emit(SocketEvents.BOOKING_CREATED, payload);
    this.io.to('bookings:admin').emit(SocketEvents.BOOKING_CREATED, payload);
  }

  /**
   * Emit when a booking is updated.
   * Notifies the specific booking room, client, lounge, and admin rooms.
   */
  public emitBookingUpdated(booking: any): void {
    if (!this.io) return;
    const payload = { data: booking, timestamp: new Date().toISOString() };
    const bookingId = booking._id || booking.id;
    const clientId = booking.clientId?._id || booking.clientId;
    const loungeId = booking.loungeId?._id || booking.loungeId;

    if (bookingId) this.io.to(`booking:${bookingId}`).emit(SocketEvents.BOOKING_UPDATED, payload);
    if (clientId) this.io.to(`bookings:client:${clientId}`).emit(SocketEvents.BOOKING_UPDATED, payload);
    if (loungeId) this.io.to(`bookings:lounge:${loungeId}`).emit(SocketEvents.BOOKING_UPDATED, payload);
    this.io.to('bookings:admin').emit(SocketEvents.BOOKING_UPDATED, payload);
  }

  /**
   * Emit when a booking is deleted.
   */
  public emitBookingDeleted(bookingId: string, clientId?: string, loungeId?: string): void {
    if (!this.io) return;
    const payload = { bookingId, timestamp: new Date().toISOString() };

    this.io.to(`booking:${bookingId}`).emit(SocketEvents.BOOKING_DELETED, payload);
    if (clientId) this.io.to(`bookings:client:${clientId}`).emit(SocketEvents.BOOKING_DELETED, payload);
    if (loungeId) this.io.to(`bookings:lounge:${loungeId}`).emit(SocketEvents.BOOKING_DELETED, payload);
    this.io.to('bookings:admin').emit(SocketEvents.BOOKING_DELETED, payload);
  }
}

export default SocketService;
