# UserManager

Manages all user profile types on the platform: clients, lounge agents, and the social follow graph.

## Responsibilities

- User profile CRUD for **clients** and **lounge agents**
- Role-based user types: `client`, `lounge`, `admin`
- User blocking / unblocking
- Agent assignment to lounges and services
- **Follow / unfollow** social relationships
- Current-user self-service profile management
- Visitor profile tracking (view counts, ratings, bookings)
- Admin-level user management (search, paginate, delete)

## Structure

```
UserManager/
├── controllers/    agent · client · clientVisitorProfile · currentUser · follow · userManagement
├── services/       agent · client · clientVisitorProfile · currentUser · follow · userManagement
├── models/         user.model.ts · agent.model.ts · follow.model.ts
├── routes/         agent · client · currentUser · follow
├── dtos/           user.dto.ts · agent.dto.ts
├── interfaces/     user.interface.ts · agent.interface.ts · follow.interface.ts
└── tests/          currentUser.test.ts
```

## Key Entities

| Entity | Description |
|---|---|
| `User` | Base account — email/phone, type, profileImage, isBlocked, sessionTrack |
| `Agent` | Beauty/wellness provider — agentName, loungeId, idLoungeService[], acceptQueueBooking |
| `Follow` | Directional follow relationship between two users |

## User Types

| Type | Description |
|---|---|
| `client` | Regular end-user booking services |
| `lounge` | Business account owning a lounge |
| `admin` | Platform administrator |

## API Routes

| Method | Path | Description |
|---|---|---|
| GET/PUT/DELETE | `/v1/users/me` | Current user profile |
| GET/PUT | `/v1/users/client/:id` | Client profile |
| GET/PUT | `/v1/users/agent/:id` | Agent profile |
| POST/DELETE | `/v1/follow/:id` | Follow / unfollow |
| GET | `/v1/profile/:id` | Visitor profile view |
| CRUD | `/v1/admin/users` | Admin user management |

## Dependencies

- **Inbound**: `AuthSystem` (creates user on signup), `BookingSystem`, `ServiceCatalogSystem`, `FeedContentSystem`
- **Outbound**: `NotificationSystem` (follow notifications)
