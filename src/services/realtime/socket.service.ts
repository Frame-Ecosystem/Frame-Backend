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

  // Notification events
  NOTIFICATION_NEW: 'notification:new',
} as const;

/**
 * Room naming conventions:
 * - queue:agent:{agentId}        → agent's queue subscribers
 * - queue:lounge:{loungeId}      → lounge-wide queue subscribers
 * - booking:{bookingId}          → single booking subscribers
 * - bookings:client:{clientId}   → client's bookings list
 * - bookings:lounge:{loungeId}   → lounge's bookings list
 * - bookings:admin               → admin bookings list (all)
 * - notifications:{userId}        → user's notification feed
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

  public isInitialized(): boolean {
    return this.io !== null;
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

  // ─── Helpers ──────────────────────────────────────────────────────

  /**
   * Emit an event to one or more rooms with a timestamped payload.
   * Skips silently if Socket.IO is not initialized.
   */
  private emit(rooms: (string | undefined)[], event: string, payload: Record<string, any>): void {
    if (!this.io) return;
    const data = { ...payload, timestamp: new Date().toISOString() };
    for (const room of rooms) {
      if (room) this.io.to(room).emit(event, data);
    }
  }

  /**
   * Extract the raw ID from a possibly-populated Mongoose ref.
   */
  private extractId(ref: any): string | undefined {
    return (ref?._id || ref)?.toString();
  }

  // ─── Queue Emissions ──────────────────────────────────────────────

  public emitQueueUpdated(agentId: string, data: any): void {
    this.emit([`queue:agent:${agentId}`], SocketEvents.QUEUE_UPDATED, { agentId, data });
  }

  public emitLoungeQueuesUpdated(loungeId: string, data: any): void {
    this.emit([`queue:lounge:${loungeId}`], SocketEvents.LOUNGE_QUEUES_UPDATED, { loungeId, data });
  }

  // ─── Booking Emissions ────────────────────────────────────────────

  public emitBookingCreated(booking: any): void {
    const clientId = this.extractId(booking.clientId);
    const loungeId = this.extractId(booking.loungeId);
    const rooms = [clientId && `bookings:client:${clientId}`, loungeId && `bookings:lounge:${loungeId}`, 'bookings:admin'].filter(
      Boolean,
    ) as string[];
    this.emit(rooms, SocketEvents.BOOKING_CREATED, { data: booking });
  }

  public emitBookingUpdated(booking: any): void {
    const bookingId = booking._id || booking.id;
    const clientId = this.extractId(booking.clientId);
    const loungeId = this.extractId(booking.loungeId);
    const rooms = [
      `booking:${bookingId}`,
      clientId && `bookings:client:${clientId}`,
      loungeId && `bookings:lounge:${loungeId}`,
      'bookings:admin',
    ].filter(Boolean) as string[];
    this.emit(rooms, SocketEvents.BOOKING_UPDATED, { data: booking });
  }

  public emitBookingDeleted(bookingId: string, clientId?: string, loungeId?: string): void {
    this.emit(
      [`booking:${bookingId}`, clientId && `bookings:client:${clientId}`, loungeId && `bookings:lounge:${loungeId}`, 'bookings:admin'],
      SocketEvents.BOOKING_DELETED,
      { bookingId },
    );
  }

  // ─── Notification Emissions ───────────────────────────────────────

  public emitNotification(userId: string, notification: any): void {
    this.emit([`notifications:${userId}`], SocketEvents.NOTIFICATION_NEW, { data: notification });
  }
}

export default SocketService;
