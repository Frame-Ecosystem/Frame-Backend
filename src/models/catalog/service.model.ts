import { model, Schema, Document } from 'mongoose';

export interface Service extends Document {
  _id: string;
  name: string;
  categoryId: string; // Reference to ServiceCategory
  description?: string;
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
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes for better performance
serviceSchema.index({ name: 1 });
serviceSchema.index({ categoryId: 1 });

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
