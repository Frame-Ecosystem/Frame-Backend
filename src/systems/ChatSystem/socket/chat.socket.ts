import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { SECRET_KEY } from '@config';
import { SocketEvents } from '@systems/NotificationSystem/services/socket.service';
import { logger } from '@utils/logger';

/**
 * Server-side typing throttle.
 * Key: `${userId}:${conversationId}` → last forwarded isTyping=true timestamp (ms).
 * Prevents flooding the room when a client emits on every keystroke.
 */
const typingThrottle = new Map<string, number>();
const TYPING_THROTTLE_MS = 2000;

/**
 * ChatSocketHandler
 *
 * Encapsulates all Socket.IO handlers related to the ChatSystem.
 * Instantiated once by SocketService and registered on every new connection.
 *
 * Architecture goals:
 *  - Zero circular-dependency risk: Mongoose models are lazy-imported inside handlers.
 *  - Server-side throttle on typing events (2 s debounce) to protect downstream rooms.
 *  - Membership is always verified from the DB on `chat:join` — a signed JWT alone
 *    is insufficient (the user may have been removed from the conversation after login).
 *  - `socket.data.userId` is the authoritative user identity set by `chat:join`; other
 *    handlers silently no-op if it is missing (client must join before typing/leaving).
 */
export class ChatSocketHandler {
  constructor(private readonly io: Server) {}

  /**
   * Register all chat-related event listeners on a newly connected socket.
   * Called by SocketService for every `connection` event.
   */
  public register(socket: Socket): void {
    socket.on('chat:join', (payload, ack) => this.handleJoin(socket, payload, ack));
    socket.on('chat:leave', payload => this.handleLeave(socket, payload));
    socket.on('chat:typing', payload => this.handleTyping(socket, payload));
  }

  // ─── Handlers ─────────────────────────────────────────────────────

  /**
   * `chat:join` — verified room join.
   *
   * The client must supply:
   *   - `conversationId`: the MongoDB _id of the conversation
   *   - `token`: a valid JWT (the same one used for HTTP requests)
   *
   * Flow:
   *   1. Verify JWT signature and extract userId.
   *   2. Query the DB to confirm userId is a participant (lazy import to
   *      avoid circular dep at module load time).
   *   3. Join `chat:{conversationId}` room and store userId in socket.data.
   *   4. ACK with `{ ok: true }` or `{ error: string }`.
   */
  private async handleJoin(
    socket: Socket,
    payload: { conversationId?: string; token?: string },
    ack?: (result: { ok?: boolean; error?: string }) => void,
  ): Promise<void> {
    try {
      if (!payload?.conversationId || !payload?.token) {
        return ack?.({ error: 'conversationId and token are required' });
      }

      // 1. Verify JWT
      let decoded: any;
      try {
        decoded = verify(payload.token, SECRET_KEY as string);
      } catch {
        return ack?.({ error: 'Invalid or expired token' });
      }

      const userId = decoded?._id || decoded?.id || decoded?.userId;
      if (!userId) return ack?.({ error: 'Invalid token payload' });

      // 2. DB membership check (lazy import avoids circular dependency at module load)
      const { conversationModel } = await import('@systems/ChatSystem/models/chat.model');

      const isMember = await conversationModel.exists({
        _id: payload.conversationId,
        participants: new Types.ObjectId(userId),
      });

      if (!isMember) {
        logger.warn(`Socket ${socket.id} denied chat:join — conversation ${payload.conversationId} (user ${userId} not a member)`);
        return ack?.({ error: 'Access denied' });
      }

      // 3. Join room and persist userId for downstream handlers
      const room = `chat:${payload.conversationId}`;
      await socket.join(room);
      (socket.data as any).userId = userId;

      logger.info(`Socket ${socket.id} (user ${userId}) joined chat room: ${room}`);
      ack?.({ ok: true });
    } catch (err: any) {
      logger.error(`chat:join error: ${err?.message}`);
      ack?.({ error: 'Internal error' });
    }
  }

  /**
   * `chat:leave` — explicit room leave.
   *
   * Clients should emit this when they navigate away from a conversation.
   * Socket.IO will also auto-leave all rooms on disconnect, so this is
   * primarily a courtesy for presence tracking.
   */
  private handleLeave(socket: Socket, payload: { conversationId?: string }): void {
    if (!payload?.conversationId) return;
    const room = `chat:${payload.conversationId}`;
    socket.leave(room);
    logger.info(`Socket ${socket.id} left chat room: ${room}`);
  }

  /**
   * `chat:typing` — server-throttled typing indicator.
   *
   * Requires the socket to have joined via `chat:join` first (userId present).
   *
   * Throttle rule:
   *   - `isTyping: true`  events are forwarded at most once every 2 seconds per
   *     user+conversation pair to prevent flooding from rapid keystrokes.
   *   - `isTyping: false` events are always forwarded immediately so the "… is typing"
   *     indicator disappears without waiting for the throttle window.
   */
  private handleTyping(socket: Socket, payload: { conversationId?: string; isTyping?: boolean }): void {
    if (!payload?.conversationId) return;

    const userId = (socket.data as any)?.userId;
    if (!userId) return; // Silently ignore — must have joined first

    const isTyping = !!payload.isTyping;
    const room = `chat:${payload.conversationId}`;
    const throttleKey = `${userId}:${payload.conversationId}`;
    const now = Date.now();

    if (isTyping) {
      const last = typingThrottle.get(throttleKey) ?? 0;
      if (now - last < TYPING_THROTTLE_MS) return; // Throttled — drop this event
      typingThrottle.set(throttleKey, now);
    } else {
      // Always forward stop-typing events; clear the throttle entry
      typingThrottle.delete(throttleKey);
    }

    socket.to(room).emit(SocketEvents.CHAT_TYPING, {
      conversationId: payload.conversationId,
      userId,
      isTyping,
      timestamp: new Date().toISOString(),
    });
  }
}
