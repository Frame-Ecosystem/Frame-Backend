# Frame Beauty Admin Panel Prompt (Frontend AI Agent)

You are building the Frame Beauty Admin Panel UI for a production platform. Build a clear, high-trust operational interface for administrators.

## Product Goal

Create an admin experience that helps operators:

- Monitor platform health and growth.
- Manage users safely.
- Moderate content quickly.
- Manage service catalog quality.
- Trigger operational actions with explicit confirmations.

The UI must prioritize clarity, speed, and safe actions over visual gimmicks.

## API Base and Auth

- Base URL: `/v1/admin`
- All requests require an admin access token in `Authorization: Bearer <token>`.
- Mutating requests also require CSRF token (`X-CSRF-Token`).

## Required Pages

### 1) Dashboard

Use these endpoints:

- `GET /system/dashboard`
- `GET /system/stats`
- `GET /system/health`

Render:

- KPI cards: total users, online users, blocked users, new users this month.
- Users-by-type breakdown.
- Health card with DB status, process uptime, memory usage.
- Last refresh timestamp.

UX rules:

- Auto-refresh every 60 seconds.
- Manual refresh button with loading state.
- Health status color coding: connected=green, connecting=amber, disconnected=red.

### 2) User Management

Use these endpoints:

- `GET /users?page=&limit=&search=`
- `GET /users/:id`
- `POST /users`
- `PUT /users/:id`
- `PATCH /users/:id/block`
- `DELETE /users/:id`
- `POST /system/users/:userId/clear-sessions`
- `POST /system/users/:userId/reset-password`
- `GET /system/users/:userId/export`

Render:

- Paginated data table with search.
- Side panel or modal for user details.
- User edit form.
- Block/unblock button with confirmation.
- Session clear and force-password-reset actions as destructive controls.

UX rules:

- All destructive actions require explicit confirmation modal with typed confirmation (`CONFIRM`).
- Show API validation errors inline.
- Prevent duplicate submissions with disabled buttons while pending.

### 3) Live Sessions

Use endpoint:

- `GET /session-info`

Render:

- Online user list.
- Last seen, device list, and session state.
- Deep-link into selected user details page.

### 4) Moderation

Use endpoints under `/moderation/*` already exposed by backend.

Render:

- Reports queue with filters.
- Actions to hide/unhide/delete post/reel/comment.
- Review report action with outcome notes.

UX rules:

- Moderation actions should show immediate optimistic row state and then reconcile with server response.
- Keep an audit note input for every moderation action.

### 5) Catalog Operations

Use endpoints under:

- `/services/*`
- `/service-categories/*`
- `/suggestions/*`
- `/lounge-services/*`
- `/queue/populate`

Render:

- Services and categories CRUD screens.
- Suggestion review workflow.
- Queue operation trigger with final confirmation.

## Audit Logging Requirement

For every sensitive admin action, call:

- `POST /system/audit-log`

Payload example:

```json
{
  "action": "ADMIN_USER_FORCE_LOGOUT",
  "details": {
    "targetUserId": "...",
    "reason": "Compromised account"
  }
}
```

Log actions such as:

- user block/unblock
- user delete
- force password reset
- clear sessions
- moderation decisions
- queue population trigger

## Design System Guidance

- Tone: premium operations dashboard (clean, confident, minimal).
- Prioritize readability and operational speed.
- Keep component states explicit: `idle`, `loading`, `success`, `error`, `empty`.
- Use predictable layout:
  - left nav
  - top status bar
  - content area with clear section headers

## Frontend Architecture Expectations

- Use typed API client wrappers for each endpoint group.
- Centralize HTTP error mapping and toast notifications.
- Use query caching/invalidation for list-detail flows.
- Co-locate page components with route-level data hooks.
- Keep forms schema-validated on client and server.

## Non-Functional Requirements

- Mobile/tablet responsive for at least dashboard and user table views.
- Accessibility baseline:
  - keyboard-accessible modals
  - labeled form controls
  - sufficient contrast
- Security baseline:
  - never store tokens in localStorage if secure cookie mode is available
  - sanitize rendered untrusted text

## Delivery Checklist

- Build dashboard page.
- Build user management flows end-to-end.
- Build session monitor page.
- Build moderation queue view.
- Build catalog ops screens.
- Add audit-log instrumentation for sensitive actions.
- Add loading/empty/error states for every async view.
- Add smoke tests for route-level rendering and key admin actions.
