export interface AdminAuditLog {
  _id?: any;
  action: string;
  adminUserId: any;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
