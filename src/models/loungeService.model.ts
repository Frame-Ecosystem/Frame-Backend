import { model, Schema, Document } from 'mongoose';

export enum ServiceLoungeGender {
  MEN = 'men',
  WOMEN = 'women',
  UNISEX = 'unisex',
  KIDS = 'kids',
}

export enum LoungeServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface LoungeService extends Document {
  _id: string;
  loungeId: string; // Reference to User (lounge type)
  serviceId: string; // Reference to Service
  price: number; // Price in the smallest currency unit (e.g., cents for USD)
  duration: number; // Duration in minutes
  gender: ServiceLoungeGender;
  status: LoungeServiceStatus;
  description?: string;
  image?: {
    url: string;
    publicId: string;
  };
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const loungeServiceSchema: Schema = new Schema(
  {
    loungeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      required: true,
      min: 1, // At least 1 minute
    },
    gender: {
      type: String,
      enum: Object.values(ServiceLoungeGender),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(LoungeServiceStatus),
      default: LoungeServiceStatus.ACTIVE,
      required: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    image: {
      url: { type: String, required: false },
      publicId: { type: String, required: false },
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

// Create compound index to prevent duplicate (loungeId, serviceId) entries
loungeServiceSchema.index({ loungeId: 1, serviceId: 1 }, { unique: true });

// Create indexes for better performance
loungeServiceSchema.index({ loungeId: 1 });
loungeServiceSchema.index({ serviceId: 1 });
loungeServiceSchema.index({ isActive: 1 });
loungeServiceSchema.index({ price: 1 });
loungeServiceSchema.index({ duration: 1 });

const loungeServiceModel = model<LoungeService & Document>('LoungeService', loungeServiceSchema);

export default loungeServiceModel;
