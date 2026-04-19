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

export default serviceModel;
