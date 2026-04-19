import { model, Schema, Document } from 'mongoose';
import { ProductReview, ReviewStatus } from '@interfaces/marketplace/marketplace.interface';

const reviewImageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const reviewSchema: Schema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 200, default: '' },
    comment: { type: String, maxlength: 2000, default: '' },
    images: [reviewImageSchema],
    isVerifiedPurchase: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(ReviewStatus), default: ReviewStatus.ACTIVE },
    helpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ storeId: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ rating: 1 });

const reviewModel = model<ProductReview & Document>('ProductReview', reviewSchema);

export default reviewModel;
