# FRAME Backend Architecture (Brief)

This document is a concise, implementation-aligned overview of the FRAME backend architecture.

## 1. Overview

FRAME Backend is a modular monolith built with Node.js, TypeScript, Express, and MongoDB.
Domain logic is organized under src/systems, where each system owns its routes, controllers, services, and models.

Core characteristics:
- Single deployable backend service
- Domain-oriented internal structure
- JWT auth with refresh-token sessions
- Real-time events via Socket.IO
- Cloud object storage via Cloudflare R2
- Push notifications via Firebase FCM
- Email delivery via Brevo API with SMTP fallback

## 2. Runtime Topology

```text
Clients (Web / Mobile)
   |
   | HTTPS (REST)
   | WebSocket (Socket.IO)
   v
Express App (Node.js + TypeScript)
   |
   +-- Middlewares
   |    - auth, role, CSRF, rate limit, validation, error handling
   |
   +-- Domain Systems (src/systems/*)
   |    - Auth, UserManager, Booking, Chat, FeedContent,
   |      Marketplace, ServiceCatalog, Notification, Admin
   |
   +-- Shared Services
   |    - SocketService, PushService, EmailService, R2 service
   |
   v
MongoDB Atlas (primary data store)

External Integrations:
- Cloudflare R2 (media/object storage)
- Firebase Cloud Messaging (push)
- Brevo (email API + SMTP fallback)
- Google OAuth 2.0 (Passport strategy)
```

## 3. Domain Systems

1. AuthSystem
- Sign up/login
- JWT issuance and refresh rotation
- Session security controls
- Google OAuth integration

2. UserManager
- User profile/account management
- Follow relationships
- Discovery and filtering
- User state/session updates

3. BookingSystem
- Booking lifecycle
- Queue management
- Queue reminders and transitions
- Booking and queue synchronization

4. ChatSystem
- Direct 1-to-1 chat
- Conversation/message persistence
- Real-time chat signaling

5. FeedContentSystem
- Posts/reels/comments/likes
- Feed retrieval and interaction logic

6. MarketplaceSystem
- Marketplace listing and transaction flows

7. ServiceCatalogSystem
- Service/category management
- Lounge service relationships

8. NotificationSystem
- Notification persistence
- In-app real-time delivery
- Push notification dispatch
- Read/unread lifecycle

9. AdminSystem
- Admin moderation and management
- Cross-system monitoring/reporting

## 4. Internal Layer Pattern

Most systems follow:

```text
Route -> Controller -> Service -> Model
```

Layer responsibilities:
- Routes: endpoint mapping and middleware composition
- Controllers: HTTP translation only
- Services: business logic and orchestration
- Models: persistence schema and queries
- DTOs/Interfaces: validation contracts and types

## 5. Security Architecture

### Authentication and sessions
- Access token: JWT HS256, short-lived (15 min)
- Refresh token: JWT HS256, longer-lived (7 days)
- Refresh token stored hashed (bcrypt)
- Rotation via jti
- Reuse detection revokes sessions on suspicious reuse
- Max active sessions enforced per user

### Authorization
- authMiddleware validates JWT
- role/admin middleware enforces privileged access

### Request protection
- CSRF: double-submit cookie model
- Rate limit tiers per endpoint sensitivity
- DTO validation before service execution

### Query safety
- User input is escaped before regex-based Mongo search
- Prevents regex injection/ReDoS behavior

## 6. Data Architecture

- MongoDB Atlas is the source of truth
- Mongoose handles schema/index/query mapping
- Read-heavy queries commonly use .lean() for lower overhead
- Domain models are separated by bounded responsibility
- Notification data supports TTL-based cleanup

Consistency model:
- Service-level orchestration and validation
- Eventual consistency across domains where appropriate

## 7. Real-Time Architecture

Socket.IO provides near real-time user feedback for:
- Notification events
- Queue updates
- Booking updates
- Chat events

Room naming patterns:
- user:{id}
- notifications:{id}
- lounge:{id}
- chat:{conversationId}

Connection security:
- JWT validated on socket handshake
- Unauthorized connections rejected before room join

## 8. Storage and Media

- Cloudflare R2 used for object/media storage
- Access via S3-compatible SDK
- Backend stores metadata/URLs, not binaries in MongoDB

## 9. Notification Delivery Model

NotificationSystem uses two channels:

1. In-app
- Persist notification
- Emit socket event to user room

2. Push
- Resolve user device tokens
- Dispatch through Firebase FCM

## 10. Email Delivery Model

- Primary: Brevo API
- Fallback: Brevo SMTP

This improves reliability if API-based sending is temporarily unavailable.

## 11. API Surface

- Versioned base path: /v1
- OpenAPI/Swagger docs split by domain in swagger/
- Domain HTTP collections under src/http for testing

## 12. Deployment Snapshot

Current deployment profile:
- Hosted target: Render
- Process options: Node + PM2 configuration
- Infra artifacts available: Dockerfile, docker-compose, nginx config

Operational support files exist for:
- Monitoring scripts
- Deployment scripts
- Production review checklists

## 13. Cross-Cutting Utilities

Shared utilities include:
- Environment validation
- Structured logging helpers
- Swagger bootstrap
- Cron registration
- Centralized error handling

## 14. Tradeoffs

Why modular monolith here:
- Faster feature delivery than full microservices
- Lower operational complexity
- Clear ownership by domain without network overhead

Known tradeoffs:
- Shared runtime can create cross-domain resource contention
- Strong boundaries are needed to avoid tight coupling

## 15. Evolution Direction

Recommended next steps:
1. Strengthen internal event contracts between systems
2. Expand integration coverage for cross-system flows
3. Add richer observability (metrics/tracing per domain)
4. Maintain architecture decision records (ADRs)

## 16. Quick Reference

- Architecture style: modular monolith
- Runtime: Node.js + TypeScript
- Framework: Express
- Database: MongoDB Atlas + Mongoose
- Realtime: Socket.IO
- Storage: Cloudflare R2
- Push: Firebase FCM
- Email: Brevo API + SMTP fallback

This architecture optimizes for delivery speed and product iteration while preserving domain separation and real-time responsiveness.
