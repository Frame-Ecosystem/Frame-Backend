import { model, Schema, Document } from 'mongoose';
import { Post, AuthorType } from '@systems/FeedContentSystem/interfaces/content.interface';

const postMediaSchema = new Schema({ url: { type: String, required: true }, publicId: { type: String, required: true } }, { _id: false });

const postSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorType: { type: String, enum: Object.values(AuthorType), required: true },
    text: { type: String, maxlength: 2200, default: '' },
    media: { type: [postMediaSchema], default: [] },
    hashtags: { type: [String], default: [] },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ hashtags: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ isHidden: 1 });

const postModel = model<Post & Document>('Post', postSchema);

export default postModel;
