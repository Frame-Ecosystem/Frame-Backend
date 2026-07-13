import { model, Schema, Document } from 'mongoose';
import { Like } from '@systems/FeedContentSystem/interfaces/like.interface';

const likeSchema = new Schema(
  {
    likerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    likerType: { type: String, enum: ['client', 'lounge', 'agent'], required: true },
    targetType: { type: String, enum: ['client', 'lounge', 'agent'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One like per liker per target
likeSchema.index({ likerId: 1, targetId: 1 }, { unique: true });

// Fast lookups: all likes for a target / all likes by a liker
likeSchema.index({ targetId: 1, createdAt: -1 });
likeSchema.index({ likerId: 1, createdAt: -1 });

// Filtered queries by type
likeSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
likeSchema.index({ likerId: 1, targetType: 1, createdAt: -1 });

const likeModel = model<Like & Document>('Like', likeSchema);

export default likeModel;
