import { model, Schema, Document } from 'mongoose';
import { Rating } from '@interfaces/rating/rating.interface';

const ratingSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    loungeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: false, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// One rating per client per lounge — upsert-friendly unique constraint
ratingSchema.index({ clientId: 1, loungeId: 1 }, { unique: true });

// Fast lookups for "all ratings of a lounge"
ratingSchema.index({ loungeId: 1, createdAt: -1 });

const ratingModel = model<Rating & Document>('Rating', ratingSchema);

export default ratingModel;
