# BookingSystem

Manages service appointments and real-time walk-in queues at lounges. Includes analytics and automated cron-based queue lifecycle management.

## Responsibilities

- Create, confirm, update, and cancel **service bookings**
- Multi-agent, multi-service bookings with price + duration calculation
- Real-time **walk-in queue** management (position, status changes)
- Queue reminders and auto-completion via **cron jobs**
- **Booking analytics** (revenue, frequency, trends per lounge)
- Real-time status updates via WebSocket
- Push notifications for booking and queue events

## Structure

```
BookingSystem/
├── controllers/    booking.controller.ts · queue.controller.ts
├── services/       booking.service.ts · booking.helpers.ts · bookingAnalytics.service.ts
│                   queue.service.ts · queue.helpers.ts · queue-cron.service.ts · queueCron.service.ts
├── models/         booking.model.ts · queue.model.ts
├── routes/         booking.route.ts · queue.route.ts
├── dtos/           booking.dto.ts · queue.dto.ts
├── interfaces/     booking.interface.ts · queue.interface.ts
└── tests/          queue.test.ts
```

## Key Entities

| Entity | Description |
|---|---|
| `Booking` | Appointment — clientId, loungeId, agentIds[], loungeServiceIds[], status, bookingDate, totalPrice |
| `Queue` | Lounge walk-in queue — list of QueuePersons with position & status |

## Booking Statuses

`PENDING` → `CONFIRMED` → `COMPLETED` | `CANCELLED`

## Queue Person Statuses

`WAITING` → `SERVING` → `COMPLETED` | `NO_SHOW`

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/v1/bookings` | Create booking |
| GET | `/v1/bookings/:id` | Get booking details |
| PUT | `/v1/bookings/:id` | Update booking |
| DELETE | `/v1/bookings/:id` | Cancel booking |
| GET | `/v1/bookings/analytics` | Booking analytics |
| GET/POST | `/v1/queue/:loungeId` | Get / add to queue |
| PUT | `/v1/queue/:loungeId/person/:id` | Update queue person |

## Dependencies

- **Inbound**: `UserManager` (client/agent), `ServiceCatalogSystem` (lounge services)
- **Outbound**: `NotificationSystem` (booking & queue events), `UserManager` (agent model)
