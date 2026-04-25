import { model, Schema, Document } from 'mongoose';
import { Notification, NotificationType, NotificationCategory } from '@systems/NotificationSystem/interfaces/notification.interface';

export interface NotificationDocument extends Omit<Notification, '_id'>, Document {}

const notificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(NotificationCategory),
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      // Booking / Queue
      bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: false },
      loungeId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
      clientId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
      agentId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
      // Content
      postId: { type: Schema.Types.ObjectId, ref: 'Post', required: false },
      reelId: { type: Schema.Types.ObjectId, ref: 'Reel', required: false },
      commentId: { type: Schema.Types.ObjectId, ref: 'Comment', required: false },
      targetType: { type: String, enum: ['post', 'reel', 'comment'], required: false },
      // Social
      followerId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
      ratingScore: { type: Number, required: false },
      // Admin
      suggestionId: { type: Schema.Types.ObjectId, ref: 'ServiceSuggestion', required: false },
      reason: { type: String, required: false },
    },
    actionUrl: {
      type: String,
      required: false,
    },
    imageUrl: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

// Fast lookup: user's notifications sorted by newest
notificationSchema.index({ userId: 1, createdAt: -1 });
// Filter by category
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
// Filter unread per user
notificationSchema.index({ userId: 1, isRead: 1 });
// Cleanup: TTL index to auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
// De-duplication guard: prevent spammy repeat notifications
notificationSchema.index({ userId: 1, actorId: 1, type: 1, 'metadata.postId': 1 }, { sparse: true });
notificationSchema.index({ userId: 1, actorId: 1, type: 1, 'metadata.commentId': 1 }, { sparse: true });

const notificationModel = model<NotificationDocument>('Notification', notificationSchema);

export default notificationModel;
