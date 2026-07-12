import {
  Notification,
  NotificationType,
  NotificationCategory,
  NotificationMetadata,
  NOTIFICATION_CATEGORY_MAP,
} from '@systems/NotificationSystem/interfaces/notification.interface';
import notificationModel from '@systems/NotificationSystem/models/notification.model';
import SocketService from '@systems/NotificationSystem/services/socket.service';
import PushNotificationService from '@systems/NotificationSystem/services/push.service';
import { logger } from '@utils/logger';

class NotificationService {
  private static instance: NotificationService;
  private notifications = notificationModel;
  private socketService = SocketService.getInstance();
  private pushService = PushNotificationService.getInstance();

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  /**
   * Get paginated notifications for a user.
   * Supports optional category filter.
   */
  public async getNotifications(
    userId: string,
    page = 1,
    limit = 20,
    category?: NotificationCategory,
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const filter: any = { userId };
    if (category) filter.category = category;

    const [notifications, total, unreadCount] = await Promise.all([
      this.notifications
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.notifications.countDocuments(filter),
      this.notifications.countDocuments({ userId, isRead: false }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Get unread count for a user, optionally per category.
   */
  public async getUnreadCount(userId: string): Promise<{ total: number; byCategory: Record<string, number> }> {
    const [total, byCategory] = await Promise.all([
      this.notifications.countDocuments({ userId, isRead: false }),
      this.notifications.aggregate([{ $match: { userId, isRead: false } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);

    const byCategoryMap: Record<string, number> = {};
    for (const item of byCategory) {
      byCategoryMap[item._id] = item.count;
    }

    return { total, byCategory: byCategoryMap };
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

  // ─── Core Creator ─────────────────────────────────────────────────

  /**
   * Create a notification, persist to DB, emit via socket, and send push.
   * This is the single entry point for ALL notification creation.
   */
  private async create(data: {
    userId: string;
    actorId?: string;
    title: string;
    body: string;
    type: NotificationType;
    metadata?: NotificationMetadata;
    actionUrl?: string;
    imageUrl?: string;
  }): Promise<Notification> {
    try {
      // Never notify yourself
      if (data.actorId && data.userId === data.actorId) return null;

      const category = NOTIFICATION_CATEGORY_MAP[data.type];

      const notification = await this.notifications.create({
        userId: data.userId,
        actorId: data.actorId,
        title: data.title,
        body: data.body,
        type: data.type,
        category,
        isRead: false,
        metadata: data.metadata || {},
        actionUrl: data.actionUrl,
        imageUrl: data.imageUrl,
      });

      // Real-time delivery via Socket.IO
      this.socketService.emitNotification(data.userId, notification);

      // Push delivery via FCM (fire-and-forget)
      const pushData: Record<string, string> = {
        type: data.type,
        category,
        notificationId: notification._id?.toString() || '',
      };
      if (data.actionUrl) pushData.actionUrl = data.actionUrl;
      if (data.metadata?.bookingId) pushData.bookingId = data.metadata.bookingId;
      if (data.metadata?.loungeId) pushData.loungeId = data.metadata.loungeId;
      if (data.metadata?.postId) pushData.postId = data.metadata.postId;
      if (data.metadata?.commentId) pushData.commentId = data.metadata.commentId;

      this.pushService
        .sendToUser(data.userId, { title: data.title, body: data.body, data: pushData, imageUrl: data.imageUrl })
        .catch(err => logger.error(`Push notification failed for user ${data.userId}: ${err.message}`));

      return notification;
    } catch (error) {
      logger.error(`NotificationService.create failed for user ${data.userId}: ${error.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BOOKING NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

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
    const cancellationNote = cancelledBy.note;

    if (cancellerUserId === clientId && loungeId) {
      const body = cancellationNote ? `${cancellerName} cancelled their booking: "${cancellationNote}"` : `${cancellerName} cancelled their booking`;

      await this.notifyUser(loungeId, booking, {
        title: 'Booking Cancelled',
        body,
        type: NotificationType.BOOKING_CANCELLED,
        extraMetadata: { clientId, ...(cancellationNote && { cancellationNote }) },
      });
    }

    if (cancellerUserId !== clientId && clientId) {
      const loungeTitle = this.extractLoungeTitle(booking.loungeId);
      const body = cancellationNote
        ? `Your booking at ${loungeTitle} was cancelled by ${cancellerName}: "${cancellationNote}"`
        : `Your booking at ${loungeTitle} was cancelled by ${cancellerName}`;

      await this.notifyUser(clientId, booking, {
        title: 'Booking Cancelled',
        body,
        type: NotificationType.BOOKING_CANCELLED,
        ...(cancellationNote && { extraMetadata: { cancellationNote } }),
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

  // ═══════════════════════════════════════════════════════════════════
  //  QUEUE NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

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

  public async notifyQueuePositionChanged(booking: any, newPosition: number): Promise<void> {
    await this.notifyClient(booking, {
      title: 'Queue Position Updated',
      body: `Your position in the queue at ${this.extractLoungeTitle(booking.loungeId)} is now #${newPosition}`,
      type: NotificationType.QUEUE_POSITION_CHANGED,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CONTENT NOTIFICATIONS (Posts, Reels, Comments)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Notify the post author that someone liked their post.
   */
  public async notifyPostLiked(postAuthorId: string, actorId: string, actorName: string, postId: string, actorImage?: string): Promise<void> {
    await this.create({
      userId: postAuthorId,
      actorId,
      title: 'New Like',
      body: `${actorName} liked your post`,
      type: NotificationType.POST_LIKED,
      metadata: { postId },
      actionUrl: `/posts/${postId}`,
      imageUrl: actorImage,
    });
  }

  /**
   * Notify the post/reel author that someone commented on their content.
   */
  public async notifyContentCommented(
    contentAuthorId: string,
    actorId: string,
    actorName: string,
    targetType: 'post' | 'reel',
    targetId: string,
    commentId: string,
    commentPreview: string,
    actorImage?: string,
  ): Promise<void> {
    const type = targetType === 'post' ? NotificationType.POST_COMMENTED : NotificationType.REEL_COMMENTED;
    const label = targetType === 'post' ? 'post' : 'reel';
    const preview = commentPreview.length > 80 ? commentPreview.substring(0, 80) + '...' : commentPreview;

    await this.create({
      userId: contentAuthorId,
      actorId,
      title: 'New Comment',
      body: `${actorName} commented on your ${label}: "${preview}"`,
      type,
      metadata: {
        [targetType === 'post' ? 'postId' : 'reelId']: targetId,
        commentId,
        targetType,
      },
      actionUrl: `/${targetType}s/${targetId}`,
      imageUrl: actorImage,
    });
  }

  /**
   * Notify the parent comment author that someone replied.
   */
  public async notifyCommentReplied(
    parentAuthorId: string,
    actorId: string,
    actorName: string,
    targetType: 'post' | 'reel',
    targetId: string,
    commentId: string,
    replyPreview: string,
    actorImage?: string,
  ): Promise<void> {
    const preview = replyPreview.length > 80 ? replyPreview.substring(0, 80) + '...' : replyPreview;

    await this.create({
      userId: parentAuthorId,
      actorId,
      title: 'New Reply',
      body: `${actorName} replied to your comment: "${preview}"`,
      type: NotificationType.COMMENT_REPLIED,
      metadata: {
        [targetType === 'post' ? 'postId' : 'reelId']: targetId,
        commentId,
        targetType,
      },
      actionUrl: `/${targetType}s/${targetId}`,
      imageUrl: actorImage,
    });
  }

  /**
   * Notify the comment author that someone liked their comment.
   */
  public async notifyCommentLiked(
    commentAuthorId: string,
    actorId: string,
    actorName: string,
    commentId: string,
    targetType: 'post' | 'reel',
    targetId: string,
    actorImage?: string,
  ): Promise<void> {
    await this.create({
      userId: commentAuthorId,
      actorId,
      title: 'Comment Liked',
      body: `${actorName} liked your comment`,
      type: NotificationType.COMMENT_LIKED,
      metadata: { commentId, targetType, [targetType === 'post' ? 'postId' : 'reelId']: targetId },
      actionUrl: `/${targetType}s/${targetId}`,
      imageUrl: actorImage,
    });
  }

  /**
   * Notify the reel author that someone liked their reel.
   */
  public async notifyReelLiked(reelAuthorId: string, actorId: string, actorName: string, reelId: string, actorImage?: string): Promise<void> {
    await this.create({
      userId: reelAuthorId,
      actorId,
      title: 'New Like',
      body: `${actorName} liked your reel`,
      type: NotificationType.REEL_LIKED,
      metadata: { reelId },
      actionUrl: `/reels/${reelId}`,
      imageUrl: actorImage,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SOCIAL NOTIFICATIONS (Follow, Like Lounge, Rate)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Notify a user that someone followed them.
   */
  public async notifyNewFollower(targetUserId: string, followerId: string, followerName: string, followerImage?: string): Promise<void> {
    await this.create({
      userId: targetUserId,
      actorId: followerId,
      title: 'New Follower',
      body: `${followerName} started following you`,
      type: NotificationType.NEW_FOLLOWER,
      metadata: { followerId },
      actionUrl: `/profile/${followerId}`,
      imageUrl: followerImage,
    });
  }

  /**
   * Notify a lounge that a user liked them.
   */
  public async notifyLoungeLiked(loungeId: string, likerId: string, likerName: string, likerImage?: string): Promise<void> {
    await this.create({
      userId: loungeId,
      actorId: likerId,
      title: 'New Like',
      body: `${likerName} liked your lounge`,
      type: NotificationType.LOUNGE_LIKED,
      metadata: { actorId: likerId, loungeId },
      actionUrl: `/profile/${likerId}`,
      imageUrl: likerImage,
    });
  }

  /**
   * Notify an agent that a user liked them.
   */
  public async notifyAgentLiked(agentId: string, likerId: string, likerName: string, likerImage?: string): Promise<void> {
    await this.create({
      userId: agentId,
      actorId: likerId,
      title: 'New Like',
      body: `${likerName} liked you`,
      type: NotificationType.AGENT_LIKED,
      metadata: { actorId: likerId, agentId },
      actionUrl: `/profile/${likerId}`,
      imageUrl: likerImage,
    });
  }

  /**
   * Notify a lounge that a user rated them.
   */
  public async notifyLoungeRated(loungeId: string, raterId: string, raterName: string, score: number, raterImage?: string): Promise<void> {
    await this.create({
      userId: loungeId,
      actorId: raterId,
      title: 'New Rating',
      body: `${raterName} rated your lounge ${score}/5`,
      type: NotificationType.LOUNGE_RATED,
      metadata: { actorId: raterId, loungeId, ratingScore: score },
      actionUrl: `/profile/${raterId}`,
      imageUrl: raterImage,
    });
  }

  /**
   * Notify an agent that a user rated them.
   */
  public async notifyAgentRated(agentId: string, raterId: string, raterName: string, score: number, raterImage?: string): Promise<void> {
    await this.create({
      userId: agentId,
      actorId: raterId,
      title: 'New Rating',
      body: `${raterName} rated you ${score}/5`,
      type: NotificationType.AGENT_RATED,
      metadata: { actorId: raterId, agentId, ratingScore: score },
      actionUrl: `/profile/${raterId}`,
      imageUrl: raterImage,
    });
  }

  /**
   * Notify a lounge that an agent rated them, or an agent that a lounge rated them.
   */
  public async notifyRatingReceived(
    targetId: string,
    raterId: string,
    raterName: string,
    score: number,
    raterImage?: string,
  ): Promise<void> {
    await this.create({
      userId: targetId,
      actorId: raterId,
      title: 'New Rating',
      body: `${raterName} rated you ${score}/5`,
      type: NotificationType.RATING_RECEIVED,
      metadata: { raterId, ratingScore: score },
      actionUrl: `/profile/${raterId}`,
      imageUrl: raterImage,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ADMIN / MODERATION NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Notify admins that a new service suggestion was submitted.
   */
  public async notifySuggestionCreated(adminIds: string[], loungeName: string, suggestionId: string, suggestionName: string): Promise<void> {
    for (const adminId of adminIds) {
      await this.create({
        userId: adminId,
        title: 'New Service Suggestion',
        body: `${loungeName} suggested a new service: "${suggestionName}"`,
        type: NotificationType.SUGGESTION_CREATED,
        metadata: { suggestionId },
        actionUrl: `/admin/suggestions/${suggestionId}`,
      });
    }
  }

  /**
   * Notify lounge that their service suggestion was approved.
   */
  public async notifySuggestionApproved(loungeId: string, suggestionName: string, suggestionId: string): Promise<void> {
    await this.create({
      userId: loungeId,
      title: 'Suggestion Approved',
      body: `Your service suggestion "${suggestionName}" has been approved`,
      type: NotificationType.SUGGESTION_APPROVED,
      metadata: { suggestionId, loungeId },
      actionUrl: `/lounge/services`,
    });
  }

  /**
   * Notify lounge that their service suggestion was rejected.
   */
  public async notifySuggestionRejected(loungeId: string, suggestionName: string, suggestionId: string, reason?: string): Promise<void> {
    const body = reason
      ? `Your service suggestion "${suggestionName}" was rejected: "${reason}"`
      : `Your service suggestion "${suggestionName}" was rejected`;

    await this.create({
      userId: loungeId,
      title: 'Suggestion Rejected',
      body,
      type: NotificationType.SUGGESTION_REJECTED,
      metadata: { suggestionId, loungeId, reason },
      actionUrl: `/lounge/suggestions`,
    });
  }

  /**
   * Notify a user that their content was hidden by moderation.
   */
  public async notifyContentHidden(authorId: string, contentType: 'post' | 'reel' | 'comment', contentId: string, reason?: string): Promise<void> {
    const label = contentType === 'post' ? 'post' : contentType === 'reel' ? 'reel' : 'comment';
    const body = reason
      ? `Your ${label} was hidden by moderation: "${reason}"`
      : `Your ${label} was hidden by moderation for violating community guidelines`;

    await this.create({
      userId: authorId,
      title: 'Content Hidden',
      body,
      type: NotificationType.CONTENT_HIDDEN,
      metadata: {
        [contentType === 'post' ? 'postId' : contentType === 'reel' ? 'reelId' : 'commentId']: contentId,
        targetType: contentType,
        reason,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MARKETPLACE · PRODUCT CATEGORY SUGGESTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Notify admins that a new product category suggestion was submitted.
   */
  public async notifyProductCategorySuggestionCreated(
    adminIds: string[],
    requesterName: string,
    suggestionId: string,
    suggestionName: string,
  ): Promise<void> {
    for (const adminId of adminIds) {
      await this.create({
        userId: adminId,
        title: 'New Product Category Suggestion',
        body: `${requesterName} suggested a new product category: "${suggestionName}"`,
        type: NotificationType.PRODUCT_CATEGORY_SUGGESTION_CREATED,
        metadata: { suggestionId },
        actionUrl: `/admin/marketplace/category-suggestions/${suggestionId}`,
      });
    }
  }

  /**
   * Notify the suggester that their product category suggestion was approved/implemented.
   */
  public async notifyProductCategorySuggestionApproved(userId: string, suggestionName: string, suggestionId: string): Promise<void> {
    await this.create({
      userId,
      title: 'Category Suggestion Approved',
      body: `Your product category suggestion "${suggestionName}" has been approved and is now available in the marketplace`,
      type: NotificationType.PRODUCT_CATEGORY_SUGGESTION_APPROVED,
      metadata: { suggestionId },
      actionUrl: `/marketplace/category-suggestions/${suggestionId}`,
    });
  }

  /**
   * Notify the suggester that their product category suggestion was rejected.
   */
  public async notifyProductCategorySuggestionRejected(userId: string, suggestionName: string, suggestionId: string, reason?: string): Promise<void> {
    const body = reason
      ? `Your product category suggestion "${suggestionName}" was rejected: "${reason}"`
      : `Your product category suggestion "${suggestionName}" was rejected`;

    await this.create({
      userId,
      title: 'Category Suggestion Rejected',
      body,
      type: NotificationType.PRODUCT_CATEGORY_SUGGESTION_REJECTED,
      metadata: { suggestionId, reason },
      actionUrl: `/marketplace/category-suggestions/${suggestionId}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CHAT NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Notify a user that they received a new chat message.
   * Only called when the recipient is NOT currently in the conversation Socket.IO room.
   */
  public async notifyChatMessage(
    recipientId: string,
    senderId: string,
    senderName: string,
    conversationId: string,
    messageId: string,
    preview?: string,
  ): Promise<void> {
    const body = preview ? `${senderName}: ${preview}` : `${senderName} sent you a message`;

    await this.create({
      userId: recipientId,
      actorId: senderId,
      title: 'New Message',
      body,
      type: NotificationType.CHAT_MESSAGE,
      metadata: { conversationId, messageId },
      actionUrl: `/chat/${conversationId}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Send a notification to a specific user with standard booking metadata.
   */
  private async notifyUser(
    userId: string,
    booking: any,
    opts: { title: string; body: string; type: NotificationType; extraMetadata?: Record<string, string | undefined> },
  ): Promise<void> {
    const bookingId = (booking._id || booking.id)?.toString();
    const agentId = this.extractId(booking.agentIds?.[0]) || this.extractId(booking.agentId);
    await this.create({
      userId,
      title: opts.title,
      body: opts.body,
      type: opts.type,
      metadata: {
        bookingId,
        loungeId: this.extractId(booking.loungeId),
        agentId,
        ...opts.extraMetadata,
      },
      actionUrl: bookingId ? `/bookings/${bookingId}` : undefined,
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

  public extractId(ref: any): string | undefined {
    if (!ref) return undefined;
    return (ref._id || ref.id || ref)?.toString();
  }

  public extractName(ref: any): string {
    if (!ref) return 'Someone';
    if (ref.loungeTitle) return ref.loungeTitle;
    if (ref.firstName || ref.lastName) {
      return [ref.firstName, ref.lastName].filter(Boolean).join(' ');
    }
    return 'Someone';
  }

  private extractLoungeTitle(ref: any): string {
    if (!ref) return 'the lounge';
    return ref.loungeTitle || [ref.firstName, ref.lastName].filter(Boolean).join(' ') || 'the lounge';
  }
}

export default NotificationService;
