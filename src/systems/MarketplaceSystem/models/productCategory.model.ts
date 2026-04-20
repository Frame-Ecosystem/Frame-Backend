import { model, Schema, Document } from 'mongoose';
import { ProductCategory } from '@systems/MarketplaceSystem/interfaces/productCategory.interface';

const productCategorySchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    icon: { type: String, trim: true, maxlength: 100 },
    image: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    productCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

productCategorySchema.index({ slug: 1 }, { unique: true });
productCategorySchema.index({ isActive: 1, displayOrder: 1 });
productCategorySchema.index({ name: 'text', description: 'text' });

const productCategoryModel = model<ProductCategory & Document>('ProductCategory', productCategorySchema);

export default productCategoryModel;
