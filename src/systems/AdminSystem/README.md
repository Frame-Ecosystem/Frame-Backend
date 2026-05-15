# AdminSystem

AdminSystem is the operational control surface for Frame Beauty. It is implemented as a facade over multiple bounded systems and exposes a single, secured admin API namespace.

This document is intentionally written as an architecture and flow resource for frontend implementation and AI-assisted frontend updates.

## 1. System Conception

AdminSystem is designed around three core conceptions:

- Conception A: Unified control plane
	- Admin users interact with one API root (`/v1/admin`) even though data and behavior live in different backend systems.

- Conception B: Thin orchestration, delegated domain logic
	- AdminSystem composes and orchestrates operations but avoids duplicating domain rules owned by User, Catalog, Moderation, or Booking domains.

- Conception C: High-trust operations with explicit safeguards
	- Sensitive actions require role gating, CSRF protection for mutation routes, DTO validation, and audit trails.

## 2. Security and Trust Model

All admin routes are protected in this order:

1. `authMiddleware`
2. `adminMiddleware`

Operational implications for frontend:

- Missing or invalid token: expect 401.
- Authenticated non-admin user: expect 403.
- Validation failures: expect 400 with structured error message.
- Frontend should treat all mutation flows as privileged and confirmable actions.

## 3. Architecture Overview

Admin routing is split into domain sub-routers for long-term maintainability:

- Users router: user CRUD and session-presence endpoints
- System router: health/stats/dashboard/export/reset/audit endpoints
- Moderation router: content moderation and report review
- Catalog router: services/categories/suggestions/lounge-services/queue operations

### High-level component model

```mermaid
flowchart LR
	A[Admin Frontend] --> B[/v1/admin]
	B --> C[Users Sub-router]
	B --> D[System Sub-router]
	B --> E[Moderation Sub-router]
	B --> F[Catalog Sub-router]

	C --> U[UserManagementService]
	D --> S[SystemServicesService]
	E --> M[Content Moderation Services]
	F --> G[Catalog Services]

	S --> L[AdminAuditLog Model]
```

## 4. Domain Capabilities and Endpoint Map

### 4.1 Users domain

- `GET /v1/admin/users`
- `GET /v1/admin/users/:id`
- `POST /v1/admin/users`
- `PUT /v1/admin/users/:id`
- `DELETE /v1/admin/users/:id`
- `PATCH /v1/admin/users/:id/block`
- `GET /v1/admin/session-info`
- `GET /v1/admin/lounges/names`

### 4.2 System domain

- `GET /v1/admin/system/stats`
- `GET /v1/admin/system/health`
- `GET /v1/admin/system/activity-log?limit=100`
- `GET /v1/admin/system/dashboard`
- `POST /v1/admin/system/users/:userId/clear-sessions`
- `POST /v1/admin/system/users/:userId/reset-password`
- `GET /v1/admin/system/users/:userId/export`
- `POST /v1/admin/system/audit-log`

### 4.3 Moderation domain

- Post moderation (`hide`, `unhide`, `delete`)
- Reel moderation (`hide`, `unhide`, `delete`)
- Comment moderation (`hide`, `unhide`, `delete`)
- Report listing and review

### 4.4 Catalog domain

- Services CRUD and search
- Service categories CRUD and search
- Suggestion statistics, status update, admin approve
- Lounge-services listing/bulk/search
- Queue population trigger

## 5. Core Flows by Case

### Case 1: Dashboard bootstrap

Frontend sequence:

1. Fetch `GET /system/dashboard`
2. Fetch `GET /system/stats`
3. Fetch `GET /system/health`

Recommended behavior:

- Render cards from partial data if one call fails.
- Mark health widget separately from business KPIs.
- Refresh with controlled polling (for example every 60 seconds).

### Case 2: User search and lifecycle actions

Frontend sequence:

1. `GET /users?page=&limit=&search=`
2. Optional detail read: `GET /users/:id`
3. Mutations: create/update/block/delete

Recommended behavior:

- Keep list and detail state separated.
- Invalidate list cache after mutation success.
- Use explicit confirmation for block/delete actions.

### Case 3: Security intervention on account

Use when compromised session or account risk is detected.

Frontend sequence:

1. `POST /system/users/:userId/clear-sessions`
2. `POST /system/users/:userId/reset-password`
3. `POST /system/audit-log` with action + details

Recommended behavior:

- Always log operator intent in audit details.
- Show irreversible warning before password reset.

### Case 4: Export user snapshot

Frontend sequence:

1. `GET /system/users/:userId/export`

Response concept:

- user profile payload
- export timestamp
- metadata summary (`hasActiveSession`, `refreshTokenCount`)

Recommended behavior:

- Show export metadata in UI before download/copy action.
- Avoid exposing sensitive backend-only fields in frontend tables.

### Case 5: Moderation review loop

Frontend sequence:

1. `GET /moderation/reports`
2. Review report action
3. Optional content action (`hide/unhide/delete`)
4. `POST /system/audit-log`

Recommended behavior:

- Keep report status and content state in sync in one UI transaction.
- Support optimistic UI with rollback on failure.

### Case 6: Catalog governance and queue operation

Frontend sequence:

1. Manage services/categories/suggestions via respective endpoints
2. Trigger queue population via `POST /queue/populate`
3. Log high-impact actions with audit endpoint

Recommended behavior:

- Protect bulk operations with confirmation and progress indicator.
- Track last execution timestamp for queue population in admin UI state.

## 6. Validation and Contract Behavior

System DTO validation currently enforces:

- `userId` path checks for sensitive system-user operations
- query `limit` bounds for activity log
- password constraints for admin reset password
- audit log action/details payload shape

Frontend implications:

- Validate early on client but treat backend validation as source of truth.
- Surface backend validation messages directly in form-level error UI.

## 7. Frontend State Architecture Guidance

Suggested frontend module split:

- AdminDashboard module
- AdminUsers module
- AdminSystemOps module
- AdminModeration module
- AdminCatalog module

Suggested shared primitives:

- Central API client for `/v1/admin`
- Auth/CSRF interceptors
- Domain query keys (dashboard, users, moderation, catalog)
- Global action logger utility that calls `/system/audit-log`

## 8. Recommended UI Pages and Data Dependencies

- Dashboard page
	- Depends on: `/system/dashboard`, `/system/stats`, `/system/health`

- Users page
	- Depends on: `/users`, `/users/:id`, `/session-info`, `/lounges/names`

- Moderation page
	- Depends on: `/moderation/reports`, moderation mutation endpoints

- Catalog page
	- Depends on services/categories/suggestions/lounge-services endpoints

- Operations page
	- Depends on: reset password, clear sessions, export, queue populate, audit log

## 9. File Index for Backend and Frontend Agents

- `routes/admin.route.ts`
- `routes/admin/users.route.ts`
- `routes/admin/system.route.ts`
- `routes/admin/moderation.route.ts`
- `routes/admin/catalog.route.ts`
- `controllers/systemServices.controller.ts`
- `services/systemServices.service.ts`
- `dtos/systemServices.dto.ts`
- `interfaces/systemServices.interface.ts`
- `models/auditLog.model.ts`
- `tests/admin.routes.test.ts`
- `tests/systemServices.service.test.ts`
- `src/systems/AdminSystem/FRONTEND_ADMIN_PROMPT.md`

## 10. Summary

AdminSystem should be treated by frontend as a secure orchestration gateway with four operational domains. Implement UI flows around explicit, auditable operator actions, domain-based state boundaries, and strong error handling for privileged operations.
