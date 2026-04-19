import { model, Schema, Document } from 'mongoose';
import { Product, ProductStatus, ProductCategory, ProductCondition } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

const productVariantSchema = new Schema(
  {
    sku: { type: String, default: '' },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    attributes: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const productImageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const productSchema: Schema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 5000, default: '' },
    category: { type: String, enum: Object.values(ProductCategory), required: true },
    tags: [{ type: String, trim: true }],
    images: [productImageSchema],
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'DZD', maxlength: 10 },
    variants: [productVariantSchema],
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, default: '' },
    status: { type: String, enum: Object.values(ProductStatus), default: ProductStatus.DRAFT },
    condition: { type: String, enum: Object.values(ProductCondition), default: ProductCondition.NEW },
    isDigital: { type: Boolean, default: false },
    weight: { type: Number, min: 0 },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },
    stats: {
      totalSold: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      viewCount: { type: Number, default: 0 },
      wishlistCount: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

productSchema.index({ storeId: 1, status: 1 });
productSchema.index({ slug: 1, storeId: 1 }, { unique: true });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ price: 1 });
productSchema.index({ 'stats.averageRating': -1 });
productSchema.index({ 'stats.totalSold': -1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

const productModel = model<Product & Document>('Product', productSchema);

export default productModel;
