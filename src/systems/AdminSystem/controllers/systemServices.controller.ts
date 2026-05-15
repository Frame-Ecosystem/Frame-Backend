import { NextFunction, Request, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { BadRequestException } from '@exceptions/HttpException';
import { CreateAuditLogDto, ResetUserPasswordDto } from '@systems/AdminSystem/dtos/systemServices.dto';
import SystemServicesService from '@systems/AdminSystem/services/systemServices.service';

class SystemServicesController {
  private readonly systemServicesService = new SystemServicesService();

  /**
   * Get all admin services statistics
   */
  public getAllAdminServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await this.systemServicesService.getAllAdminServices();
      res.status(200).json({
        data: stats,
        message: 'Admin services retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get system health status
   */
  public getSystemHealth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await this.systemServicesService.getSystemHealth();
      res.status(200).json({
        data: health,
        message: 'System health check completed',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user activity log
   */
  public getUserActivityLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const activityLog = await this.systemServicesService.getUserActivityLog(limit);
      res.status(200).json({
        data: activityLog,
        count: activityLog.length,
        message: 'User activity log retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get dashboard statistics
   */
  public getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await this.systemServicesService.getDashboardStats();
      res.status(200).json({
        data: stats,
        message: 'Dashboard statistics retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Clear user sessions
   */
  public clearUserSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const user = await this.systemServicesService.clearUserSessions(userId);
      res.status(200).json({
        data: user,
        message: 'User sessions cleared successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reset user password
   */
  public resetUserPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const { newPassword } = req.body as ResetUserPasswordDto;

      const user = await this.systemServicesService.resetUserPassword(userId, newPassword);
      res.status(200).json({
        data: user,
        message: 'User password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Export user data
   */
  public exportUserData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const exportData = await this.systemServicesService.exportUserData(userId);
      res.status(200).json({
        data: exportData,
        message: 'User data exported successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create audit log
   */
  public createAuditLog = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { action, details } = req.body as CreateAuditLogDto;
      const userId = req.user?._id ? String(req.user._id) : '';
      if (!userId) {
        throw new BadRequestException('Authenticated user id is required');
      }

      const auditLog = await this.systemServicesService.createAuditLog(action, userId, details, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      res.status(201).json({
        data: auditLog,
        message: 'Audit log created successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default SystemServicesController;
