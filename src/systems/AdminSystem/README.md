# AdminSystem

Central administration layer for platform operations — user management, content moderation, catalog oversight, queue control, and system health monitoring. All endpoints require JWT + admin role.

## Responsibilities

- **User management** — list, search, block/unblock, delete users; view active sessions
- **System dashboard** — user counts by type, online users, platform health check
- **Content moderation** — hide/unhide posts, reels, comments; process reports
- **Catalog management** — service and category CRUD, suggestion review and implementation
- **Lounge services** oversight — manage lounge service offerings
- **Queue control** — manage walk-in queues across all lounges
- **Index / health** endpoint for ping and system status

## Structure

```
AdminSystem/
├── controllers/    index.controller.ts · systemServices.controller.ts
├── services/       systemServices.service.ts
├── models/         (none — operates on other systems' models)
├── routes/         admin.route.ts · index.route.ts
└── tests/          admin.test.ts
```

## API Routes

All routes are prefixed `/v1/admin` and protected by `authMiddleware` + `adminRole`.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/` | Health check / index |
| GET | `/v1/admin/dashboard` | System stats (users, sessions, health) |
| GET/PUT/DELETE | `/v1/admin/users` | User CRUD and block management |
| GET | `/v1/admin/sessions` | Online users & active sessions |
| PUT | `/v1/admin/content/:type/:id` | Hide/unhide/delete content |
| GET/PUT | `/v1/admin/reports` | List and resolve content reports |
| CRUD | `/v1/admin/services` | Global service catalog |
| CRUD | `/v1/admin/categories` | Service categories |
| GET/PUT | `/v1/admin/suggestions` | Review & implement service suggestions |
| GET/PUT | `/v1/admin/lounge-services` | Manage lounge service offerings |
| GET/PUT | `/v1/admin/queues` | Queue oversight |

## System Dashboard Metrics

| Metric | Description |
|---|---|
| `totalUsers` | All registered accounts |
| `onlineUsers` | Currently connected via WebSocket |
| `blockedUsers` | Accounts with isBlocked = true |
| `adminCount / clientCount / loungeCount` | User type distribution |

## Security

- All endpoints require `Authorization: Bearer <JWT>` with role `admin`
- CSRF token required for all mutation endpoints (POST / PUT / PATCH / DELETE) on web clients

## Dependencies

- **Inbound**: none — admin-initiated only
- **Outbound**: All systems — AdminSystem reads/modifies data across `UserManager`, `FeedContentSystem`, `ServiceCatalogSystem`, `BookingSystem`, `MarketplaceSystem`
