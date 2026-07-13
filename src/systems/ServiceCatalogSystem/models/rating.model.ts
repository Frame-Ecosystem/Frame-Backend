import { model, Schema, Document } from 'mongoose';
import { Rating } from '@systems/ServiceCatalogSystem/interfaces/rating.interface';

const ratingSchema = new Schema(
  {
    raterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raterType: { type: String, enum: ['client', 'lounge', 'agent'], required: true },
    targetType: { type: String, enum: ['client', 'lounge', 'agent'], required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: false, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// One rating per rater per target — upsert-friendly unique constraint
ratingSchema.index({ raterId: 1, targetId: 1 }, { unique: true });

// Fast lookups for "all ratings of a target"
ratingSchema.index({ targetId: 1, createdAt: -1 });

// Filtered queries by rater/target type
ratingSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
ratingSchema.index({ raterId: 1, targetType: 1, createdAt: -1 });

const ratingModel = model<Rating & Document>('Rating', ratingSchema);

export default ratingModel;
