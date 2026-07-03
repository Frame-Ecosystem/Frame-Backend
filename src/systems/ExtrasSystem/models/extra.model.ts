import { model, Schema, Document } from 'mongoose';

export interface ExtraDocument extends Document {
  _id: string;
  name: string;
  description?: string;
  free: boolean;
  cost: number;
  category: string;
  image?: {
    url: string;
    publicId: string;
  };
  createdBy: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const extraSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
    },
    free: {
      type: Boolean,
      required: true,
      default: false,
    },
    cost: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      url: { type: String, required: false },
      publicId: { type: String, required: false },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

extraSchema.index({ name: 1 }, { unique: true });
extraSchema.index({ category: 1 });
extraSchema.index({ free: 1 });

const extraModel = model<ExtraDocument & Document>('Extra', extraSchema);

export default extraModel;
