import { User } from '@systems/UserManager/interfaces/user.interface';

export interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  blockedUsers: number;
  usersByType: {
    admin: number;
    client: number;
    lounge: number;
    agent: number;
    user: number;
  };
  timestamp: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded';
  timestamp: Date;
  database: {
    status: 'disconnected' | 'connected' | 'connecting' | 'disconnecting';
    readyState: number;
  };
  process: {
    uptimeSeconds: number;
    nodeVersion: string;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };
}

export interface UserActivityEntry {
  _id: string;
  email?: string;
  type?: User['type'];
  sessionTrack?: User['sessionTrack'];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DashboardStats {
  totalUsers: number;
  newUsersThisMonth: number;
  onlineUsers: number;
  blockedUsers: number;
  usersByType: {
    admin: number;
    client: number;
    lounge: number;
    agent: number;
    user: number;
  };
  timestamp: Date;
}

export interface ExportedUserData {
  user: Partial<User>;
  exportedAt: Date;
  metadata: {
    hasActiveSession: boolean;
    refreshTokenCount: number;
  };
}

export interface AdminAuditLogRecord {
  _id: string;
  action: string;
  adminUserId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
