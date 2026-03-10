import { Router } from 'express';
import NotificationController from '@controllers/notification.controller';
import { MarkNotificationsReadDto } from '@dtos/notification.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
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
    this.router.patch('/read', validationMiddleware(MarkNotificationsReadDto, 'body', true), this.notificationController.markAsRead);

    // Delete all notifications
    this.router.delete('/', this.notificationController.deleteAllNotifications);

    // Delete single notification
    this.router.delete('/:id', this.notificationController.deleteNotification);
  }
}

export default NotificationRoute;
