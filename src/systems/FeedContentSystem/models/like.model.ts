import { model, Schema, Document } from 'mongoose';
import { Like } from '@systems/FeedContentSystem/interfaces/like.interface';

const likeSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    loungeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One like per client per lounge
likeSchema.index({ clientId: 1, loungeId: 1 }, { unique: true });

// Fast lookups: all likes for a lounge / all likes by a client
likeSchema.index({ loungeId: 1, createdAt: -1 });
likeSchema.index({ clientId: 1, createdAt: -1 });

const likeModel = model<Like & Document>('Like', likeSchema);

export default likeModel;
