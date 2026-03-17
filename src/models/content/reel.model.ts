import { model, Schema, Document } from 'mongoose';
import { Reel, AuthorType } from '@interfaces/content/content.interface';

const reelSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorType: { type: String, enum: Object.values(AuthorType), required: true },
    caption: { type: String, maxlength: 2200, default: '' },
    videoUrl: { type: String, required: true },
    videoPublicId: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    thumbnailPublicId: { type: String, default: '' },
    duration: { type: Number, required: true, min: 1, max: 60 },
    hashtags: { type: [String], default: [] },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

reelSchema.index({ authorId: 1, createdAt: -1 });
reelSchema.index({ hashtags: 1, createdAt: -1 });
reelSchema.index({ createdAt: -1 });
reelSchema.index({ isHidden: 1 });

const reelModel = model<Reel & Document>('Reel', reelSchema);

export default reelModel;
