import { NextFunction, Request, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import AdminServicesService from '@services/user/adminServices.service';

class AdminServicesController {
  private adminServicesService = new AdminServicesService();

  /**
   * Get all admin services statistics
   */
  public getAllAdminServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await this.adminServicesService.getAllAdminServices();
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
      const health = await this.adminServicesService.getSystemHealth();
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
      const limit = parseInt(req.query.limit as string) || 100;
      const activityLog = await this.adminServicesService.getUserActivityLog(limit);
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
      const stats = await this.adminServicesService.getDashboardStats();
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
      const user = await this.adminServicesService.clearUserSessions(userId);
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
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({
          message: 'New password is required',
        });
      }

      const user = await this.adminServicesService.resetUserPassword(userId, newPassword);
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
      const exportData = await this.adminServicesService.exportUserData(userId);
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
      const { action, details } = req.body;
      const userId = req.user?._id;

      if (!action) {
        return res.status(400).json({
          message: 'Action is required',
        });
      }

      const auditLog = await this.adminServicesService.createAuditLog(action, userId, details);
      res.status(201).json({
        data: auditLog,
        message: 'Audit log created successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AdminServicesController;
