export enum NotificationType {
  BOOKING_CREATED = 'booking:created',
  BOOKING_CONFIRMED = 'booking:confirmed',
  BOOKING_CANCELLED = 'booking:cancelled',
  BOOKING_IN_QUEUE = 'booking:inQueue',
  BOOKING_COMPLETED = 'booking:completed',
  BOOKING_ABSENT = 'booking:absent',
  QUEUE_IN_SERVICE = 'queue:inService',
  QUEUE_AUTO_CANCELLED = 'queue:autoCancelled',
  QUEUE_BACK_IN_QUEUE = 'queue:backInQueue',
  QUEUE_REMINDER = 'queue:reminder',
  QUEUE_POSITION_CHANGED = 'queue:positionChanged',
}

export interface Notification {
  _id?: string;
  userId: string; // The recipient (client or lounge)
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: {
    bookingId?: string;
    loungeId?: string;
    clientId?: string;
    agentId?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
