import { model, Schema, Document } from 'mongoose';
import { Wishlist } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

const wishlistSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true },
);

wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });
wishlistSchema.index({ userId: 1, createdAt: -1 });

const wishlistModel = model<Wishlist & Document>('Wishlist', wishlistSchema);

export default wishlistModel;
