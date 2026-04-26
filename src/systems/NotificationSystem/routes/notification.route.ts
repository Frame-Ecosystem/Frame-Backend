import { Router } from 'express';
import NotificationController from '@systems/NotificationSystem/controllers/notification.controller';
import { MarkNotificationsReadDto, RegisterDeviceTokenDto, UnregisterDeviceTokenDto } from '@systems/NotificationSystem/dtos/notification.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

class NotificationRoute implements Routes {
  public path = '/v1/notifications';
  public router = Router();
  public notificationController = new NotificationController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // All notification routes require authentication
    this.router.use(authMiddleware);

    // Get paginated notifications
    this.router.get('/', this.notificationController.getNotifications);

    // Get unread count (must come before /:id)
    this.router.get('/unread-count', this.notificationController.getUnreadCount);

    // Mark notifications as read (specific IDs or all)
    this.router.patch('/read', csrfMiddleware, validationMiddleware(MarkNotificationsReadDto, 'body', true), this.notificationController.markAsRead);

    // Register device token for push notifications
    this.router.post('/device-token', csrfMiddleware, validationMiddleware(RegisterDeviceTokenDto, 'body'), this.notificationController.registerDeviceToken);

    // Unregister device token
    this.router.delete(
      '/device-token',
      csrfMiddleware,
      validationMiddleware(UnregisterDeviceTokenDto, 'body'),
      this.notificationController.unregisterDeviceToken,
    );

    // Delete all notifications
    this.router.delete('/', csrfMiddleware, this.notificationController.deleteAllNotifications);

    // Delete single notification
    this.router.delete('/:id', csrfMiddleware, this.notificationController.deleteNotification);
  }
}

export default NotificationRoute;
