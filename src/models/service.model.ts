import { model, Schema, Document } from 'mongoose';

export enum ServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface Service extends Document {
  _id: string;
  name: string;
  categoryId: string; // Reference to ServiceCategory
  baseDuration?: number; // in minutes
  status: ServiceStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const serviceSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceCategory',
      required: true,
    },
    baseDuration: {
      type: Number,
      required: false,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(ServiceStatus),
      default: ServiceStatus.ACTIVE,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes for better performance
serviceSchema.index({ name: 1 });
serviceSchema.index({ categoryId: 1 });
serviceSchema.index({ status: 1 });

const serviceModel = model<Service & Document>('Service', serviceSchema);

// Drop the old slug index if it exists
serviceModel.collection.dropIndex('slug_1').catch(err => {
  // Index might not exist, which is fine
  if (err.code !== 27) {
    // 27 = index not found
    console.warn('Warning: Could not drop old slug index:', err.message);
  }
});

export default serviceModel;
