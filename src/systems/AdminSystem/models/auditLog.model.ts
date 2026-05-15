import { model, Schema, Document } from 'mongoose';
import { AdminAuditLog } from '@systems/AdminSystem/interfaces/auditLog.interface';

const adminAuditLogSchema: Schema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

adminAuditLogSchema.index({ createdAt: -1 });

const adminAuditLogModel = model<AdminAuditLog & Document>('AdminAuditLog', adminAuditLogSchema);

export default adminAuditLogModel;
