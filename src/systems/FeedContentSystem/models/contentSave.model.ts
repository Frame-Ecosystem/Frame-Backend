import { model, Schema, Document } from 'mongoose';
import { ContentSave, ContentType } from '@systems/FeedContentSystem/interfaces/content.interface';

const contentSaveSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: Object.values(ContentType), required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One save per user per target
contentSaveSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
contentSaveSchema.index({ userId: 1, targetType: 1, createdAt: -1 });
contentSaveSchema.index({ targetId: 1, targetType: 1 });

const contentSaveModel = model<ContentSave & Document>('ContentSave', contentSaveSchema);

export default contentSaveModel;
