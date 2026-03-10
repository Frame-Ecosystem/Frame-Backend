import { model, Schema, Document } from 'mongoose';
import { Booking, BookingStatus } from '@interfaces/booking.interface';

const bookingSchema: Schema = new Schema(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    loungeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    agentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Agent',
        required: false,
      },
    ],
    loungeServiceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'LoungeService',
        required: false,
      },
    ],
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      required: true,
    },
    cancelledBy: {
      idUser: { type: Schema.Types.ObjectId, ref: 'User', required: false },
      cancelledByName: { type: String, required: false },
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: false,
      min: 0,
    },
    totalDuration: {
      type: Number,
      required: false,
      min: 0,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better performance
bookingSchema.index({ clientId: 1 });
bookingSchema.index({ loungeId: 1 });
bookingSchema.index({ loungeServiceIds: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ bookingDate: 1 });

const bookingModel = model<Booking & Document>('Booking', bookingSchema);

export default bookingModel;
