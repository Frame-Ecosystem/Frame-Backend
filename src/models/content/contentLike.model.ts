import { model, Schema, Document } from 'mongoose';
import { ContentLike } from '@interfaces/content/content.interface';

const contentLikeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ['post', 'reel', 'comment'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One like per user per target
contentLikeSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
contentLikeSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
contentLikeSchema.index({ userId: 1, createdAt: -1 });

const contentLikeModel = model<ContentLike & Document>('ContentLike', contentLikeSchema);

export default contentLikeModel;
