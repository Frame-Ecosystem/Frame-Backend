import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import ChatService from '@systems/ChatSystem/services/chat.service';
import { MessageContentType } from '@systems/ChatSystem/interfaces/chat.interface';
import r2Service from '@shared/services/cloudflareR2.service';

/**
 * ChatController — thin HTTP adapter.
 * All business logic lives in ChatService.
 */
class ChatController {
  private chatService = new ChatService();

  // ─── Conversations ────────────────────────────────────────────────

  /**
   * POST /v1/chat/conversations
   * Body: { recipientId }
   *
   * Finds or creates a 1-to-1 conversation with the given recipient.
   * Returns 201 when a new conversation is created, 200 for an existing one.
   */
  public startConversation = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user._id.toString();
      const { recipientId } = req.body;

      const { conversation, wasCreated } = await this.chatService.findOrCreateConversation(requesterId, recipientId);

      res.status(wasCreated ? 201 : 200).json({
        success: true,
        data: conversation,
        message: wasCreated ? 'Conversation created' : 'Conversation retrieved',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /v1/chat/conversations
   * Query: ?page=1&limit=20
   */
  public getConversations = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const { conversations, total } = await this.chatService.getConversations(userId, page, limit);

      res.status(200).json({
        success: true,
        data: conversations,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        message: 'Conversations retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /v1/chat/conversations/:id
   */
  public getConversation = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const conversation = await this.chatService.getConversationById(req.params.id, req.user._id.toString());
      res.status(200).json({ success: true, data: conversation, message: 'Conversation retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /v1/chat/conversations/:id
   * Soft-deletes the conversation for the requesting user only.
   */
  public deleteConversation = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.chatService.deleteConversation(req.params.id, req.user._id.toString());
      res.status(200).json({ success: true, message: 'Conversation removed from your inbox' });
    } catch (error) {
      next(error);
    }
  };

  // ─── Messages ─────────────────────────────────────────────────────

  /**
   * GET /v1/chat/conversations/:id/messages
   * Query: ?page=1&limit=50&before={messageId}
   *
   * In cursor mode (?before=…) the response includes `hasMore` instead of
   * `total`/`totalPages` to avoid an extra countDocuments round-trip.
   */
  public getMessages = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const conversationId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // cap at 100
      const before = req.query.before as string | undefined;

      const result = await this.chatService.getMessages(conversationId, userId, page, limit, before);

      const baseResponse = { success: true, data: result.messages, limit, message: 'Messages retrieved successfully' };

      if (before !== undefined) {
        // Cursor mode — return hasMore flag, no total
        res.status(200).json({ ...baseResponse, hasMore: result.hasMore });
      } else {
        // Offset mode — return total for numbered pagination
        res.status(200).json({
          ...baseResponse,
          total: result.total,
          page,
          totalPages: Math.ceil((result.total ?? 0) / limit),
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /v1/chat/conversations/:id/messages
   * Body (multipart/form-data or JSON):
   *   contentType: 'text' | 'image' | 'file' | 'audio'
   *   text?: string
   *   replyTo?: string   — _id of the parent message for threading
   *   file?: (multipart file upload for image/file/audio types)
   */
  public sendMessage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const senderId = req.user._id.toString();
      const conversationId = req.params.id;
      const contentType: MessageContentType = req.body.contentType || 'text';
      const text: string | undefined = req.body.text;
      const replyTo: string | undefined = req.body.replyTo;

      let attachment: { url: string; publicId: string; mimeType?: string; fileName?: string; sizeBytes?: number } | undefined;

      if (req.file && contentType !== 'text') {
        const uploadResult = await r2Service.uploadFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          `chat/${conversationId}`,
        );
        attachment = {
          url: uploadResult.url,
          publicId: uploadResult.key,
          mimeType: req.file.mimetype,
          fileName: req.file.originalname,
          sizeBytes: req.file.size,
        };
      }

      const message = await this.chatService.sendMessage(conversationId, senderId, contentType, text, attachment, replyTo);

      res.status(201).json({ success: true, data: message, message: 'Message sent' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /v1/chat/conversations/:id/messages/:msgId
   * Body: { text: string }
   *
   * Edits the text of a message the requesting user sent.
   * Only plain-text messages within the 15-minute edit window can be edited.
   */
  public editMessage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { id: conversationId, msgId: messageId } = req.params;
      const { text } = req.body;

      const updated = await this.chatService.editMessage(conversationId, messageId, userId, text);

      res.status(200).json({ success: true, data: updated, message: 'Message edited' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /v1/chat/conversations/:id/messages/:msgId/reactions
   * Body: { emoji: string }
   *
   * Toggles an emoji reaction on a message.
   * Same emoji → removes; different emoji → replaces; none → adds.
   */
  public reactToMessage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { id: conversationId, msgId: messageId } = req.params;
      const { emoji } = req.body;

      const reactions = await this.chatService.reactToMessage(conversationId, messageId, userId, emoji);

      res.status(200).json({ success: true, data: { reactions }, message: 'Reaction updated' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /v1/chat/conversations/:id/messages/search
   * Query: ?q=…&limit=20
   *
   * Full-text search across messages in a conversation.
   * Results are sorted by relevance and then recency.
   */
  public searchMessages = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const conversationId = req.params.id;
      const query = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const messages = await this.chatService.searchMessages(conversationId, userId, query, limit);

      res.status(200).json({ success: true, data: messages, message: 'Search completed' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /v1/chat/conversations/:id/messages/read
   * Body: { messageIds?: string[] }   — omit to mark all unread messages as read.
   */
  public markMessagesRead = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const readIds = await this.chatService.markMessagesRead(req.params.id, req.user._id.toString(), req.body.messageIds);
      res.status(200).json({ success: true, data: { readMessageIds: readIds }, message: 'Messages marked as read' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /v1/chat/conversations/:id/messages/:msgId
   * Body: { recallForEveryone?: boolean }
   */
  public deleteMessage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { recallForEveryone } = req.body;
      await this.chatService.deleteMessage(req.params.id, req.params.msgId, req.user._id.toString(), !!recallForEveryone);
      res.status(200).json({ success: true, message: recallForEveryone ? 'Message recalled for everyone' : 'Message removed from your view' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /v1/chat/conversations/:id/typing
   * Body: { isTyping: boolean }
   *
   * REST-proxied typing indicator (fallback for clients that cannot use WebSockets).
   * Prefer sending `chat:typing` directly over Socket.IO to avoid HTTP round-trip latency.
   */
  public broadcastTyping = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { isTyping } = req.body;
      this.chatService.broadcastTyping(req.params.id, req.user._id.toString(), !!isTyping);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}

export default ChatController;

