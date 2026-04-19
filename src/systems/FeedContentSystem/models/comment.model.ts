import { model, Schema, Document } from 'mongoose';
import { Comment, ContentType } from '@systems/FeedContentSystem/interfaces/content.interface';

const commentSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, refPath: 'targetType' },
    targetType: { type: String, enum: Object.values(ContentType), required: true },
    text: { type: String, required: true, maxlength: 1000 },
    parentCommentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    likeCount: { type: Number, default: 0 },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

commentSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
commentSchema.index({ parentCommentId: 1, createdAt: 1 });
commentSchema.index({ authorId: 1, createdAt: -1 });

const commentModel = model<Comment & Document>('Comment', commentSchema);

export default commentModel;
