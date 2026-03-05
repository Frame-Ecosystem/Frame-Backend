import { model, Schema, Document } from 'mongoose';
import { Queue, QueuePersonStatus } from '@interfaces/queue.interface';

export interface QueueDocument extends Omit<Queue, '_id'>, Document {}

const queuePersonSchema: Schema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    position: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(QueuePersonStatus),
      default: QueuePersonStatus.WAITING,
      required: true,
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const queueSchema: Schema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    persons: {
      type: [queuePersonSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index: one queue per agent per day
queueSchema.index({ agentId: 1, date: 1 }, { unique: true });
// Fast lookup by date (for daily population jobs)
queueSchema.index({ date: 1 });

const queueModel = model<QueueDocument>('Queue', queueSchema);

export default queueModel;
