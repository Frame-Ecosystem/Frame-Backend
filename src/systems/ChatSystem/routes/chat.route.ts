import { Router } from 'express';
import ChatController from '@systems/ChatSystem/controllers/chat.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { optionalUpload } from '@middlewares/imageUpload.middleware';
import { generalRateLimiter } from '@middlewares/rateLimit.middleware';
import {
  CreateConversationDto,
  GetConversationsDto,
  GetMessagesDto,
  SendMessageDto,
  MarkMessagesReadDto,
  DeleteMessageDto,
  EditMessageDto,
  ReactToMessageDto,
  SearchMessagesDto,
} from '@systems/ChatSystem/dtos/chat.dto';

/**
 * ChatRoute — all endpoints require authentication.
 * No additional role guard: any authenticated user type may use the chat.
 *
 * REST surface:
 *
 * POST   /v1/chat/conversations                                    → find-or-create DM
 * GET    /v1/chat/conversations                                    → list my conversations
 * GET    /v1/chat/conversations/:id                                → get single conversation
 * DELETE /v1/chat/conversations/:id                                → soft-delete conversation
 * GET    /v1/chat/conversations/:id/messages                       → get messages (paginated)
 * GET    /v1/chat/conversations/:id/messages/search                → full-text search
 * POST   /v1/chat/conversations/:id/messages                       → send message
 * PATCH  /v1/chat/conversations/:id/messages/read                  → mark messages as read
 * PATCH  /v1/chat/conversations/:id/messages/:msgId                → edit a message
 * POST   /v1/chat/conversations/:id/messages/:msgId/reactions      → toggle reaction
 * DELETE /v1/chat/conversations/:id/messages/:msgId                → delete/recall a message
 * POST   /v1/chat/conversations/:id/typing                         → REST typing indicator proxy
 *
 * Room naming convention (Socket.IO):
 *   chat:{conversationId}   → participants subscribe to receive messages in real-time
 *
 * Socket events emitted by this system:
 *   chat:message              → new message delivered to the room
 *   chat:message:deleted      → message recalled / hidden
 *   chat:message:edited       → message text updated
 *   chat:reaction             → emoji reaction toggled
 *   chat:read                 → read receipts updated
 *   chat:typing               → typing indicator (isTyping: boolean)
 *   chat:conversation:updated → inbox preview refresh (emitted to notifications:{userId})
 */
class ChatRoute implements Routes {
  public path = '/v1/chat';
  public router = Router();
  private chatController = new ChatController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // All chat routes require a valid JWT
    this.router.use(authMiddleware);

    // ── Conversations ───────────────────────────────────────────────
    this.router.post(
      '/conversations',
      validationMiddleware(CreateConversationDto),
      this.chatController.startConversation,
    );

    this.router.get(
      '/conversations',
      validationMiddleware(GetConversationsDto, 'query', true),
      this.chatController.getConversations,
    );

    this.router.get('/conversations/:id', this.chatController.getConversation);

    this.router.delete('/conversations/:id', this.chatController.deleteConversation);

    // ── Messages ────────────────────────────────────────────────────
    //
    // IMPORTANT: Static path segments (/read, /search) MUST be registered
    // BEFORE parameterised routes (/:msgId) so Express does not treat the
    // static segment as a message ID value.

    this.router.patch(
      '/conversations/:id/messages/read',
      validationMiddleware(MarkMessagesReadDto, 'body', true),
      this.chatController.markMessagesRead,
    );

    this.router.get(
      '/conversations/:id/messages/search',
      validationMiddleware(SearchMessagesDto, 'query', true),
      this.chatController.searchMessages,
    );

    this.router.get(
      '/conversations/:id/messages',
      validationMiddleware(GetMessagesDto, 'query', true),
      this.chatController.getMessages,
    );

    this.router.post(
      '/conversations/:id/messages',
      generalRateLimiter,                              // 100 req / 15 min per IP
      optionalUpload('file'),                          // handles multipart for image/file/audio uploads
      validationMiddleware(SendMessageDto, 'body', true),
      this.chatController.sendMessage,
    );

    this.router.patch(
      '/conversations/:id/messages/:msgId',
      validationMiddleware(EditMessageDto),
      this.chatController.editMessage,
    );

    this.router.post(
      '/conversations/:id/messages/:msgId/reactions',
      validationMiddleware(ReactToMessageDto),
      this.chatController.reactToMessage,
    );

    this.router.delete(
      '/conversations/:id/messages/:msgId',
      validationMiddleware(DeleteMessageDto, 'body', true),
      this.chatController.deleteMessage,
    );

    // ── Typing indicator (REST proxy) ───────────────────────────────
    this.router.post('/conversations/:id/typing', this.chatController.broadcastTyping);
  }
}

export default ChatRoute;

