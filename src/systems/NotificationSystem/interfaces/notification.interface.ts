/* ------------------------------------------------------------------ */
/*  Notification Categories                                            */
/* ------------------------------------------------------------------ */

export enum NotificationCategory {
  BOOKING = 'booking',
  QUEUE = 'queue',
  SOCIAL = 'social',
  CONTENT = 'content',
  ADMIN = 'admin',
  SYSTEM = 'system',
  CHAT = 'chat',
}

/* ------------------------------------------------------------------ */
/*  Notification Types                                                 */
/* ------------------------------------------------------------------ */

export enum NotificationType {
  // ── Booking ─────────────────────────────────────────────────────
  BOOKING_CREATED = 'booking:created',
  BOOKING_CONFIRMED = 'booking:confirmed',
  BOOKING_CANCELLED = 'booking:cancelled',
  BOOKING_IN_QUEUE = 'booking:inQueue',
  BOOKING_COMPLETED = 'booking:completed',
  BOOKING_ABSENT = 'booking:absent',

  // ── Queue ───────────────────────────────────────────────────────
  QUEUE_IN_SERVICE = 'queue:inService',
  QUEUE_AUTO_CANCELLED = 'queue:autoCancelled',
  QUEUE_BACK_IN_QUEUE = 'queue:backInQueue',
  QUEUE_REMINDER = 'queue:reminder',
  QUEUE_POSITION_CHANGED = 'queue:positionChanged',

  // ── Content ─────────────────────────────────────────────────────
  POST_LIKED = 'content:postLiked',
  POST_COMMENTED = 'content:postCommented',
  COMMENT_REPLIED = 'content:commentReplied',
  COMMENT_LIKED = 'content:commentLiked',
  REEL_LIKED = 'content:reelLiked',
  REEL_COMMENTED = 'content:reelCommented',

  // ── Social ──────────────────────────────────────────────────────
  NEW_FOLLOWER = 'social:newFollower',
  LOUNGE_LIKED = 'social:loungeLiked',
  AGENT_LIKED = 'social:agentLiked',
  LOUNGE_RATED = 'social:loungeRated',
  AGENT_RATED = 'social:agentRated',

  // ── Admin / Moderation ──────────────────────────────────────────
  SUGGESTION_CREATED = 'admin:suggestionCreated',
  SUGGESTION_APPROVED = 'admin:suggestionApproved',
  SUGGESTION_REJECTED = 'admin:suggestionRejected',
  CONTENT_HIDDEN = 'admin:contentHidden',

  // ── Marketplace · Category Suggestions ─────────────────────────
  PRODUCT_CATEGORY_SUGGESTION_CREATED = 'admin:productCategorySuggestionCreated',
  PRODUCT_CATEGORY_SUGGESTION_APPROVED = 'admin:productCategorySuggestionApproved',
  PRODUCT_CATEGORY_SUGGESTION_REJECTED = 'admin:productCategorySuggestionRejected',

  // ── Chat ────────────────────────────────────────────────────────
  CHAT_MESSAGE = 'chat:message',
}

/* ------------------------------------------------------------------ */
/*  Category Mapping                                                   */
/* ------------------------------------------------------------------ */

export const NOTIFICATION_CATEGORY_MAP: Record<NotificationType, NotificationCategory> = {
  // Booking
  [NotificationType.BOOKING_CREATED]: NotificationCategory.BOOKING,
  [NotificationType.BOOKING_CONFIRMED]: NotificationCategory.BOOKING,
  [NotificationType.BOOKING_CANCELLED]: NotificationCategory.BOOKING,
  [NotificationType.BOOKING_IN_QUEUE]: NotificationCategory.BOOKING,
  [NotificationType.BOOKING_COMPLETED]: NotificationCategory.BOOKING,
  [NotificationType.BOOKING_ABSENT]: NotificationCategory.BOOKING,
  // Queue
  [NotificationType.QUEUE_IN_SERVICE]: NotificationCategory.QUEUE,
  [NotificationType.QUEUE_AUTO_CANCELLED]: NotificationCategory.QUEUE,
  [NotificationType.QUEUE_BACK_IN_QUEUE]: NotificationCategory.QUEUE,
  [NotificationType.QUEUE_REMINDER]: NotificationCategory.QUEUE,
  [NotificationType.QUEUE_POSITION_CHANGED]: NotificationCategory.QUEUE,
  // Content
  [NotificationType.POST_LIKED]: NotificationCategory.CONTENT,
  [NotificationType.POST_COMMENTED]: NotificationCategory.CONTENT,
  [NotificationType.COMMENT_REPLIED]: NotificationCategory.CONTENT,
  [NotificationType.COMMENT_LIKED]: NotificationCategory.CONTENT,
  [NotificationType.REEL_LIKED]: NotificationCategory.CONTENT,
  [NotificationType.REEL_COMMENTED]: NotificationCategory.CONTENT,
  // Social
  [NotificationType.NEW_FOLLOWER]: NotificationCategory.SOCIAL,
  [NotificationType.LOUNGE_LIKED]: NotificationCategory.SOCIAL,
  [NotificationType.AGENT_LIKED]: NotificationCategory.SOCIAL,
  [NotificationType.LOUNGE_RATED]: NotificationCategory.SOCIAL,
  [NotificationType.AGENT_RATED]: NotificationCategory.SOCIAL,
  // Admin
  [NotificationType.SUGGESTION_CREATED]: NotificationCategory.ADMIN,
  [NotificationType.SUGGESTION_APPROVED]: NotificationCategory.ADMIN,
  [NotificationType.SUGGESTION_REJECTED]: NotificationCategory.ADMIN,
  [NotificationType.CONTENT_HIDDEN]: NotificationCategory.ADMIN,
  [NotificationType.PRODUCT_CATEGORY_SUGGESTION_CREATED]: NotificationCategory.ADMIN,
  [NotificationType.PRODUCT_CATEGORY_SUGGESTION_APPROVED]: NotificationCategory.ADMIN,
  [NotificationType.PRODUCT_CATEGORY_SUGGESTION_REJECTED]: NotificationCategory.ADMIN,
  // Chat
  [NotificationType.CHAT_MESSAGE]: NotificationCategory.CHAT,
};

/* ------------------------------------------------------------------ */
/*  Notification Metadata                                              */
/* ------------------------------------------------------------------ */

export interface NotificationMetadata {
  // Booking / Queue
  bookingId?: string;
  loungeId?: string;
  clientId?: string;
  agentId?: string;

  // Content
  postId?: string;
  reelId?: string;
  commentId?: string;
  targetType?: 'post' | 'reel' | 'comment';

  // Social
  followerId?: string;
  actorId?: string;
  ratingScore?: number;

  // Admin
  suggestionId?: string;
  reason?: string;

  // Chat
  conversationId?: string;
  messageId?: string;
}

/* ------------------------------------------------------------------ */
/*  Notification Document                                              */
/* ------------------------------------------------------------------ */

export interface Notification {
  _id?: string;
  userId: string;
  actorId?: string;
  title: string;
  body: string;
  type: NotificationType;
  category: NotificationCategory;
  isRead: boolean;
  metadata: NotificationMetadata;
  /** URL path the frontend should navigate to when tapped. */
  actionUrl?: string;
  /** Optional thumbnail for rich display (actor's profile image). */
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
