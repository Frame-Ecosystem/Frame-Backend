import { IsOptional, IsMongoId, IsNumber, Min, Max, IsString, IsIn, IsNotEmpty, MaxLength, MinLength, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { MessageContentType } from '@systems/ChatSystem/interfaces/chat.interface';

/* ------------------------------------------------------------------ */
/*  Conversation DTOs                                                  */
/* ------------------------------------------------------------------ */

/** POST /v1/chat/conversations — find or create a 1-to-1 DM. */
export class CreateConversationDto {
  @IsMongoId({ message: 'recipientId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'recipientId is required' })
  public recipientId: string;
}

/** GET /v1/chat/conversations (query params) */
export class GetConversationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  public page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  public limit?: number;
}

/* ------------------------------------------------------------------ */
/*  Message DTOs                                                       */
/* ------------------------------------------------------------------ */

/** POST /v1/chat/conversations/:id/messages — send a message. */
export class SendMessageDto {
  @IsIn(['text', 'image', 'file', 'audio'] as MessageContentType[], {
    message: 'contentType must be text, image, file, or audio',
  })
  public contentType: MessageContentType = 'text';

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'text must not be an empty string when provided' })
  @MaxLength(4000, { message: 'text must not exceed 4000 characters' })
  public text?: string;

  /**
   * Optional: the `_id` of the message this is replying to.
   * When present the server validates it belongs to the same conversation.
   */
  @IsOptional()
  @IsMongoId({ message: 'replyTo must be a valid MongoDB ObjectId' })
  public replyTo?: string;

  // Attachment fields are injected by the upload middleware (req.file).
}

/** GET /v1/chat/conversations/:id/messages (query params) */
export class GetMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  public page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  public limit?: number;

  /** Cursor-based: fetch messages older than this message ID. */
  @IsOptional()
  @IsMongoId({ message: 'before must be a valid MongoDB ObjectId' })
  public before?: string;
}

/** PATCH /v1/chat/conversations/:id/messages/read — mark messages read. */
export class MarkMessagesReadDto {
  /**
   * Specific message IDs to mark as read.
   * Omit to mark all unread messages in the conversation as read.
   */
  @IsOptional()
  @IsMongoId({ each: true, message: 'Each messageId must be a valid MongoDB ObjectId' })
  public messageIds?: string[];
}

/** DELETE /v1/chat/conversations/:id/messages/:msgId — soft-delete options */
export class DeleteMessageDto {
  /**
   * When `true`, the message is recalled for ALL participants (sender only).
   * When `false` (default), the message is hidden only for the requesting user.
   */
  @IsOptional()
  @IsBoolean()
  public recallForEveryone?: boolean;
}

/** PATCH /v1/chat/conversations/:id/messages/:msgId — edit a text message. */
export class EditMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'text is required' })
  @MaxLength(4000, { message: 'text must not exceed 4000 characters' })
  public text: string;
}

/**
 * POST /v1/chat/conversations/:id/messages/:msgId/reactions
 * Toggle an emoji reaction on a message.
 * Sending the same emoji the user already placed removes the reaction.
 */
export class ReactToMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'emoji is required' })
  @MinLength(1)
  @MaxLength(8, { message: 'emoji must be 1–8 characters' })
  public emoji: string;
}

/** GET /v1/chat/conversations/:id/messages/search (query params) */
export class SearchMessagesDto {
  @IsString()
  @IsNotEmpty({ message: 'q is required' })
  @MaxLength(200, { message: 'Search query must not exceed 200 characters' })
  public q: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  public limit?: number;
}
