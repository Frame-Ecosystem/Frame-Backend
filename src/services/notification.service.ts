import { Notification, NotificationType } from '@interfaces/notification.interface';
import notificationModel from '@models/notification.model';
import SocketService from '@services/socket.service';
import { logger } from '@utils/logger';

class NotificationService {
  private static instance: NotificationService;
  private notifications = notificationModel;
  private socketService = SocketService.getInstance();

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  /**
   * Get paginated notifications for a user.
   */
  public async getNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const [notifications, total, unreadCount] = await Promise.all([
      this.notifications
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.notifications.countDocuments({ userId }),
      this.notifications.countDocuments({ userId, isRead: false }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Get unread count for a user.
   */
  public async getUnreadCount(userId: string): Promise<number> {
    return this.notifications.countDocuments({ userId, isRead: false });
  }

  /**
   * Mark specific notifications as read, or all if no IDs provided.
   */
  public async markAsRead(userId: string, notificationIds?: string[]): Promise<number> {
    const filter: any = { userId, isRead: false };
    if (notificationIds && notificationIds.length > 0) {
      filter._id = { $in: notificationIds };
    }
    const result = await this.notifications.updateMany(filter, { isRead: true });
    return result.modifiedCount;
  }

  /**
   * Delete a single notification.
   */
  public async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const result = await this.notifications.deleteOne({ _id: notificationId, userId });
    if (result.deletedCount === 0) {
      throw new Error('Notification not found');
    }
  }

  /**
   * Delete all notifications for a user.
   */
  public async deleteAllNotifications(userId: string): Promise<number> {
    const result = await this.notifications.deleteMany({ userId });
    return result.deletedCount;
  }

  // ─── Notification Creators ────────────────────────────────────────

  /**
   * Create a notification, save to DB, and emit via socket.
   */
  private async create(data: {
    userId: string;
    title: string;
    body: string;
    type: NotificationType;
    metadata?: Notification['metadata'];
  }): Promise<Notification> {
    try {
      const notification = await this.notifications.create({
        userId: data.userId,
        title: data.title,
        body: data.body,
        type: data.type,
        isRead: false,
        metadata: data.metadata || {},
      });

      // Emit real-time notification via socket
      this.socketService.emitNotification(data.userId, notification);

      return notification;
    } catch (error) {
      logger.error(`NotificationService.create: failed to create notification for user ${data.userId}: ${error.message}`);
      // Don't throw — notifications should never break the main flow
      return null;
    }
  }

  // ─── Booking Notifications ────────────────────────────────────────

  public async notifyBookingCreated(booking: any): Promise<void> {
    const loungeId = this.extractId(booking.loungeId);
    if (!loungeId) return;

    await this.notifyUser(loungeId, booking, {
      title: 'New Booking',
      body: `${this.extractName(booking.clientId)} has made a new booking`,
      type: NotificationType.BOOKING_CREATED,
      extraMetadata: { clientId: this.extractId(booking.clientId) },
    });
  }

  public async notifyQueueBookingCreated(booking: any): Promise<void> {
    const loungeId = this.extractId(booking.loungeId);
    if (!loungeId) return;

    await this.notifyUser(loungeId, booking, {
      title: 'New Queue Join',
      body: `${this.extractName(booking.clientId)} joined the queue`,
      type: NotificationType.BOOKING_CREATED,
      extraMetadata: { clientId: this.extractId(booking.clientId) },
    });
  }

  public async notifyBookingConfirmed(booking: any): Promise<void> {
    await this.notifyClient(booking, {
      title: 'Booking Confirmed',
      body: `Your booking at ${this.extractLoungeTitle(booking.loungeId)} has been confirmed`,
      type: NotificationType.BOOKING_CONFIRMED,
    });
  }

  /**
   * Notify the other party when a booking is cancelled.
   * Uses cancelledBy.idUser to determine who cancelled and notify the opposite party.
   */
  public async notifyBookingCancelled(booking: any): Promise<void> {
    const clientId = this.extractId(booking.clientId);
    const loungeId = this.extractId(booking.loungeId);
    const cancelledBy = booking.cancelledBy;

    if (!cancelledBy?.idUser) {
      logger.warn('NotificationService.notifyBookingCancelled: missing cancelledBy data');
      return;
    }

    const cancellerUserId = cancelledBy.idUser.toString();
    const cancellerName = cancelledBy.cancelledByName || 'Someone';

    logger.info(
      `NotificationService.notifyBookingCancelled: cancellerUserId=${cancellerUserId}, cancellerName=${cancellerName}, loungeId=${loungeId}, clientId=${clientId}`,
    );

    // If the canceller is the client → notify the lounge
    if (cancellerUserId === clientId && loungeId) {
      await this.notifyUser(loungeId, booking, {
        title: 'Booking Cancelled',
        body: `${cancellerName} cancelled their booking`,
        type: NotificationType.BOOKING_CANCELLED,
        extraMetadata: { clientId },
      });
    }

    // If the canceller is NOT the client → notify the client
    if (cancellerUserId !== clientId && clientId) {
      await this.notifyUser(clientId, booking, {
        title: 'Booking Cancelled',
        body: `Your booking at ${this.extractLoungeTitle(booking.loungeId)} was cancelled by ${cancellerName}`,
        type: NotificationType.BOOKING_CANCELLED,
      });
    }
  }

  public async notifyBookingInQueue(booking: any): Promise<void> {
    await this.notifyClient(booking, {
      title: "You're In The Queue",
      body: `You have been added to the queue at ${this.extractLoungeTitle(booking.loungeId)}`,
      type: NotificationType.BOOKING_IN_QUEUE,
    });
  }

  public async notifyBookingCompleted(booking: any): Promise<void> {
    await this.notifyClient(booking, {
      title: 'Service Completed',
      body: `Your service at ${this.extractLoungeTitle(booking.loungeId)} is completed`,
      type: NotificationType.BOOKING_COMPLETED,
    });
  }

  public async notifyBookingAbsent(booking: any): Promise<void> {
    await this.notifyClient(booking, {
      title: 'Marked as Absent',
      body: `You were marked as absent at ${this.extractLoungeTitle(booking.loungeId)}`,
      type: NotificationType.BOOKING_ABSENT,
    });
  }

  // ─── Queue Person Notifications ───────────────────────────────────

  public async notifyQueueInService(booking: any): Promise<void> {
    await this.notifyClient(booking, {
      title: "It's Your Turn!",
      body: `Your turn has come at ${this.extractLoungeTitle(booking.loungeId)}. Please head to your agent.`,
      type: NotificationType.QUEUE_IN_SERVICE,
    });
  }

  public async notifyQueueAutoCancelled(booking: any, loungeTitle: string): Promise<void> {
    const clientId = this.extractId(booking.clientId);
    if (!clientId) return;

    await this.notifyUser(clientId, booking, {
      title: 'Booking Auto-Cancelled',
      body: `Your booking was automatically cancelled by ${loungeTitle} because the day passed`,
      type: NotificationType.QUEUE_AUTO_CANCELLED,
    });
  }

  public async notifyBackInQueue(booking: any): Promise<void> {
    await this.notifyClient(booking, {
      title: 'Back In Queue',
      body: `You have been placed back in the queue at ${this.extractLoungeTitle(booking.loungeId)}`,
      type: NotificationType.QUEUE_BACK_IN_QUEUE,
    });
  }

  public async notifyQueueReminder(booking: any, estimatedMinutes: number): Promise<void> {
    await this.notifyClient(booking, {
      title: 'Almost Your Turn',
      body: `Your turn at ${this.extractLoungeTitle(booking.loungeId)} is approximately ${estimatedMinutes} minutes away. Get ready!`,
      type: NotificationType.QUEUE_REMINDER,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /**
   * Send a notification to a specific user with standard booking metadata.
   */
  private async notifyUser(
    userId: string,
    booking: any,
    opts: { title: string; body: string; type: NotificationType; extraMetadata?: Record<string, string | undefined> },
  ): Promise<void> {
    const bookingId = (booking._id || booking.id)?.toString();
    await this.create({
      userId,
      title: opts.title,
      body: opts.body,
      type: opts.type,
      metadata: {
        bookingId,
        loungeId: this.extractId(booking.loungeId),
        ...opts.extraMetadata,
      },
    });
  }

  /**
   * Shorthand: notify the booking's client.
   */
  private async notifyClient(booking: any, opts: { title: string; body: string; type: NotificationType }): Promise<void> {
    const clientId = this.extractId(booking.clientId);
    if (!clientId) return;
    await this.notifyUser(clientId, booking, opts);
  }

  private extractId(ref: any): string | undefined {
    if (!ref) return undefined;
    return (ref._id || ref.id || ref)?.toString();
  }

  private extractName(ref: any): string {
    if (!ref) return 'A client';
    if (ref.firstName || ref.lastName) {
      return [ref.firstName, ref.lastName].filter(Boolean).join(' ');
    }
    return 'A client';
  }

  private extractLoungeTitle(ref: any): string {
    if (!ref) return 'the lounge';
    return ref.loungeTitle || [ref.firstName, ref.lastName].filter(Boolean).join(' ') || 'the lounge';
  }
}

export default NotificationService;
