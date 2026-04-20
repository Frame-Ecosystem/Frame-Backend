import { model, Schema, Document } from 'mongoose';
import {
  ProductCategorySuggestion,
  ProductCategorySuggestionStatus,
} from '@systems/MarketplaceSystem/interfaces/productCategory.interface';

const productCategorySuggestionSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    exampleProducts: [{ type: String, trim: true, maxlength: 200 }],
    iconHint: { type: String, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: Object.values(ProductCategorySuggestionStatus),
      default: ProductCategorySuggestionStatus.PENDING,
      required: true,
    },
    suggestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    implementedCategoryId: { type: Schema.Types.ObjectId, ref: 'ProductCategory' },
    adminNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

productCategorySuggestionSchema.index({ status: 1, createdAt: -1 });
productCategorySuggestionSchema.index({ suggestedBy: 1, createdAt: -1 });
productCategorySuggestionSchema.index({ name: 1 });

const productCategorySuggestionModel = model<ProductCategorySuggestion & Document>(
  'ProductCategorySuggestion',
  productCategorySuggestionSchema,
);

export default productCategorySuggestionModel;
