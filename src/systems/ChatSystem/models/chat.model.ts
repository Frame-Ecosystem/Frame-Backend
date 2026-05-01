import { Schema, model, Document, Model } from 'mongoose';
import { Message, MessageContentType, Conversation } from '@systems/ChatSystem/interfaces/chat.interface';

/* ================================================================== */
/*  Message                                                            */
/* ================================================================== */

export type MessageDocument = Message & Document;

const readReceiptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    mimeType: { type: String },
    fileName: { type: String },
    sizeBytes: { type: Number },
  },
  { _id: false },
);

const reactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, maxlength: 8 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const messageSchema = new Schema<MessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId as any,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: true,
    },
    contentType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio'] as MessageContentType[],
      required: true,
      default: 'text',
    },
    text: {
      type: String,
      maxlength: 4000,
      trim: true,
    },
    attachment: attachmentSchema,
    /**
     * The _id of the message this is replying to.
     * Stored as a plain ObjectId (not a populate-ref) to avoid
     * deep population chains.  The client resolves the preview
     * from its local cache; the API exposes it in the payload.
     */
    replyTo: {
      type: Schema.Types.ObjectId as any,
      ref: 'Message',
      default: null,
    },
    reactions: { type: [reactionSchema], default: [] },
    readBy: { type: [readReceiptSchema], default: [] },
    deletedFor: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }] as any,
      default: [],
    },
    isDeleted: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ─── Message indexes ──────────────────────────────────────────────────────────

/**
 * Primary access pattern: fetch messages for a conversation newest-first.
 * Used by getMessages() and cursor-based pagination.
 */
messageSchema.index({ conversationId: 1, createdAt: -1 });

/**
 * Sender index: "all messages I sent in this conversation" (edit / delete validation).
 */
messageSchema.index({ senderId: 1, conversationId: 1 });

/**
 * Soft-delete filter: allows efficient queries that exclude per-user soft-deleted messages.
 */
messageSchema.index({ conversationId: 1, deletedFor: 1 });

/**
 * Text index for message search within a conversation.
 * Covers the `text` field only; attachment filenames are not searched.
 */
messageSchema.index({ text: 'text' }, { sparse: true });

// ─────────────────────────────────────────────────────────────────────────────

const messageModel: Model<MessageDocument> = model<MessageDocument>('Message', messageSchema);

/* ================================================================== */
/*  Conversation                                                       */
/* ================================================================== */

export type ConversationDocument = Conversation & Document;

const lastMessageSummarySchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, maxlength: 80 },
    contentType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio'],
      default: 'text',
    },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const unreadCountEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const conversationSchema = new Schema<ConversationDocument>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }] as any,
      required: true,
      validate: {
        validator: (v: any[]) => v.length === 2,
        message: 'A conversation must have exactly 2 participants',
      },
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    lastMessage: lastMessageSummarySchema,
    unreadCounts: { type: [unreadCountEntrySchema], default: [] },
    isArchived: { type: Boolean, default: false },
    deletedFor: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }] as any,
      default: [],
    },
  },
  { timestamps: true },
);

// ─── Conversation indexes ─────────────────────────────────────────────────────

/**
 * Primary access pattern: load all conversations for a user sorted newest-first.
 * Used by getConversations().
 */
conversationSchema.index({ participants: 1, updatedAt: -1 });

/**
 * NOTE: We intentionally do NOT create a compound index on
 * { participants: 1, deletedFor: 1 } because MongoDB rejects
 * compound indexes on two array fields ("cannot index parallel arrays").
 * Soft-delete filtering is handled in-query and is cheap because
 * `deletedFor` is small (max 2 users per conversation).
 */

// ─────────────────────────────────────────────────────────────────────────────

const conversationModel: Model<ConversationDocument> = model<ConversationDocument>('Conversation', conversationSchema);

export { messageModel, conversationModel };
