import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth.interface';
import NotificationService from '@services/notification.service';
import { logger } from '@utils/logger';

class NotificationController {
  private notificationService = NotificationService.getInstance();

  /**
   * GET /v1/notifications
   * Get paginated notifications for the current user.
   */
  public getNotifications = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.notificationService.getNotifications(userId, page, limit);
      res.status(200).json({
        success: true,
        data: result.notifications,
        unreadCount: result.unreadCount,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
        message: 'Notifications retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getNotifications: ${error.message}`);
      next(error);
    }
  };

  /**
   * GET /v1/notifications/unread-count
   * Get unread notification count for the current user.
   */
  public getUnreadCount = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const count = await this.notificationService.getUnreadCount(userId);
      res.status(200).json({
        success: true,
        data: { unreadCount: count },
        message: 'Unread count retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getUnreadCount: ${error.message}`);
      next(error);
    }
  };

  /**
   * PATCH /v1/notifications/read
   * Mark notifications as read. If notificationIds provided, marks only those; otherwise marks all.
   */
  public markAsRead = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { notificationIds } = req.body;

      const modifiedCount = await this.notificationService.markAsRead(userId, notificationIds);
      res.status(200).json({
        success: true,
        data: { modifiedCount },
        message: notificationIds ? 'Notifications marked as read' : 'All notifications marked as read',
      });
    } catch (error) {
      logger.error(`Error in markAsRead: ${error.message}`);
      next(error);
    }
  };

  /**
   * DELETE /v1/notifications/:id
   * Delete a single notification.
   */
  public deleteNotification = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { id } = req.params;

      await this.notificationService.deleteNotification(userId, id);
      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      logger.error(`Error in deleteNotification: ${error.message}`);
      next(error);
    }
  };

  /**
   * DELETE /v1/notifications
   * Delete all notifications for the current user.
   */
  public deleteAllNotifications = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const deletedCount = await this.notificationService.deleteAllNotifications(userId);
      res.status(200).json({
        success: true,
        data: { deletedCount },
        message: 'All notifications deleted successfully',
      });
    } catch (error) {
      logger.error(`Error in deleteAllNotifications: ${error.message}`);
      next(error);
    }
  };
}

export default NotificationController;
