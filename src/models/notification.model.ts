import { model, Schema, Document } from 'mongoose';
import { Notification, NotificationType } from '@interfaces/notification.interface';

export interface NotificationDocument extends Omit<Notification, '_id'>, Document {}

const notificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: false },
      loungeId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
      clientId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
      agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: false },
    },
  },
  {
    timestamps: true,
  },
);

// Fast lookup: user's notifications sorted by newest
notificationSchema.index({ userId: 1, createdAt: -1 });
// Cleanup: TTL index to auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const notificationModel = model<NotificationDocument>('Notification', notificationSchema);

export default notificationModel;
