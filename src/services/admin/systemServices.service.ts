import { hash } from 'bcrypt';
import { BCRYPT_ROUNDS } from '@config/constants';
import { User } from '@interfaces/user/user.interface';
import userModel from '@models/user/user.model';
import { isEmpty } from '@utils/util';
import { HttpException, BadRequestException, NotFoundException, InternalServerException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

class SystemServicesService {
  public users = userModel;

  /**
   * Get all admin services (admin panel management)
   */
  public async getAllAdminServices(): Promise<any> {
    try {
      const adminStats = {
        totalUsers: await this.users.countDocuments(),
        onlineUsers: await this.users.countDocuments({ 'sessionTrack.isOnline': true }),
        blockedUsers: await this.users.countDocuments({ isBlocked: true }),
        adminCount: await this.users.countDocuments({ type: 'admin' }),
        clientCount: await this.users.countDocuments({ type: 'client' }),
        loungeCount: await this.users.countDocuments({ type: 'lounge' }),
      };
      logger.info('SystemServicesService.getAllAdminServices: retrieved admin statistics');
      return adminStats;
    } catch (error) {
      logger.error(`SystemServicesService.getAllAdminServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to retrieve admin services');
    }
  }

  /**
   * Get system health status
   */
  public async getSystemHealth(): Promise<any> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        database: 'connected',
        uptime: process.uptime(),
      };
      logger.info('SystemServicesService.getSystemHealth: system health check');
      return health;
    } catch (error) {
      logger.error(`SystemServicesService.getSystemHealth error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to get system health');
    }
  }

  /**
   * Get user activity log
   */
  public async getUserActivityLog(limit = 100): Promise<any[]> {
    try {
      if (limit > 1000) limit = 1000; // Prevent excessive queries

      const activityLog = await this.users.find({}).select('email type sessionTrack createdAt updatedAt').limit(limit).sort({ updatedAt: -1 });

      logger.info(`SystemServicesService.getUserActivityLog: retrieved ${activityLog.length} activity logs`);
      return activityLog;
    } catch (error) {
      logger.error(`SystemServicesService.getUserActivityLog error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to retrieve user activity log');
    }
  }

  /**
   * Get dashboard statistics
   */
  public async getDashboardStats(): Promise<any> {
    try {
      const stats = {
        totalUsers: await this.users.countDocuments(),
        newUsersThisMonth: await this.users.countDocuments({
          createdAt: {
            $gte: new Date(new Date().setDate(1)),
            $lte: new Date(),
          },
        }),
        onlineUsers: await this.users.countDocuments({ 'sessionTrack.isOnline': true }),
        blockedUsers: await this.users.countDocuments({ isBlocked: true }),
        usersByType: {
          admin: await this.users.countDocuments({ type: 'admin' }),
          client: await this.users.countDocuments({ type: 'client' }),
          lounge: await this.users.countDocuments({ type: 'lounge' }),
          user: await this.users.countDocuments({ type: 'user' }),
        },
        timestamp: new Date(),
      };
      logger.info('SystemServicesService.getDashboardStats: retrieved dashboard statistics');
      return stats;
    } catch (error) {
      logger.error(`SystemServicesService.getDashboardStats error: ${error.message}`, { stack: error.stack });
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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`SystemServicesService.clearUserSessions error: ${error.message}`, { userId, stack: error.stack });
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

      const updatedUser = await this.users.findByIdAndUpdate(userId, { password: hashedPassword }, { new: true });

      if (!updatedUser) {
        logger.error(`SystemServicesService.resetUserPassword: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`SystemServicesService.resetUserPassword: password reset for user ${userId}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`SystemServicesService.resetUserPassword error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Failed to reset user password');
    }
  }

  /**
   * Export user data
   */
  public async exportUserData(userId: string): Promise<any> {
    try {
      if (isEmpty(userId)) {
        logger.warn('SystemServicesService.exportUserData: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const user = await this.users.findById(userId);
      if (!user) {
        logger.error(`SystemServicesService.exportUserData: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      const exportData = {
        user: user.toObject(),
        exportedAt: new Date(),
      };

      logger.info(`SystemServicesService.exportUserData: exported data for user ${userId}`);
      return exportData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`SystemServicesService.exportUserData error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Failed to export user data');
    }
  }

  /**
   * Create audit log
   */
  public async createAuditLog(action: string, userId: string, details: any): Promise<any> {
    try {
      const auditLog = {
        action,
        userId,
        details,
        timestamp: new Date(),
      };
      logger.info(`SystemServicesService.createAuditLog: ${action} by user ${userId}`);
      return auditLog;
    } catch (error) {
      logger.error(`SystemServicesService.createAuditLog error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to create audit log');
    }
  }
}

export default SystemServicesService;
