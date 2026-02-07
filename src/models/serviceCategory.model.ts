import { model, Schema, Document } from 'mongoose';

export interface ServiceCategory extends Document {
  _id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const serviceCategorySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes for better performance
serviceCategorySchema.index({ name: 1 });

const serviceCategoryModel = model<ServiceCategory & Document>('ServiceCategory', serviceCategorySchema);

export default serviceCategoryModel;
