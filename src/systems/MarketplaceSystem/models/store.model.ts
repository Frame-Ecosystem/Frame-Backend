import { model, Schema, Document } from 'mongoose';
import { Store, StoreStatus, StoreCategory, StoreBadge } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

const storeSchema: Schema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 1000, default: '' },
    logo: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    banner: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    status: { type: String, enum: Object.values(StoreStatus), default: StoreStatus.PENDING },
    category: { type: String, enum: Object.values(StoreCategory), required: true },
    badge: { type: String, enum: Object.values(StoreBadge), default: StoreBadge.NONE },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
    },
    policies: {
      returnPolicy: { type: String, default: '' },
      shippingPolicy: { type: String, default: '' },
    },
    stats: {
      totalProducts: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
    },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

storeSchema.index({ ownerId: 1 });
storeSchema.index({ slug: 1 }, { unique: true });
storeSchema.index({ status: 1 });
storeSchema.index({ category: 1 });
storeSchema.index({ 'location.city': 1 });
storeSchema.index({ 'stats.averageRating': -1 });
storeSchema.index({ createdAt: -1 });
storeSchema.index({ name: 'text', description: 'text' });

const storeModel = model<Store & Document>('Store', storeSchema);

export default storeModel;
