# AdminSystem

Centralized admin API surface for Frame Beauty. The system aggregates operations from other bounded systems (users, catalog, moderation, queue) and exposes them behind strict admin authorization.

## Goals

- Keep the admin surface explicit, predictable, and secure.
- Reuse domain services instead of duplicating business logic.
- Keep controllers thin and push rules into DTO validation and services.
- Maintain API-to-doc parity so frontend and QA always have one source of truth.

## Scope

Admin routes are mounted at `/v1/admin` and protected by:

1. `authMiddleware`
2. `adminMiddleware`

Main capability groups:

- User management: list/get/create/update/delete/toggle-block users.
- Session and profile operations: online sessions, lounge names.
- System services: stats, health, dashboard, activity log, reset password, export user data.
- Moderation operations: reports and post/reel/comment moderation actions.
- Catalog operations: services/categories/suggestions/lounge-services/queue population.

## Current Architecture

AdminSystem is a facade layer:

- Route composition in `routes/admin.route.ts`
- Controller orchestration in `controllers/*.ts`
- System-specific operational logic in `services/systemServices.service.ts`
- DTO-based input validation in `dtos/systemServices.dto.ts`
- Persisted admin audit events in `models/auditLog.model.ts`

The system intentionally delegates user and catalog logic to their owning systems instead of mirroring model logic in AdminSystem.

## API Contract Notes

### User management endpoints

- `GET /v1/admin/users`
- `GET /v1/admin/users/:id`
- `POST /v1/admin/users`
- `PUT /v1/admin/users/:id`
- `DELETE /v1/admin/users/:id`
- `PATCH /v1/admin/users/:id/block`
- `GET /v1/admin/session-info`
- `GET /v1/admin/lounges/names`

### System services endpoints

- `GET /v1/admin/system/stats`
- `GET /v1/admin/system/health`
- `GET /v1/admin/system/activity-log?limit=100`
- `GET /v1/admin/system/dashboard`
- `POST /v1/admin/system/users/:userId/clear-sessions`
- `POST /v1/admin/system/users/:userId/reset-password`
- `GET /v1/admin/system/users/:userId/export`
- `POST /v1/admin/system/audit-log`

### Validation standards

- Path params use explicit DTO validation where needed (for example `userId` MongoId checks on system-user endpoints).
- Body payloads for sensitive operations (`reset-password`, `audit-log`) are validated via class-validator DTOs.
- Query params are validated (`activity-log` limit is clamped by DTO + service hard limit).

## Engineering Conventions

- Prefer `Promise.all` for independent counters/queries.
- Keep domain error shape consistent via `HttpException` hierarchy.
- Revoke sessions on admin-forced password resets.
- Persist audit logs for traceability and incident response.
- Keep route files readable through grouped `router.route()` declarations.

## Files Worth Knowing

- `controllers/systemServices.controller.ts`
- `services/systemServices.service.ts`
- `dtos/systemServices.dto.ts`
- `models/auditLog.model.ts`
- `interfaces/systemServices.interface.ts`
- `routes/admin.route.ts`
- `tests/admin.routes.test.ts`

## Frontend Integration

For the frontend AI agent prompt and admin panel planning, use:

- `src/systems/AdminSystem/FRONTEND_ADMIN_PROMPT.md`

That file is intentionally product-focused and UI-ready. This README is backend-focused and implementation-oriented.
