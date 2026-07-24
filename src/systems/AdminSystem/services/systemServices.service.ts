import { hash } from 'bcrypt';
import mongoose from 'mongoose';
import { BCRYPT_ROUNDS } from '@config/constants';
import { User } from '@systems/UserManager/interfaces/user.interface';
import userModel from '@systems/UserManager/models/user.model';
import adminAuditLogModel from '@systems/AdminSystem/models/auditLog.model';
import {
  AdminAuditLogRecord,
  AdminStats,
  DashboardStats,
  ExportedUserData,
  SystemHealth,
  UserActivityEntry,
} from '@systems/AdminSystem/interfaces/systemServices.interface';
import { isEmpty } from '@utils/util';
import { HttpException, BadRequestException, NotFoundException, InternalServerException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';
import { computePasswordStrength } from '@utils/passwordStrength';

class SystemServicesService {
  private readonly users = userModel;
  private readonly auditLogs = adminAuditLogModel;

  private getConnectionStatus(readyState: number): SystemHealth['database']['status'] {
    const states: Record<number, SystemHealth['database']['status']> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return states[readyState] ?? 'disconnected';
  }

  private normalizeActivityLimit(limit: number): number {
    if (!Number.isFinite(limit)) return 100;
    if (limit < 1) return 1;
    if (limit > 1000) return 1000;
    return Math.floor(limit);
  }

  /**
   * Get all admin services (admin panel management)
   */
  public async getAllAdminServices(): Promise<AdminStats> {
    try {
      const [totalUsers, onlineUsers, blockedUsers, admin, client, lounge, agent, user] = await Promise.all([
        this.users.countDocuments(),
        this.users.countDocuments({ 'sessionTrack.isOnline': true }),
        this.users.countDocuments({ isBlocked: true }),
        this.users.countDocuments({ type: 'admin' }),
        this.users.countDocuments({ type: 'client' }),
        this.users.countDocuments({ type: 'lounge' }),
        this.users.countDocuments({ type: 'agent' }),
        this.users.countDocuments({ type: 'user' }),
      ]);

      const adminStats: AdminStats = {
        totalUsers,
        onlineUsers,
        blockedUsers,
        usersByType: {
          admin,
          client,
          lounge,
          agent,
          user,
        },
        timestamp: new Date(),
      };

      logger.info('SystemServicesService.getAllAdminServices: retrieved admin statistics');
      return adminStats;
    } catch (error: unknown) {
      logger.error(`SystemServicesService.getAllAdminServices error: ${(error as Error).message}`, {
        stack: (error as Error).stack,
      });
      throw new InternalServerException('Failed to retrieve admin services');
    }
  }

  /**
   * Get system health status
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    try {
      const memory = process.memoryUsage();
      const readyState = mongoose.connection.readyState;
      const databaseStatus = this.getConnectionStatus(readyState);

      const health: SystemHealth = {
        status: databaseStatus === 'connected' ? 'healthy' : 'degraded',
        timestamp: new Date(),
        database: {
          status: databaseStatus,
          readyState,
        },
        process: {
          uptimeSeconds: process.uptime(),
          nodeVersion: process.version,
          memory: {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed,
            external: memory.external,
            arrayBuffers: memory.arrayBuffers,
          },
        },
      };

      logger.info('SystemServicesService.getSystemHealth: system health check');
      return health;
    } catch (error: unknown) {
      logger.error(`SystemServicesService.getSystemHealth error: ${(error as Error).message}`, { stack: (error as Error).stack });
      throw new InternalServerException('Failed to get system health');
    }
  }

  /**
   * Get user activity log
   */
  public async getUserActivityLog(limit = 100): Promise<UserActivityEntry[]> {
    try {
      const safeLimit = this.normalizeActivityLimit(limit);

      const activityLog = await this.users
        .find({})
        .select('email type sessionTrack createdAt updatedAt')
        .limit(safeLimit)
        .sort({ updatedAt: -1 })
        .lean()
        .exec();

      const normalized: UserActivityEntry[] = activityLog.map(entry => ({
        _id: String(entry._id),
        email: entry.email,
        type: entry.type,
        sessionTrack: entry.sessionTrack,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));

      logger.info(`SystemServicesService.getUserActivityLog: retrieved ${normalized.length} activity logs`);
      return normalized;
    } catch (error: unknown) {
      logger.error(`SystemServicesService.getUserActivityLog error: ${(error as Error).message}`, { stack: (error as Error).stack });
      throw new InternalServerException('Failed to retrieve user activity log');
    }
  }

  /**
   * Get dashboard statistics
   */
  public async getDashboardStats(): Promise<DashboardStats> {
    try {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const [totalUsers, newUsersThisMonth, onlineUsers, blockedUsers, admin, client, lounge, agent, user] = await Promise.all([
        this.users.countDocuments(),
        this.users.countDocuments({ createdAt: { $gte: monthStart, $lte: now } }),
        this.users.countDocuments({ 'sessionTrack.isOnline': true }),
        this.users.countDocuments({ isBlocked: true }),
        this.users.countDocuments({ type: 'admin' }),
        this.users.countDocuments({ type: 'client' }),
        this.users.countDocuments({ type: 'lounge' }),
        this.users.countDocuments({ type: 'agent' }),
        this.users.countDocuments({ type: 'user' }),
      ]);

      const stats: DashboardStats = {
        totalUsers,
        newUsersThisMonth,
        onlineUsers,
        blockedUsers,
        usersByType: {
          admin,
          client,
          lounge,
          agent,
          user,
        },
        timestamp: new Date(),
      };

      logger.info('SystemServicesService.getDashboardStats: retrieved dashboard statistics');
      return stats;
    } catch (error: unknown) {
      logger.error(`SystemServicesService.getDashboardStats error: ${(error as Error).message}`, { stack: (error as Error).stack });
      throw new InternalServerException('Failed to retrieve dashboard statistics');
    }
  }

  /**
   * Clear user sessions (logout all users)
   */
  public async clearUserSessions(userId: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('SystemServicesService.clearUserSessions: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const updatedUser = await this.users.findByIdAndUpdate(
        userId,
        {
          refreshTokens: [],
          'sessionTrack.isOnline': false,
          'sessionTrack.devices': [],
        },
        { new: true },
      );

      if (!updatedUser) {
        logger.error(`SystemServicesService.clearUserSessions: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`SystemServicesService.clearUserSessions: cleared sessions for user ${userId}`);
      return updatedUser;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      logger.error(`SystemServicesService.clearUserSessions error: ${(error as Error).message}`, { userId, stack: (error as Error).stack });
      throw new InternalServerException('Failed to clear user sessions');
    }
  }

  /**
   * Reset user password (admin function)
   */
  public async resetUserPassword(userId: string, newPassword: string): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(newPassword)) {
        logger.warn('SystemServicesService.resetUserPassword: empty parameters provided');
        throw new BadRequestException('Invalid request data');
      }

      const hashedPassword = await hash(newPassword, BCRYPT_ROUNDS);
      const passwordStrength = computePasswordStrength(newPassword);

      const updatedUser = await this.users.findByIdAndUpdate(
        userId,
        {
          password: hashedPassword,
          passwordStrength,
          passwordChangedAt: new Date(),
          refreshTokens: [],
          'sessionTrack.isOnline': false,
          'sessionTrack.devices': [],
        },
        { new: true },
      );

      if (!updatedUser) {
        logger.error(`SystemServicesService.resetUserPassword: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`SystemServicesService.resetUserPassword: password reset for user ${userId}`);
      return updatedUser;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      logger.error(`SystemServicesService.resetUserPassword error: ${(error as Error).message}`, { userId, stack: (error as Error).stack });
      throw new InternalServerException('Failed to reset user password');
    }
  }

  /**
   * Export user data
   */
  public async exportUserData(userId: string): Promise<ExportedUserData> {
    try {
      if (isEmpty(userId)) {
        logger.warn('SystemServicesService.exportUserData: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const user = await this.users
        .findById(userId)
        .select('-password -oauth -fcmTokens -emailVerification')
        .lean()
        .exec();
      if (!user) {
        logger.error(`SystemServicesService.exportUserData: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      const refreshTokenCount = Array.isArray(user.refreshTokens) ? user.refreshTokens.length : 0;

      const exportData: ExportedUserData = {
        user,
        exportedAt: new Date(),
        metadata: {
          hasActiveSession: Boolean(user.sessionTrack?.isOnline),
          refreshTokenCount,
        },
      };

      logger.info(`SystemServicesService.exportUserData: exported data for user ${userId}`);
      return exportData;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      logger.error(`SystemServicesService.exportUserData error: ${(error as Error).message}`, { userId, stack: (error as Error).stack });
      throw new InternalServerException('Failed to export user data');
    }
  }

  /**
   * Create audit log
   */
  public async createAuditLog(
    action: string,
    userId: string,
    details?: Record<string, unknown>,
    requestMetadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<AdminAuditLogRecord> {
    try {
      if (isEmpty(action) || isEmpty(userId)) {
        throw new BadRequestException('action and userId are required');
      }

      const created = await this.auditLogs.create({
        action,
        adminUserId: userId,
        details: details ?? {},
        ipAddress: requestMetadata?.ipAddress,
        userAgent: requestMetadata?.userAgent,
      });

      const auditLog: AdminAuditLogRecord = {
        _id: String(created._id),
        action: created.action,
        adminUserId: String(created.adminUserId),
        details: created.details as Record<string, unknown>,
        ipAddress: created.ipAddress,
        userAgent: created.userAgent,
        createdAt: created.createdAt,
      };

      logger.info(`SystemServicesService.createAuditLog: ${action} by user ${userId}`);
      return auditLog;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      logger.error(`SystemServicesService.createAuditLog error: ${(error as Error).message}`, { stack: (error as Error).stack });
      throw new InternalServerException('Failed to create audit log');
    }
  }
}

export default SystemServicesService;
