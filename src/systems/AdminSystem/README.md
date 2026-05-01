<p align="center">
  <img src="../../../assets/frame-logo-animated.svg" alt="Frame Beauty" width="320" />
</p>

# AdminSystem

> The centralized administration dashboard providing platform-wide management capabilities: user CRUD, system health monitoring, content moderation, catalog management facade, and audit logging.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Controllers](#controllers)
- [Services](#services)
- [System Flow](#system-flow)
- [Directory Structure](#directory-structure)

---

## Overview

The AdminSystem acts as a **super-layer** on top of all other systems, giving platform administrators a single interface to manage users, moderate content, oversee the service catalog, monitor system health, and perform operational tasks.

**Key Capabilities:**
- User management (CRUD, block/unblock, session management, password reset)
- System monitoring (health checks, dashboard stats, activity logs)
- Content moderation (hide/unhide/delete posts, reels, comments; review reports)
- Service catalog management (services, categories, suggestions, lounge services)
- Queue population trigger
- Data export and audit logging

> **Note:** The AdminSystem does not own any database models. It operates as a facade, delegating to services from UserManager, FeedContentSystem, ServiceCatalogSystem, BookingSystem, and NotificationSystem.

---

## Architecture

```mermaid
graph TB
    Admin[Admin Client] -->|All requests require<br/>auth + adminMiddleware| Routes["/v1/admin/*"]

    Routes --> IC[IndexController]
    Routes --> SSC[SystemServicesController]
    Routes --> CMC[CatalogManagementController]
    Routes --> ContentMod[ContentModerationController]

    SSC --> SSS[SystemServicesService]
    CMC --> ServS[ServicesService]
    CMC --> SCatS[ServiceCategoriesService]
    CMC --> LSS[LoungeServicesService]
    CMC --> SugS[ServiceSuggestionsService]
    CMC --> QS[QueueService]
    ContentMod --> PS[PostService]
    ContentMod --> RS[ReelService]
    ContentMod --> CS[CommentService]
    ContentMod --> RepS[ReportService]

    SSS --> UM[(UserManager Models)]
    SSS --> BM[(BookingSystem Models)]
    ServS --> SCM[(ServiceCatalog Models)]
    PS --> FCM[(FeedContent Models)]
    RepS --> FCM

    style Admin fill:#e74c3c,color:white
    style Routes fill:#c0392b,color:white
```

### Cross-System Dependencies

```mermaid
graph LR
    AdminSystem -->|User CRUD, block, sessions| UserManager
    AdminSystem -->|Health, stats, export| BookingSystem
    AdminSystem -->|Service/category CRUD| ServiceCatalogSystem
    AdminSystem -->|Post/reel/comment moderation| FeedContentSystem
    AdminSystem -->|Report review| FeedContentSystem
    AdminSystem -->|Queue population| BookingSystem
    AdminSystem -->|Suggestion status| ServiceCatalogSystem
```

---

## API Endpoints

### Base: `/v1/admin` — All endpoints require `authMiddleware` + `adminMiddleware`

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | List all users (paginated, searchable) |
| `GET` | `/users/:id` | Get user details by ID |
| `POST` | `/users` | Create a new user |
| `PUT` | `/users/:id` | Update user data |
| `DELETE` | `/users/:id` | Delete a user |
| `PATCH` | `/users/:id/block` | Toggle user blocked state |
| `GET` | `/session-info` | Get all currently online users |
| `GET` | `/lounges/names` | Get all lounge names (dropdown data) |

### System Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/system/stats` | Aggregate stats across all collections |
| `GET` | `/system/health` | DB connection status, memory usage, uptime |
| `GET` | `/system/activity-log` | Recent user activity (default: last 100) |
| `GET` | `/system/dashboard` | User, booking, revenue dashboard stats |
| `POST` | `/system/users/:userId/clear-sessions` | Clear all sessions for a user |
| `POST` | `/system/users/:userId/reset-password` | Admin reset user password |
| `GET` | `/system/users/:userId/export` | Export user data (profile + bookings + ratings + follows) |
| `POST` | `/system/audit-log` | Create an admin audit log entry |

### Content Moderation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/moderation/posts/:id/hide` | Hide a post |
| `PUT` | `/moderation/posts/:id/unhide` | Unhide a post |
| `DELETE` | `/moderation/posts/:id` | Permanently delete a post |
| `PUT` | `/moderation/reels/:id/hide` | Hide a reel |
| `PUT` | `/moderation/reels/:id/unhide` | Unhide a reel |
| `DELETE` | `/moderation/reels/:id` | Permanently delete a reel |
| `PUT` | `/moderation/comments/:id/hide` | Hide a comment |
| `PUT` | `/moderation/comments/:id/unhide` | Unhide a comment |
| `DELETE` | `/moderation/comments/:id` | Permanently delete a comment |
| `GET` | `/moderation/reports` | List reports (filterable by status) |
| `PUT` | `/moderation/reports/:id` | Review a report (approve/dismiss) |

### Catalog Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/services` | Get services (paginated) |
| `POST` | `/services` | Create a service |
| `POST` | `/services/bulk` | Bulk create services |
| `GET` | `/services/search` | Search services by name |
| `GET` | `/services/category/:categoryId` | Get services by category |
| `GET` | `/services/:id` | Get service by ID |
| `PUT` | `/services/:id` | Update a service |
| `DELETE` | `/services/:id` | Delete a service |
| `GET` | `/service-categories` | List all categories |
| `POST` | `/service-categories` | Create a category |
| `GET` | `/service-categories/search` | Search categories |
| `GET` | `/service-categories/:id` | Get category by ID |
| `PUT` | `/service-categories/:id` | Update a category |
| `DELETE` | `/service-categories/:id` | Delete a category |
| `GET` | `/suggestions/stats` | Suggestion statistics |
| `PATCH` | `/suggestions/:id/status` | Update suggestion status |
| `PATCH` | `/suggestions/:id/approve` | Admin approve suggestion (auto-creates service) |
| `GET` | `/lounge-services` | List lounge services (paginated) |
| `POST` | `/lounge-services/bulk` | Bulk create lounge services |
| `GET` | `/lounge-services/search` | Search lounge services |
| `POST` | `/queue/populate` | Trigger daily queue population |

---

## Controllers

### IndexController

Simple health check / service info endpoint.

```
GET /v1/admin → { name, version, status }
```

### SystemServicesController

Manages platform-level operations and monitoring.

| Method | Input | Output |
|--------|-------|--------|
| `getAllAdminServices()` | — | Aggregate counts from all collections |
| `getSystemHealth()` | — | `{ dbStatus, memoryUsage, uptime, nodeVersion }` |
| `getUserActivityLog(limit?)` | `?limit=100` | Recent user login/signup/action events |
| `getDashboardStats()` | — | `{ totalUsers, totalBookings, revenue, ... }` |
| `clearUserSessions(userId)` | `:userId` | Clears all refresh tokens & sets offline |
| `resetUserPassword(userId, newPassword)` | `:userId`, body | Hashes & updates password |
| `exportUserData(userId)` | `:userId` | `{ user, bookings, ratings, follows }` |
| `createAuditLog(action, userId, details)` | body | Creates audit trail entry |

### CatalogManagementController

Admin facade over ServiceCatalogSystem for managing the platform service catalog.

**Responsibilities:**
- Full CRUD on global services and service categories
- Bulk import of services and lounge services
- Service suggestion workflow management
- Daily queue population trigger

### ContentModerationController

Manages user-generated content moderation across the FeedContentSystem.

**Moderation Flow:**
```mermaid
sequenceDiagram
    participant U as User
    participant FC as FeedContentSystem
    participant Admin as Admin
    participant AM as AdminSystem

    U->>FC: Report post/reel/comment
    FC->>FC: Create Report (status: pending)
    
    Admin->>AM: GET /moderation/reports
    AM->>FC: ReportService.getReports()
    AM-->>Admin: List of pending reports
    
    Admin->>AM: PUT /moderation/reports/:id {status: reviewed}
    AM->>FC: ReportService.reviewReport()
    
    alt Content violates rules
        Admin->>AM: PUT /moderation/posts/:id/hide
        AM->>FC: PostService.hidePost()
    else Content is fine
        Admin->>AM: PUT /moderation/reports/:id {status: dismissed}
    end
```

---

## Services

### SystemServicesService

| Method | Description |
|--------|-------------|
| `getAllAdminServices()` | Runs `countDocuments()` on User, Booking, Post, Reel, Service, LoungeService, etc. |
| `getSystemHealth()` | Checks `mongoose.connection.readyState`, `process.memoryUsage()`, `process.uptime()` |
| `getUserActivityLog(limit)` | Queries recent user records sorted by `updatedAt` |
| `getDashboardStats()` | Aggregates user counts by type, booking counts by status, revenue sums |
| `clearUserSessions(userId)` | Sets `refreshTokens: []`, `sessionTrack.isOnline: false` |
| `resetUserPassword(userId, newPassword)` | Hashes with bcrypt, sets `passwordChangedAt`, clears sessions |
| `exportUserData(userId)` | Joins user profile + bookings + ratings + follows into single export |
| `createAuditLog(action, userId, details)` | Persists admin action for accountability |

---

## System Flow

### Admin Dashboard Load

```mermaid
sequenceDiagram
    participant A as Admin Client
    participant SSC as SystemServicesController
    participant SSS as SystemServicesService
    participant DB as MongoDB

    A->>SSC: GET /v1/admin/system/dashboard
    SSC->>SSS: getDashboardStats()
    SSS->>DB: countDocuments({type:'client'})
    SSS->>DB: countDocuments({type:'lounge'})
    SSS->>DB: countDocuments({type:'agent'})
    SSS->>DB: aggregate bookings by status
    SSS->>DB: sum totalPrice for completed bookings
    SSS-->>SSC: { userCounts, bookingCounts, revenue }
    SSC-->>A: 200 { data: { ... } }

    A->>SSC: GET /v1/admin/system/health
    SSC->>SSS: getSystemHealth()
    SSS->>SSS: mongoose.connection.readyState
    SSS->>SSS: process.memoryUsage()
    SSS->>SSS: process.uptime()
    SSS->>SSS: process.version
    SSS-->>A: 200 { dbStatus, memory, uptime, nodeVersion }
```

### User Block / Unblock Flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant IC as IndexController
    participant UMS as UserManagementService
    participant NS as NotificationService
    participant DB as MongoDB

    A->>IC: PATCH /v1/admin/users/:id/block
    IC->>UMS: toggleBlockUser(userId)
    UMS->>DB: findById + toggle isBlocked
    alt Blocking
        UMS->>DB: Clear refreshTokens (force logout)
        UMS->>NS: notifyAccountBlocked(userId)
    else Unblocking
        UMS->>NS: notifyAccountUnblocked(userId)
    end
    UMS-->>A: 200 { data: updatedUser }
```

### User Management Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Client
    participant API as AdminSystem
    participant UMS as UserManagementService
    participant DB as MongoDB

    Admin->>API: GET /users?search=ahmed&page=1&limit=20
    API->>UMS: findUsersPaginated(search, page, limit)
    UMS->>DB: User.find({name regex}).skip().limit()
    UMS-->>Admin: Paginated user list

    Admin->>API: PATCH /users/:id/block {isBlocked: true}
    API->>UMS: changeUserBlockedState(userId, true)
    UMS->>DB: Update isBlocked, clear sessions if blocked
    UMS-->>Admin: Updated user
```

---

## Security Model

All AdminSystem endpoints enforce **double middleware protection**:

```
authMiddleware   → valid JWT required
    ↓
adminMiddleware  → user.type === 'admin' required
    ↓
Controller method
```

Any request without a valid admin JWT returns `401 Unauthorized`. Any authenticated non-admin user gets `403 Forbidden`.

> **Principle of Least Privilege**: Admin credentials are never created through a public API endpoint. Initial admin seeding is done via the `initAdmin` utility (`src/utils/initAdmin.ts`) which runs once at startup if no admin exists.

---

## Directory Structure

```
AdminSystem/
├── controllers/
│   ├── index.controller.ts            # Service info endpoint
│   ├── systemServices.controller.ts   # System ops & monitoring
│   ├── catalogManagement.controller.ts # Service catalog admin facade
│   └── contentModeration.controller.ts # Content moderation endpoints
├── routes/
│   └── admin.route.ts                 # All admin routes (auth + admin middleware)
├── services/
│   └── systemServices.service.ts      # System operations business logic
└── tests/
    └── admin.test.ts                  # Admin integration tests
```

> **No models, DTOs, or interfaces** — The AdminSystem reuses models and DTOs from the systems it manages.
