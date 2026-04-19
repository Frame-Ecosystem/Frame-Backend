import { model, Schema, Document } from 'mongoose';
import { Hashtag } from '@interfaces/content/content.interface';

const hashtagSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    postCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

hashtagSchema.index({ name: 1 });
hashtagSchema.index({ postCount: -1 });

const hashtagModel = model<Hashtag & Document>('Hashtag', hashtagSchema);

export default hashtagModel;
