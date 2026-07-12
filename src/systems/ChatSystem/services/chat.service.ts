import { Types } from 'mongoose';
import { conversationModel, messageModel } from '@systems/ChatSystem/models/chat.model';
import { MessageContentType } from '@systems/ChatSystem/interfaces/chat.interface';
import SocketService from '@systems/NotificationSystem/services/socket.service';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import userModel from '@systems/UserManager/models/user.model';
import followModel from '@systems/UserManager/models/follow.model';
import { HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

/* ================================================================== */
/*  Module-level helpers                                               */
/* ================================================================== */

/**
 * Build the stable slug for a DM between two user IDs.
 * Sorting ensures "A → B" and "B → A" resolve to the same document.
 */
function buildSlug(a: string, b: string): string {
  return [a, b].sort().join('_');
}

/**
 * Sender name derived from a lean user document for push notification copy.
 */
function resolveSenderName(user: any): string {
  return user?.loungeTitle || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Someone';
}

/* ================================================================== */
/*  Attachment type                                                    */
/* ================================================================== */

interface AttachmentInput {
  url: string;
  publicId: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
}

/* ================================================================== */
/*  Sender projection — reused across populate() calls                */
/* ================================================================== */

const SENDER_PROJECTION = 'firstName lastName loungeTitle profileImage type';

/* ================================================================== */
/*  Allowed participant types                                          */
/* ================================================================== */

/**
 * All user roles that may initiate or receive a direct message.
 * Note: 'agent' is explicitly included so agents can chat with clients.
 */
const ALLOWED_PARTICIPANT_TYPES: readonly string[] = ['client', 'lounge', 'admin', 'agent'] as const;

/* ================================================================== */
/*  ChatService                                                        */
/* ================================================================== */

/**
 * ChatService — all chat business logic.
 *
 * Performance principles applied throughout:
 *  - Atomic `findOneAndUpdate` upsert for `findOrCreate` (no race condition).
 *  - `Promise.all` to run independent DB operations in parallel.
 *  - `.lean()` on every read to skip Mongoose document hydration.
 *  - `select()` / `projection` to exclude large fields not needed by callers.
 *  - O(1) online-presence check via the Socket.IO room adapter instead of
 *    the expensive `io.fetchSockets()` call.
 *  - `$inc` with `arrayFilters` for unread count increments (single round-trip).
 *  - `countDocuments` is skipped for cursor-based pagination (returns `hasMore`).
 */
class ChatService {
  private conversations = conversationModel;
  private messages = messageModel;
  private users = userModel;
  private socket = SocketService.getInstance();
  private notificationService = NotificationService.getInstance();

  // ─── Mutual-follow guard ──────────────────────────────────────────

  /**
   * Enforce the "mutual follow" rule: both users must follow each other
   * before a DM conversation is permitted.
   *
   * Admins bypass this restriction so support agents can always reach users.
   */
  private async ensureMutualFollow(userIdA: string, userIdB: string): Promise<void> {
    const [userA, userB] = await Promise.all([
      this.users.findById(userIdA).select('type').lean(),
      this.users.findById(userIdB).select('type').lean(),
    ]);

    const isAdmin = (u: any) => u?.type === 'admin';
    if (isAdmin(userA) || isAdmin(userB)) return;

    const [aFollowsB, bFollowsA] = await Promise.all([
      followModel.findOne({ followerId: userIdA, followingId: userIdB }).select('_id').lean(),
      followModel.findOne({ followerId: userIdB, followingId: userIdA }).select('_id').lean(),
    ]);

    if (!aFollowsB || !bFollowsA) {
      throw new HttpException(403, 'You must follow each other to send messages');
    }
  }

  // ─── Online-presence helper ───────────────────────────────────────

  /**
   * Returns `true` when at least one of the user's active sockets is also
   * present in the given conversation's Socket.IO room.
   *
   * This is an O(m) operation where m = number of sockets the user has open
   * (typically 1–2), compared to `io.fetchSockets()` which serialises the
   * entire rooms adapter.
   */
  private isUserActiveInConversation(conversationId: string, userId: string): boolean {
    const io = this.socket.getIO();
    if (!io) return false;

    const chatRoom = io.sockets.adapter.rooms.get(`chat:${conversationId}`);
    if (!chatRoom || chatRoom.size === 0) return false;

    const userRoom = io.sockets.adapter.rooms.get(`notifications:${userId}`);
    if (!userRoom || userRoom.size === 0) return false;

    for (const socketId of userRoom) {
      if (chatRoom.has(socketId)) return true;
    }
    return false;
  }

  // ─── Conversation CRUD ────────────────────────────────────────────

  /**
   * Find an existing DM conversation between two users, or create one atomically.
   *
   * Uses a `findOneAndUpdate` upsert so that concurrent requests from both
   * participants land on the same document rather than racing to create two.
   *
   * Returns `{ conversation, wasCreated }` so callers can set the correct
   * HTTP status (201 vs 200) without relying on a fragile time-based check.
   */
  public async findOrCreateConversation(requesterId: string, recipientId: string): Promise<{ conversation: any; wasCreated: boolean }> {
    if (requesterId === recipientId) {
      throw new HttpException(400, 'You cannot start a conversation with yourself');
    }

    // Validate recipient exists and is eligible for chat
    const recipient = await this.users.findById(recipientId).select('type').lean();
    if (!recipient) throw new HttpException(404, 'Recipient not found');
    if (!ALLOWED_PARTICIPANT_TYPES.includes((recipient as any).type)) {
      throw new HttpException(403, 'This user type cannot participate in conversations');
    }

    await this.ensureMutualFollow(requesterId, recipientId);

    const slug = buildSlug(requesterId, recipientId);
    const participants = [new Types.ObjectId(requesterId), new Types.ObjectId(recipientId)];

    // Atomically find or insert — the unique index on `slug` guarantees exactly
    // one document per participant pair.
    const before = await this.conversations.findOne({ slug }).lean();

    const conversation = await this.conversations.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: {
          participants,
          slug,
          unreadCounts: [
            { userId: new Types.ObjectId(requesterId), count: 0 },
            { userId: new Types.ObjectId(recipientId), count: 0 },
          ],
          deletedFor: [],
          isArchived: false,
        },
      },
      { upsert: true, new: true },
    );

    const wasCreated = !before;

    // If the requester had previously soft-deleted the conversation, restore it
    if (!wasCreated && conversation.deletedFor.map(String).includes(requesterId)) {
      await this.conversations.updateOne({ _id: conversation._id }, { $pull: { deletedFor: new Types.ObjectId(requesterId) } });
    }

    return { conversation, wasCreated };
  }

  /**
   * Get all conversations for a user, newest first, excluding soft-deleted ones.
   * Returns a pagination envelope with `total` and `totalPages` for offset-based
   * navigation (conversation lists are typically small and don't need cursors).
   */
  public async getConversations(userId: string, page = 1, limit = 20): Promise<{ conversations: any[]; total: number }> {
    const filter = {
      participants: new Types.ObjectId(userId),
      deletedFor: { $ne: new Types.ObjectId(userId) },
    };

    const [conversations, total] = await Promise.all([
      this.conversations
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('participants', SENDER_PROJECTION)
        .lean(),
      this.conversations.countDocuments(filter),
    ]);

    return { conversations, total };
  }

  /**
   * Get a single conversation by ID.
   * Throws 404 if the user is not a participant or the conversation is
   * soft-deleted for them.
   */
  public async getConversationById(conversationId: string, userId: string): Promise<any> {
    const conversation = await this.conversations
      .findOne({
        _id: conversationId,
        participants: new Types.ObjectId(userId),
        deletedFor: { $ne: new Types.ObjectId(userId) },
      })
      .populate('participants', SENDER_PROJECTION)
      .lean();

    if (!conversation) throw new HttpException(404, 'Conversation not found');
    return conversation;
  }

  /**
   * Soft-delete a conversation for the requesting user only.
   * The other participant's view is unaffected.
   */
  public async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const result = await this.conversations.updateOne(
      { _id: conversationId, participants: new Types.ObjectId(userId) },
      { $addToSet: { deletedFor: new Types.ObjectId(userId) } },
    );
    if (result.matchedCount === 0) throw new HttpException(404, 'Conversation not found');
  }

  // ─── Message CRUD ─────────────────────────────────────────────────

  /**
   * Send a message in a conversation.
   *
   * Optimised to three DB round-trips:
   *   1. Verify sender membership + load participant list (findOne).
   *   2. Parallel: persist message + update conversation in one Promise.all.
   *   3. Populate sender + replyTo preview on the created document (findById).
   *
   * Side-effects (non-blocking):
   *   - Emits `chat:message` to the conversation Socket.IO room.
   *   - Emits `chat:conversation:updated` to each participant's notification room.
   *   - Sends an in-app push notification to any recipient who is offline.
   */
  public async sendMessage(
    conversationId: string,
    senderId: string,
    contentType: MessageContentType,
    text?: string,
    attachment?: AttachmentInput,
    replyTo?: string,
  ): Promise<any> {
    // 1. Verify membership and load participant IDs for downstream steps
    const conversation = await this.conversations
      .findOne({
        _id: conversationId,
        participants: new Types.ObjectId(senderId),
      })
      .select('participants')
      .lean();

    if (!conversation) throw new HttpException(404, 'Conversation not found');

    const recipientIds = (conversation.participants as any[]).map(String).filter(id => id !== senderId);
    if (recipientIds.length > 0) {
      await this.ensureMutualFollow(senderId, recipientIds[0]);
    }

    if (contentType === 'text' && !text?.trim()) {
      throw new HttpException(400, 'Text content is required for text messages');
    }
    if ((contentType === 'image' || contentType === 'file' || contentType === 'audio') && !attachment) {
      throw new HttpException(400, 'Attachment is required for image, file, or audio messages');
    }

    // Validate replyTo belongs to this conversation (lightweight exists check)
    if (replyTo) {
      const parentExists = await this.messages.exists({
        _id: replyTo,
        conversationId: new Types.ObjectId(conversationId),
      });
      if (!parentExists) throw new HttpException(400, 'replyTo message not found in this conversation');
    }

    const preview = text ? text.slice(0, 80) : undefined;

    // 2. Persist message
    const message = await this.messages.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(senderId),
      contentType,
      text: text?.trim(),
      attachment,
      replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
      readBy: [],
      deletedFor: [],
      isDeleted: false,
    });

    // 3. Parallel: populate message + update conversation
    const [populated] = await Promise.all([
      this.messages.findById(message._id).populate('senderId', SENDER_PROJECTION).populate('replyTo', `text contentType senderId createdAt`).lean(),

      this.conversations.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastMessage: {
              messageId: message._id,
              senderId: new Types.ObjectId(senderId),
              text: preview,
              contentType,
              createdAt: message.createdAt,
            },
          },
          $inc: { 'unreadCounts.$[elem].count': 1 },
        },
        {
          arrayFilters: [{ 'elem.userId': { $in: recipientIds.map(id => new Types.ObjectId(id)) } }],
        },
      ),
    ]);

    // 4. Real-time: emit to conversation room and each participant's inbox
    this.socket.emitChatMessage(conversationId, populated);

    // Minimal conversation update payload — no need to re-fetch the full document
    const inboxUpdate = {
      _id: conversationId,
      lastMessage: {
        messageId: message._id,
        senderId,
        text: preview,
        contentType,
        createdAt: message.createdAt,
      },
    };

    for (const participantId of (conversation.participants as any[]).map(String)) {
      this.socket.emitConversationUpdated(participantId, inboxUpdate);
    }

    // 5. Push notifications for offline recipients (non-blocking)
    // Lazy-fetch sender name only when at least one recipient is offline
    let senderName: string | undefined;
    for (const recipientId of recipientIds) {
      if (!this.isUserActiveInConversation(conversationId, recipientId)) {
        if (!senderName) {
          const sender = await this.users.findById(senderId).select('firstName lastName loungeTitle').lean();
          senderName = resolveSenderName(sender);
        }
        this.notificationService
          .notifyChatMessage(recipientId, senderId, senderName, conversationId, message._id.toString(), preview)
          .catch(err => logger.error(`ChatService: push notification failed for recipient ${recipientId}: ${err?.message}`));
      }
    }

    return populated;
  }

  /**
   * Get paginated messages for a conversation.
   *
   * Supports two pagination modes:
   *   - **Cursor-based** (`before` param): returns the `limit` messages older
   *     than the given message ID.  Does NOT run `countDocuments` — returns
   *     `hasMore` flag instead (one fewer query per page load).
   *   - **Offset-based** (`page` param): falls back to offset pagination and
   *     includes `total` for numbered pagination UI.
   *
   * Messages are returned in chronological order (oldest first) regardless
   * of the internal sort direction used to retrieve them.
   */
  public async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
    before?: string,
  ): Promise<{ messages: any[]; total?: number; hasMore?: boolean }> {
    const isMember = await this.conversations.exists({
      _id: conversationId,
      participants: new Types.ObjectId(userId),
    });
    if (!isMember) throw new HttpException(404, 'Conversation not found');

    const baseFilter: any = {
      conversationId: new Types.ObjectId(conversationId),
      deletedFor: { $ne: new Types.ObjectId(userId) },
    };

    if (before) {
      // Cursor mode: look up the pivot message's timestamp for a range query
      const pivot = await this.messages.findById(before).select('createdAt').lean();
      if (pivot) baseFilter.createdAt = { $lt: (pivot as any).createdAt };

      // Fetch one extra to determine hasMore without a count query
      const rows = await this.messages
        .find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .populate('senderId', SENDER_PROJECTION)
        .populate('replyTo', `text contentType senderId createdAt`)
        .lean();

      const hasMore = rows.length > limit;
      return { messages: rows.slice(0, limit).reverse(), hasMore };
    }

    // Offset mode — include total for numbered UI
    const [messages, total] = await Promise.all([
      this.messages
        .find(baseFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('senderId', SENDER_PROJECTION)
        .populate('replyTo', `text contentType senderId createdAt`)
        .lean(),
      this.messages.countDocuments(baseFilter),
    ]);

    return { messages: messages.reverse(), total };
  }

  /**
   * Mark messages as read for the given user.
   *
   * - Collects the IDs of qualifying messages *before* the update so there
   *   is no post-update re-query.
   * - Resets the `unreadCounts` entry for the user in a single operation.
   * - Emits a `chat:read` socket event so the other participant's UI updates
   *   the "seen" indicators immediately.
   */
  public async markMessagesRead(conversationId: string, userId: string, messageIds?: string[]): Promise<string[]> {
    const isMember = await this.conversations.exists({
      _id: conversationId,
      participants: new Types.ObjectId(userId),
    });
    if (!isMember) throw new HttpException(404, 'Conversation not found');

    const filter: any = {
      conversationId: new Types.ObjectId(conversationId),
      senderId: { $ne: new Types.ObjectId(userId) },
      'readBy.userId': { $ne: new Types.ObjectId(userId) },
      deletedFor: { $ne: new Types.ObjectId(userId) },
    };
    if (messageIds && messageIds.length > 0) {
      filter._id = { $in: messageIds.map(id => new Types.ObjectId(id)) };
    }

    // Collect IDs first so we can return them without a second query
    const toMark = await this.messages.find(filter).select('_id').lean();
    if (toMark.length === 0) return [];

    const markedIds = toMark.map((m: any) => m._id.toString());

    // Parallel: update message documents + reset conversation unread count
    await Promise.all([
      this.messages.updateMany(
        { _id: { $in: markedIds.map(id => new Types.ObjectId(id)) } },
        { $addToSet: { readBy: { userId: new Types.ObjectId(userId), readAt: new Date() } } },
      ),
      this.conversations.updateOne(
        { _id: conversationId, 'unreadCounts.userId': new Types.ObjectId(userId) },
        { $set: { 'unreadCounts.$.count': 0 } },
      ),
    ]);

    this.socket.emitChatRead(conversationId, userId, markedIds);

    return markedIds;
  }

  /**
   * Delete (soft-delete or recall) a message.
   *
   * - `recallForEveryone = true`  → sender-only; sets `isDeleted = true` so
   *   all participants see "This message was deleted".
   * - `recallForEveryone = false` → hides the message for the requesting user
   *   only by adding their ID to `deletedFor`.
   */
  public async deleteMessage(conversationId: string, messageId: string, userId: string, recallForEveryone = false): Promise<void> {
    // Single query: verify both existence and conversation membership
    const [message, isMember] = await Promise.all([
      this.messages
        .findOne({
          _id: messageId,
          conversationId: new Types.ObjectId(conversationId),
        })
        .lean(),
      this.conversations.exists({
        _id: conversationId,
        participants: new Types.ObjectId(userId),
      }),
    ]);

    if (!message) throw new HttpException(404, 'Message not found');
    if (!isMember) throw new HttpException(403, 'Access denied');

    if (recallForEveryone) {
      if ((message as any).senderId.toString() !== userId) {
        throw new HttpException(403, 'Only the sender can recall a message for everyone');
      }
      await this.messages.updateOne({ _id: messageId }, { $set: { isDeleted: true, text: null, attachment: null } });
    } else {
      await this.messages.updateOne({ _id: messageId }, { $addToSet: { deletedFor: new Types.ObjectId(userId) } });
    }

    this.socket.emitChatMessageDeleted(conversationId, messageId, recallForEveryone);
  }

  // ─── Message editing ──────────────────────────────────────────────

  /**
   * Edit the text of a previously sent message.
   *
   * Rules:
   *  - Only the original sender may edit.
   *  - Only `contentType === 'text'` messages can be edited.
   *  - A 15-minute edit window is enforced (like Telegram/WhatsApp).
   *  - `editedAt` is set to signal to the UI that the content was changed.
   *  - If this message is the conversation's `lastMessage`, its preview is
   *    updated in the same round-trip.
   */
  public async editMessage(conversationId: string, messageId: string, userId: string, newText: string): Promise<any> {
    const message = await this.messages
      .findOne({
        _id: messageId,
        conversationId: new Types.ObjectId(conversationId),
        senderId: new Types.ObjectId(userId),
        isDeleted: false,
        contentType: 'text',
      })
      .lean();

    if (!message) throw new HttpException(404, 'Message not found or cannot be edited');

    const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    if (Date.now() - new Date((message as any).createdAt).getTime() > EDIT_WINDOW_MS) {
      throw new HttpException(403, 'Edit window has expired (15 minutes)');
    }

    const trimmed = newText.trim();

    // Parallel: update message + update conversation lastMessage preview (if applicable)
    const [updated] = await Promise.all([
      this.messages
        .findByIdAndUpdate(messageId, { $set: { text: trimmed, editedAt: new Date() } }, { new: true })
        .populate('senderId', SENDER_PROJECTION)
        .lean(),

      this.conversations.updateOne(
        { _id: conversationId, 'lastMessage.messageId': new Types.ObjectId(messageId) },
        { $set: { 'lastMessage.text': trimmed.slice(0, 80) } },
      ),
    ]);

    this.socket.emitChatMessageEdited(conversationId, updated);

    return updated;
  }

  // ─── Reactions ────────────────────────────────────────────────────

  /**
   * Toggle an emoji reaction on a message.
   *
   * Behaviour (mirrors Messenger / Slack):
   *  - No existing reaction from user → add.
   *  - Same emoji as existing reaction  → remove (toggle off).
   *  - Different emoji from existing    → replace.
   *
   * Returns the updated reactions array so the client can optimistically
   * reconcile without re-fetching the full message.
   */
  public async reactToMessage(conversationId: string, messageId: string, userId: string, emoji: string): Promise<any[]> {
    // Verify the user is a conversation participant
    const isMember = await this.conversations.exists({
      _id: conversationId,
      participants: new Types.ObjectId(userId),
    });
    if (!isMember) throw new HttpException(403, 'Access denied');

    const message = await this.messages
      .findOne({
        _id: messageId,
        conversationId: new Types.ObjectId(conversationId),
        isDeleted: false,
      })
      .lean();

    if (!message) throw new HttpException(404, 'Message not found');

    const reactions: any[] = (message as any).reactions ?? [];
    const existingIdx = reactions.findIndex((r: any) => r.userId.toString() === userId);

    let updated: any;

    if (existingIdx !== -1 && reactions[existingIdx].emoji === emoji) {
      // Toggle off — remove the reaction
      updated = await this.messages
        .findByIdAndUpdate(messageId, { $pull: { reactions: { userId: new Types.ObjectId(userId) } } }, { new: true })
        .select('reactions')
        .lean();
    } else if (existingIdx !== -1) {
      // Replace with new emoji
      updated = await this.messages
        .findByIdAndUpdate(
          messageId,
          {
            $set: {
              [`reactions.${existingIdx}.emoji`]: emoji,
              [`reactions.${existingIdx}.createdAt`]: new Date(),
            },
          },
          { new: true },
        )
        .select('reactions')
        .lean();
    } else {
      // Add new reaction
      updated = await this.messages
        .findByIdAndUpdate(
          messageId,
          {
            $push: {
              reactions: { userId: new Types.ObjectId(userId), emoji, createdAt: new Date() },
            },
          },
          { new: true },
        )
        .select('reactions')
        .lean();
    }

    const updatedReactions = updated?.reactions ?? [];
    this.socket.emitChatReaction(conversationId, messageId, userId, emoji, updatedReactions);

    return updatedReactions;
  }

  // ─── Search ───────────────────────────────────────────────────────

  /**
   * Full-text search across messages in a conversation.
   *
   * Uses MongoDB's `$text` operator backed by the sparse text index on the
   * `text` field.  Results are ranked by relevance score and then recency.
   *
   * Only `contentType === 'text'` messages are returned; the caller can use
   * a case-insensitive regex fallback if the text index is unavailable.
   */
  public async searchMessages(conversationId: string, userId: string, query: string, limit = 20): Promise<any[]> {
    const isMember = await this.conversations.exists({
      _id: conversationId,
      participants: new Types.ObjectId(userId),
    });
    if (!isMember) throw new HttpException(403, 'Access denied');

    return this.messages
      .find({
        conversationId: new Types.ObjectId(conversationId),
        deletedFor: { $ne: new Types.ObjectId(userId) },
        isDeleted: false,
        $text: { $search: query },
      })
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .limit(limit)
      .populate('senderId', SENDER_PROJECTION)
      .lean();
  }

  // ─── Typing indicator ─────────────────────────────────────────────

  /**
   * REST-proxied typing indicator.
   * Prefer sending `chat:typing` directly over Socket.IO from the client
   * to avoid the HTTP round-trip latency.  This method exists only as a
   * fallback for clients that cannot use WebSockets.
   */
  public broadcastTyping(conversationId: string, userId: string, isTyping: boolean): void {
    this.socket.emitChatTyping(conversationId, userId, isTyping);
  }
}

export default ChatService;
