import { model, Schema, Document } from 'mongoose';
import { Cart } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    variantIndex: { type: Number },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
  },
  { timestamps: true },
);

cartSchema.index({ userId: 1 }, { unique: true });

const cartModel = model<Cart & Document>('Cart', cartSchema);

export default cartModel;
