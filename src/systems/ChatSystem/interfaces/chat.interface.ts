/**
 * ChatSystem — core domain interfaces.
 *
 * Architecture decisions:
 *  - 1-to-1 DM only; group chat is out of scope for this system.
 *  - A **Conversation** is the authoritative container.  Messages live in a
 *    separate collection for horizontal scalability and cheap pagination.
 *  - Participants are stored as a sorted, de-duplicated pair of ObjectIds so
 *    that a compound index `{ participants: 1 }` supports fast membership checks.
 *  - A stable `slug` (`[...ids].sort().join('_')`) enables a single atomic
 *    upsert to find-or-create without a race condition.
 *  - Messages carry a `readBy` array (userId + timestamp) instead of a boolean
 *    so the UI can render "Seen at 14:32" receipts.
 *  - Reactions are stored inline on the message document (small, bounded array).
 *  - `replyTo` holds the referenced message _id so clients can render a
 *    quoted-message preview without an extra round-trip.
 *  - `editedAt` is set whenever the sender edits a text message.
 *  - Soft-delete (`deletedFor`) lets each participant hide a message or
 *    conversation on their own side without affecting the other participant.
 */

/* ------------------------------------------------------------------ */
/*  Participant types                                                   */
/* ------------------------------------------------------------------ */

/**
 * Every authenticated user role that may initiate or participate in a
 * conversation.  Agents are included so they can chat with clients.
 */
export type ChatParticipantType = 'client' | 'lounge' | 'admin' | 'agent';

/* ------------------------------------------------------------------ */
/*  Message                                                            */
/* ------------------------------------------------------------------ */

/** Supported content types for messages. */
export type MessageContentType = 'text' | 'image' | 'file' | 'audio';

/**
 * A single emoji reaction placed by one user on a message.
 * One user may only have one active reaction per message.
 * Setting the same emoji again toggles it off.
 */
export interface MessageReaction {
  /** The user who reacted. */
  userId: string;
  /** Unicode emoji character(s), e.g. "👍", "❤️", "😂". */
  emoji: string;
  createdAt: Date;
}

/** Per-user read receipt stored inside a message document. */
export interface ReadReceipt {
  userId: string;
  readAt: Date;
}

/** Metadata for an uploaded file attached to a message. */
export interface MessageAttachment {
  url: string;
  publicId: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
}

export interface Message {
  _id?: string;
  /** Parent conversation. */
  conversationId: string;
  /** The user who sent this message. */
  senderId: string;
  contentType: MessageContentType;
  /** Present when `contentType === 'text'`. Max 4 000 characters. */
  text?: string;
  /** Present when `contentType === 'image' | 'file' | 'audio'`. */
  attachment?: MessageAttachment;
  /**
   * The `_id` of the message this is replying to.
   * Used by the UI to render a quoted-message preview.
   */
  replyTo?: string;
  /** Emoji reactions placed on this message. */
  reactions: MessageReaction[];
  /** Users (other than sender) who have read this message. */
  readBy: ReadReceipt[];
  /** User IDs for whom this message is hidden (per-user soft-delete). */
  deletedFor: string[];
  /** `true` when the sender recalls the message for all participants. */
  isDeleted: boolean;
  /** Set to the time of the last edit when the sender edits the text. */
  editedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Conversation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Denormalized last-message preview stored on the conversation document.
 * Allows the conversation-list UI to render inbox previews without joining
 * the messages collection.
 */
export interface LastMessageSummary {
  messageId: string;
  senderId: string;
  /** Truncated preview — max 80 characters. */
  text?: string;
  contentType: MessageContentType;
  createdAt: Date;
}

/** Per-user unread message count embedded in the conversation document. */
export interface UnreadCount {
  userId: string;
  count: number;
}

export interface Conversation {
  _id?: string;
  /**
   * Exactly two participants (1-to-1 DM).
   * Stored sorted ascending so `slug` is deterministic regardless of who
   * initiates the conversation.
   */
  participants: string[];
  /**
   * Stable lookup key: `[...participantIds].sort().join('_')`.
   * A unique index on this field prevents duplicate DMs between the same
   * pair and makes find-or-create an atomic single-query upsert.
   */
  slug: string;
  /** Denormalized last-message preview for inbox rendering. */
  lastMessage?: LastMessageSummary;
  /** Count of unread messages for each participant. */
  unreadCounts: UnreadCount[];
  /** Each participant archives independently; `true` hides from their inbox. */
  isArchived: boolean;
  /** Participant IDs who have soft-deleted this conversation from their inbox. */
  deletedFor: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
