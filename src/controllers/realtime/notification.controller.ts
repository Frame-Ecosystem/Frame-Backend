import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import NotificationService from '@services/realtime/notification.service';
import PushNotificationService from '@services/realtime/push.service';

class NotificationController {
  private notificationService = NotificationService.getInstance();
  private pushService = PushNotificationService.getInstance();

  /** GET /v1/notifications — paginated list. */
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
      next(error);
    }
  };

  /** GET /v1/notifications/unread-count */
  public getUnreadCount = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const count = await this.notificationService.getUnreadCount(req.user._id.toString());
      res.status(200).json({ success: true, data: { unreadCount: count }, message: 'Unread count retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /v1/notifications/read — mark specific or all as read. */
  public markAsRead = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { notificationIds } = req.body;
      const modifiedCount = await this.notificationService.markAsRead(req.user._id.toString(), notificationIds);
      res.status(200).json({
        success: true,
        data: { modifiedCount },
        message: notificationIds ? 'Notifications marked as read' : 'All notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /v1/notifications/:id */
  public deleteNotification = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.notificationService.deleteNotification(req.user._id.toString(), req.params.id);
      res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /v1/notifications */
  public deleteAllNotifications = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const deletedCount = await this.notificationService.deleteAllNotifications(req.user._id.toString());
      res.status(200).json({ success: true, data: { deletedCount }, message: 'All notifications deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** POST /v1/notifications/device-token — register FCM token. */
  public registerDeviceToken = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { token, deviceId, platform } = req.body;
      await this.pushService.registerToken(req.user._id.toString(), token, deviceId, platform);
      res.status(200).json({ success: true, message: 'Device token registered successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /v1/notifications/device-token — unregister FCM token. */
  public unregisterDeviceToken = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.pushService.unregisterToken(req.user._id.toString(), req.body.deviceId);
      res.status(200).json({ success: true, message: 'Device token unregistered successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default NotificationController;
