# NotificationSystem

Delivers real-time and push notifications to users across all platform events — bookings, social interactions, marketplace orders, and system alerts.

## Responsibilities

- Persist **notification records** in the database
- Deliver real-time notifications via **WebSocket** (Socket.IO)
- Send **device push notifications** via FCM (Firebase Cloud Messaging)
- Support paginated notification history with category filtering
- Mark notifications as read / unread
- Serve as a shared dependency consumed by all other systems

## Structure

```
NotificationSystem/
├── controllers/    notification.controller.ts
├── services/       notification.service.ts · push.service.ts · socket.service.ts
├── models/         notification.model.ts
├── routes/         notification.route.ts
├── dtos/           notification.dto.ts
└── interfaces/     notification.interface.ts
```

## Key Entities

| Entity | Description |
|---|---|
| `Notification` | userId, actorId, title, body, type, category, isRead, metadata |

## Notification Categories

| Category | Triggered By |
|---|---|
| `SOCIAL` | Likes, comments, follows, mentions |
| `BOOKING` | Booking confirmations, cancellations, reminders |
| `QUEUE` | Queue position updates, turn notifications |
| `MARKETPLACE` | Order status changes, new reviews |
| `SYSTEM` | Admin alerts, account notices |

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/v1/notifications` | Paginated notification list (optional category filter) |
| PUT | `/v1/notifications/:id/read` | Mark single notification as read |
| PUT | `/v1/notifications/read-all` | Mark all as read |

## Service Architecture

| Service | Role |
|---|---|
| `NotificationService` | Singleton — creates DB records and dispatches to push + socket |
| `SocketService` | Singleton — manages Socket.IO connections per user |
| `PushService` | Sends FCM push notifications to registered device tokens |

## Dependencies

- **Inbound**: Consumed by `BookingSystem`, `FeedContentSystem`, `MarketplaceSystem`, `UserManager` — all call `NotificationService` directly
- **Outbound**: `UserManager` (user device tokens), Firebase FCM
