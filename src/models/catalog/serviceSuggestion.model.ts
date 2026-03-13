import { model, Schema, Document } from 'mongoose';

export enum ServiceSuggestionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IMPLEMENTED = 'implemented',
}

export interface ServiceSuggestion extends Document {
  _id: string;
  name: string;
  description: string;
  estimatedPrice?: number;
  estimatedDuration?: number;
  targetGender?: 'men' | 'women' | 'unisex' | 'kids';
  status: ServiceSuggestionStatus;
  loungeId: string; // Reference to User (lounge type)
  adminNote?: string; // Admin notes about approval/rejection
  createdAt?: Date;
  updatedAt?: Date;
}

const serviceSuggestionSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    estimatedPrice: {
      type: Number,
      required: false,
      min: 0,
    },
    estimatedDuration: {
      type: Number,
      required: false,
      min: 15,
      max: 480,
    },
    targetGender: {
      type: String,
      enum: ['men', 'women', 'unisex', 'kids'],
      required: false,
    },
    status: {
      type: String,
      enum: Object.values(ServiceSuggestionStatus),
      default: ServiceSuggestionStatus.PENDING,
      required: true,
    },
    loungeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminNote: {
      type: String,
      required: false,
      maxlength: 500,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes for better performance
serviceSuggestionSchema.index({ name: 1 });
serviceSuggestionSchema.index({ status: 1 });
serviceSuggestionSchema.index({ loungeId: 1 });
serviceSuggestionSchema.index({ createdAt: -1 });

const serviceSuggestionModel = model<ServiceSuggestion & Document>('ServiceSuggestion', serviceSuggestionSchema);

export default serviceSuggestionModel;
