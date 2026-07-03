import { model, Schema, Document } from 'mongoose';

export interface LoungeExtraDocument extends Document {
  _id: string;
  loungeId: string;
  extraId: string;
  cost?: number;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const loungeExtraSchema: Schema = new Schema(
  {
    loungeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    extraId: {
      type: Schema.Types.ObjectId,
      ref: 'Extra',
      required: true,
    },
    cost: {
      type: Number,
      required: false,
      min: 0,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
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

loungeExtraSchema.index({ loungeId: 1, extraId: 1 }, { unique: true });
loungeExtraSchema.index({ loungeId: 1 });
loungeExtraSchema.index({ extraId: 1 });

const loungeExtraModel = model<LoungeExtraDocument & Document>('LoungeExtra', loungeExtraSchema);

export default loungeExtraModel;
