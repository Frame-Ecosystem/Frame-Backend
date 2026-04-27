import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '@utils/logger';
import { ChatSocketHandler } from '@systems/ChatSystem/socket/chat.socket';
import { FRONTEND_BASE_URL, ORIGIN, NODE_ENV } from '@config';

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

  // Chat events
  CHAT_MESSAGE: 'chat:message',               // New message received in a conversation
  CHAT_MESSAGE_DELETED: 'chat:message:deleted', // Message recalled / hidden
  CHAT_READ: 'chat:read',                     // Messages marked as read
  CHAT_TYPING: 'chat:typing',                 // Typing indicator (start/stop)
  CHAT_CONVERSATION_UPDATED: 'chat:conversation:updated', // lastMessage preview update
  CHAT_MESSAGE_EDITED: 'chat:message:edited',             // Message text updated
  CHAT_REACTION: 'chat:reaction',                         // Emoji reaction toggled
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
 * - chat:{conversationId}         → conversation participants
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
    const allowedOrigins = new Set<string>();
    if (FRONTEND_BASE_URL) allowedOrigins.add(FRONTEND_BASE_URL);
    if (ORIGIN) {
      ORIGIN.split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
        .forEach(origin => allowedOrigins.add(origin));
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.has(origin)) return callback(null, true);
          if (NODE_ENV !== 'production') return callback(null, true);
          return callback(new Error('Not allowed by Socket.IO CORS'));
        },
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    const chatHandler = new ChatSocketHandler(this.io);

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // General room join / leave (non-chat rooms: queues, bookings, notifications)
      socket.on('join', (rooms: string | string[]) => {
        const roomList = Array.isArray(rooms) ? rooms : [rooms];
        roomList.forEach(room => {
          socket.join(room);
          logger.info(`Socket ${socket.id} joined room: ${room}`);
        });
      });

      socket.on('leave', (rooms: string | string[]) => {
        const roomList = Array.isArray(rooms) ? rooms : [rooms];
        roomList.forEach(room => {
          socket.leave(room);
          logger.info(`Socket ${socket.id} left room: ${room}`);
        });
      });

      // Delegate all chat-related socket events to ChatSocketHandler
      chatHandler.register(socket);

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

  // ─── Chat Emissions ───────────────────────────────────────────────

  /**
   * Emit a new message to all participants in a conversation room.
   * Room: chat:{conversationId}
   */
  public emitChatMessage(conversationId: string, message: any): void {
    this.emit([`chat:${conversationId}`], SocketEvents.CHAT_MESSAGE, { data: message });
  }

  /**
   * Emit a message deletion / recall event to the conversation room.
   */
  public emitChatMessageDeleted(conversationId: string, messageId: string, recalledForAll: boolean): void {
    this.emit([`chat:${conversationId}`], SocketEvents.CHAT_MESSAGE_DELETED, { messageId, recalledForAll });
  }

  /**
   * Emit read-receipt updates to the conversation room.
   */
  public emitChatRead(conversationId: string, readBy: string, messageIds: string[]): void {
    this.emit([`chat:${conversationId}`], SocketEvents.CHAT_READ, { readBy, messageIds });
  }

  /**
   * Broadcast a typing indicator to everyone else in the conversation room.
   * The frontend should debounce this — typically every ~2 s while typing.
   *
   * @param excludeSocketId – the sender's socket ID so they don't receive their own indicator
   */
  public emitChatTyping(conversationId: string, userId: string, isTyping: boolean, excludeSocketId?: string): void {
    if (!this.io) return;
    const room = `chat:${conversationId}`;
    const data = { userId, isTyping, timestamp: new Date().toISOString() };
    if (excludeSocketId) {
      this.io.to(room).except(excludeSocketId).emit(SocketEvents.CHAT_TYPING, data);
    } else {
      this.io.to(room).emit(SocketEvents.CHAT_TYPING, data);
    }
  }

  /**
   * Emit a conversation-list update so the recipient's inbox refreshes its
   * last-message preview and unread badge without a full re-fetch.
   */
  public emitConversationUpdated(userId: string, conversation: any): void {
    this.emit([`notifications:${userId}`], SocketEvents.CHAT_CONVERSATION_UPDATED, { data: conversation });
  }

  /**
   * Broadcast a message-edited event to the conversation room.
   * The updated message document is included so clients can patch their local cache.
   */
  public emitChatMessageEdited(conversationId: string, message: any): void {
    this.emit([`chat:${conversationId}`], SocketEvents.CHAT_MESSAGE_EDITED, { data: message });
  }

  /**
   * Broadcast a reaction-toggle event to the conversation room.
   * The full updated reactions array is included for optimistic reconciliation.
   */
  public emitChatReaction(
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string,
    reactions: any[],
  ): void {
    this.emit([`chat:${conversationId}`], SocketEvents.CHAT_REACTION, { messageId, userId, emoji, reactions });
  }
}

export default SocketService;
