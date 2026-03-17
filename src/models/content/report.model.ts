import { model, Schema, Document } from 'mongoose';
import { Report, ReportStatus } from '@interfaces/content/content.interface';

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ['post', 'reel', 'comment'], required: true },
    reason: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: Object.values(ReportStatus), default: ReportStatus.PENDING },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetId: 1, targetType: 1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });

const reportModel = model<Report & Document>('Report', reportSchema);

export default reportModel;
