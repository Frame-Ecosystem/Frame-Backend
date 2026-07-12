<p align="center">
  <img src="assets/frame-logo-animated.svg" alt="Frame Beauty" width="320" />
</p>

<h1 align="center">Frame Beauty — Backend API</h1>

<p align="center">
  Enterprise backend for the Frame Beauty salon & booking platform.<br/>
  Node.js · TypeScript · Express · MongoDB · Socket.IO · Cloudflare R2 · Firebase FCM
</p>

---

## Table of Contents

1. [Stack](#stack)
2. [Quick Start](#quick-start)
3. [Environment Variables](#environment-variables)
4. [Systems Overview](#systems-overview)
5. [Email Service](#email-service)
6. [Real-Time (Socket.IO)](#real-time-socketio)
7. [Health Endpoints](#health-endpoints)
8. [CSRF for Web Clients](#csrf-for-web-clients)
9. [Deployment](#deployment)
10. [Scripts](#scripts)
11. [Architecture Reference](#architecture-reference)

---

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | ≥ 18 |
| Language | TypeScript | 5.x |
| Framework | Express | 4.18 |
| Database | MongoDB + Mongoose | 6+ / 6.5.x |
| Real-Time | Socket.IO | 4.8 |
| Compiler | SWC | latest |
| File Storage | Cloudflare R2 (S3-compatible) | — |
| Push Notifications | Firebase Admin SDK (FCM) | 12 |
| Auth | JWT (HS256) + Google OAuth 2.0 | — |
| Process Manager | PM2 (cluster mode) | latest |
| Reverse Proxy | Nginx | latest |
| Containerization | Docker + Docker Compose | latest |

---

## Quick Start

**1. Install dependencies:**
```bash
npm install
```

**2. Create local env file:**
```bash
cp .env.example .env
```

**3. Fill required values:**

At minimum: `MONGO_URI`, `SECRET_KEY`, `REFRESH_TOKEN_SECRET`.  
For email: `BREVO_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `SMTP_FROM`.  
For OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.  
For storage: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

> **LAN development:** Local frontend/backend URLs are automatically rewritten to use your machine's LAN IP, so magic links and OAuth callbacks work when tested on a phone over Wi-Fi.

**4. Run development server:**
```bash
npm run dev
```

Swagger UI is available at `http://<LAN_IP>:2000/api-docs`.

---

## Environment Variables

All required variables are validated at startup. The server **refuses to start** if any required variable is missing.

### Application

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` \| `production` \| `test` |
| `PORT` | Yes | HTTP port (default `3000`; Render uses `10000`) |
| `LOG_FORMAT` | No | Morgan format (default `combined`) |
| `LOG_DIR` | No | Log directory (default `logs/`) |

### Security

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT access token signing secret (≥ 32 chars, different from refresh secret) |
| `REFRESH_TOKEN_SECRET` | Yes | JWT refresh token signing secret |
| `CSRF_SECRET` | No | CSRF token secret (falls back to `SECRET_KEY` if unset) |
| `CREDENTIALS` | No | Set `true` to allow cookies with `credentials: include` |

### MongoDB

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | Full MongoDB connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/dbname`) |

### CORS & URLs

| Variable | Required | Description |
|----------|----------|-------------|
| `ORIGIN` | Yes | Allowed CORS origin(s), comma-separated |
| `FRONTEND_BASE_URL` | No | Frontend app URL — used for OAuth redirects (defaults to `https://framebeauty.tn` in production) |
| `BACKEND_BASE_URL` | No | This server's public URL (defaults to `https://frame-backend-apis.onrender.com` in production) |
| `MAGIC_LINK_BASE_URL` | No | Base URL for email links (magic link, password reset). Defaults to `FRONTEND_BASE_URL`. **Must be set on Render dashboard.** |
| `GOOGLE_REDIRECT_URI` | No | Google OAuth callback URL (defaults to `BACKEND_BASE_URL/v1/auth/google/callback`) |

### Google OAuth

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | No | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth 2.0 client secret |

### Cloudflare R2

| Variable | Required | Description |
|----------|----------|-------------|
| `R2_ACCOUNT_ID` | No | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | No | R2 access key ID |
| `R2_SECRET_ACCESS_KEY` | No | R2 secret access key |
| `R2_BUCKET_NAME` | No | R2 bucket name (e.g. `frame-storage`) |
| `R2_PUBLIC_URL` | No | Public CDN base URL for R2 assets |

### Firebase FCM

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | No | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | No | Firebase private key (newlines as `\n`) |

### Email (Brevo)

| Variable | Required | Description |
|----------|----------|-------------|
| `BREVO_API_KEY` | Yes (email) | Brevo transactional email API key — primary send channel |
| `SMTP_HOST` | Yes (email) | SMTP relay host (e.g. `smtp-relay.brevo.com`) |
| `SMTP_PORT` | Yes (email) | SMTP port (`587` for STARTTLS) |
| `BREVO_SMTP_USER` | Yes (email) | Brevo SMTP username (your Brevo account email) |
| `BREVO_SMTP_KEY` | Yes (email) | Brevo SMTP password / API key for SMTP |
| `SMTP_FROM` | Yes (email) | From address (e.g. `Frame Beauty <noreply@framebeauty.tn>`) |

### Admin Bootstrap

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLE_ADMIN_BOOTSTRAP` | No | Set `true` once to auto-create the admin user on first boot. Set back to `false` immediately after. |
| `ADMIN_EMAIL` | No | Admin email for bootstrap |
| `ADMIN_PASSWORD` | No | Admin password for bootstrap |

---

## Systems Overview

The API is organized into **9 independent vertical systems**, each owning its own models, services, controllers, routes, and DTOs.

### AuthSystem — `/v1/auth`
Handles all authentication flows.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/auth/signup` | Register with email + password; sends magic link |
| `GET` | `/v1/auth/verify` | Verify magic link token, returns access + refresh tokens |
| `POST` | `/v1/auth/login` | Email/password login |
| `POST` | `/v1/auth/logout` | Invalidate current session |
| `POST` | `/v1/auth/logout-all` | Invalidate all sessions (all devices) |
| `POST` | `/v1/auth/refresh-token` | Rotate refresh token, return new access token |
| `POST` | `/v1/auth/forgot-password` | Send password reset email |
| `POST` | `/v1/auth/reset-password` | Reset password with token |
| `GET` | `/v1/auth/csrf-token` | Get CSRF token for web clients |
| `GET` | `/v1/auth/google/login` | Google OAuth login |
| `GET` | `/v1/auth/google/signup` | Google OAuth signup (pass `?type=client`) |
| `GET` | `/v1/auth/google/callback` | Google OAuth callback |

**Features:** Magic link signup · bcrypt passwords · brute-force lockout (5 attempts → 15 min) · JWT access tokens (15 min) + refresh tokens (7 days, rotation) · max 5 sessions per user · Google OAuth 2.0

---

### UserManager — `/v1/me`, `/v1/client`, `/v1/agents`, `/v1/follows`
Manages user identities, profiles, agent CRUD, and the follow system.

| Route Group | Base Path | Auth |
|-------------|-----------|------|
| Current User | `/v1/me` | JWT required |
| Client Browse | `/v1/client` | JWT required |
| Agent CRUD | `/v1/agents` | Lounge / Admin |
| Agent Self | `/v1/agents/me` | Agent JWT |
| Lounge Self | `/v1/lounge/me` | Lounge JWT |
| Follow System | `/v1/follows` | JWT required |

**Features:** Profile update (bio, images, location, theme, language) · password change · email re-verification · lounge discovery with geolocation (`$nearSphere`) · agent management (create/assign to services/toggle queue) · follow/unfollow with denormalized counts · client visitor profile view

---

### BookingSystem — `/v1/bookings`, `/v1/queues`
Full booking lifecycle and real-time queue management.

**Booking status flow:** `pending → confirmed → inQueue → completed` (or `cancelled` / `absent`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/bookings` | Create booking |
| `GET` | `/v1/bookings` | List bookings (role-scoped) |
| `GET` | `/v1/bookings/:id` | Get booking |
| `PATCH` | `/v1/bookings/:id/status` | Update booking status |
| `DELETE` | `/v1/bookings/:id` | Cancel/delete booking |
| `GET` | `/v1/queues` | Get agent queue |
| `POST` | `/v1/queues/:agentId/add` | Add person to queue |
| `PATCH` | `/v1/queues/:agentId/next` | Advance queue |
| `DELETE` | `/v1/queues/:agentId/remove/:bookingId` | Remove from queue |

**Features:** Multi-agent multi-service bookings · walk-in (anonymous) support · real-time `queueUpdated` / `bookingCreated` / `bookingUpdated` Socket.IO events · cron jobs (booking reminders, stale booking cleanup, past queue cleanup)

---

### ServiceCatalogSystem — `/v1/services`, `/v1/service-categories`, `/v1/lounge-services`, `/v1/service-suggestions`, `/v1/ratings`, `/v1/lounge`
Two-tier beauty service catalog.

**Global catalog** (admin-managed): service categories → services  
**Lounge catalog**: per-lounge service offerings with custom price, duration, gender targeting, and agent assignments

**Features:** Service suggestion workflow (lounge submits → admin approves/rejects → auto-creates global service) · client ratings (1–5 stars, one per lounge) · lounge-level `queueBookingEnabled` toggle per agent

---

### FeedContentSystem — `/v1/posts`, `/v1/reels`, `/v1/comments`, `/v1/likes`, `/v1/feed`, `/v1/reports`
Social content layer.

| Resource | Description |
|----------|-------------|
| Posts | Image/caption content by lounges |
| Reels | Short video content by lounges |
| Comments | Threaded comments on posts and reels |
| ContentLikes | Like/unlike posts and reels |
| Likes | Clients like lounges (separate from content likes) |
| Saves | Bookmark content |
| Hashtags | Trending topics, auto-tracked on post/reel create |
| Feed | Following feed, explore feed, hashtag feed, saved feed |
| Reports | Content abuse reports with admin review workflow |

**Features:** Denormalized `likesCount`, `commentsCount`, `savesCount` (atomic `$inc`) · hashtag trending · paginated feeds · admin moderation (hide/unhide/delete content, review reports)

---

### ChatSystem — `/v1/chat`
1-to-1 direct messaging with real-time Socket.IO.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/conversations` | Find or create conversation |
| `GET` | `/v1/chat/conversations` | List user's conversations |
| `GET` | `/v1/chat/conversations/:id/messages` | Get messages (cursor pagination) |
| `POST` | `/v1/chat/conversations/:id/messages` | Send message |
| `PATCH` | `/v1/chat/messages/:id` | Edit message |
| `DELETE` | `/v1/chat/messages/:id` | Delete message (self / recall for everyone) |
| `POST` | `/v1/chat/messages/:id/reactions` | Add/remove reaction |
| `POST` | `/v1/chat/conversations/:id/read` | Mark messages as read |

**Features:** Mutual follow guard (both users must follow each other; admins bypass) · stable conversation slug (`[idA,idB].sort().join('_')`) for atomic upsert · cursor pagination (no `countDocuments`) · file/image attachments via R2 · `typing` indicator with 2 s server-side throttle · `messageRead` receipts · `messageReaction` emoji reactions

---

### NotificationSystem — `/v1/notifications`
Three-channel notification delivery: in-app (MongoDB), real-time (Socket.IO), push (Firebase FCM).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/notifications` | Get user's notifications (paginated) |
| `PATCH` | `/v1/notifications/:id/read` | Mark one as read |
| `PATCH` | `/v1/notifications/read-all` | Mark all as read |
| `DELETE` | `/v1/notifications/:id` | Delete one notification |

**27 notification types** across 6 categories: `booking` (6) · `queue` (6) · `social` (3) · `content` (4) · `system` (5) · `marketplace` (3)  
**TTL:** Notifications auto-delete after 90 days via MongoDB TTL index.

---

### MarketplaceSystem — `/v1/marketplace/*`
Full e-commerce marketplace for beauty products.

| Route Group | Base Path |
|-------------|-----------|
| Stores | `/v1/marketplace/stores` |
| Products | `/v1/marketplace/products` |
| Orders | `/v1/marketplace/orders` |
| Cart | `/v1/marketplace/cart` |
| Reviews | `/v1/marketplace/reviews` |
| Wishlists | `/v1/marketplace/wishlist` |
| Product Categories | `/v1/marketplace/product-categories` |
| Category Suggestions | `/v1/marketplace/product-category-suggestions` |
| Analytics | `/v1/marketplace/analytics` |

**Features:** Lounge-owned stores with `slug` · product catalog with variants, stock, SKU · 3 payment methods · multi-status order lifecycle · persistent cart · verified-purchase reviews · wishlist · product category suggestion workflow (lounge → admin approval) · store & product analytics

---

### AdminSystem — `/v1/admin`
Platform-wide administration dashboard. **No own models** — pure facade over all other systems.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/admin/users` | List all users (paginated, searchable) |
| `GET/POST/PUT/DELETE` | `/v1/admin/users/:id` | Full user CRUD |
| `PATCH` | `/v1/admin/users/:id/block` | Toggle user blocked |
| `GET` | `/v1/admin/session-info` | All currently online users |
| `GET` | `/v1/admin/stats` | Dashboard statistics |
| `GET` | `/v1/admin/health` | System health check |
| `GET` | `/v1/admin/export` | Export data |
| `POST/PATCH/DELETE` | `/v1/admin/services/*` | Service catalog CRUD |
| `POST/PATCH/DELETE` | `/v1/admin/service-categories/*` | Category CRUD |
| `GET/PATCH` | `/v1/admin/service-suggestions/*` | Review service suggestions |
| `PATCH` | `/v1/admin/posts/:id/hide` | Hide/unhide post |
| `PATCH` | `/v1/admin/reels/:id/hide` | Hide/unhide reel |
| `DELETE` | `/v1/admin/comments/:id` | Delete comment |
| `GET/PATCH` | `/v1/admin/reports/*` | Review content reports |

**All endpoints require `authMiddleware` + `adminMiddleware`.**

---

## Email Service

The email service (`src/shared/services/email.service.ts`) uses **Brevo API as the primary channel** with a **Brevo SMTP relay fallback**.

```
1. Brevo REST API  →  POST https://api.brevo.com/v3/smtp/email
   • 3 attempts total: immediate + 500 ms retry + 1 000 ms retry
   • 5 s per-request timeout
   • Uses: BREVO_API_KEY
   ↓ (if all 3 fail)
2. Brevo SMTP relay  →  nodemailer transporter
   • Uses: SMTP_HOST, SMTP_PORT, BREVO_SMTP_USER, BREVO_SMTP_KEY
```

The `SMTP_FROM` variable controls the sender name/address for both channels.

> **Production note:** If deploying on Render, ensure the outbound IP `74.220.51.24` is added to your Brevo **Authorised IPs** list at https://app.brevo.com/security/authorised_ips, otherwise API-key requests will be rejected.

---

## Real-Time (Socket.IO)

Connect with a valid JWT in the handshake `auth` field:

```js
const socket = io('wss://frame-backend-apis.onrender.com', {
  auth: { token: 'Bearer <accessToken>' }
});
```

### Rooms

| Room | Who joins | Events received |
|------|-----------|-----------------|
| `user:{userId}` | All authenticated users | `bookingCreated`, `bookingUpdated`, `bookingDeleted`, `conversationUpdated` |
| `lounge:{loungeId}` | Lounge + its agents | `queueUpdated`, `bookingCreated` |
| `chat:{conversationId}` | Conversation participants (explicit join) | `newMessage`, `messageEdited`, `messageDeleted`, `messageRead`, `messageReaction`, `typing` |
| `notifications:{userId}` | All authenticated users | `notification` |

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `joinConversation` | `{ conversationId }` | Join a chat room |
| `leaveConversation` | `{ conversationId }` | Leave a chat room |
| `typing` | `{ conversationId, isTyping }` | Broadcast typing status (throttled 2 s server-side) |

---

## Health Endpoints

```
GET /health   → basic service health (HTTP 200 + uptime)
GET /ready    → readiness probe (checks MongoDB + Socket.IO status)
```

---

## CSRF for Web Clients

1. Call `GET /v1/auth/csrf-token` with `credentials: 'include'`.
2. Read `csrfToken` from the response body (or the `csrf-token` cookie).
3. Send it on all **mutating** requests (`POST`, `PUT`, `PATCH`, `DELETE`) as the `x-csrf-token` header.
4. Login and token-refresh responses also return and set a fresh CSRF token.

---

## Security Notes

- Never commit `.env` or `.env.production` (both are git-ignored).
- Set `ENABLE_ADMIN_BOOTSTRAP=false` after the admin user is created.
- `SECRET_KEY` and `REFRESH_TOKEN_SECRET` must be different strings of ≥ 32 characters.
- Brute-force protection: 5 failed logins → 15-minute lockout.
- Tokens use rotation: each refresh invalidates the old token. Reuse of a consumed refresh token is treated as a security breach.

---

## Deployment

### Render (production)

1. Set **all required env vars** directly in the Render dashboard (the `.env.production` file is not auto-read by Render).
2. Ensure `MAGIC_LINK_BASE_URL=https://framebeauty.tn` is set in the Render env vars.
3. Add the Render outbound IP to Brevo's Authorised IPs list.
4. The production backend URL is `https://frame-backend-apis.onrender.com`.

### Docker Compose

```bash
docker-compose up -d           # Start full stack (Nginx + API + MongoDB)
docker-compose logs -f api     # Stream API logs
```

### PM2 (bare-metal / VPS)

```bash
npm run build                  # SWC compile → dist/
npm run deploy:prod            # pm2 start ecosystem.config.js --only frame-beauty-prod
pm2 status                     # Check process status
pm2 logs frame-beauty-prod     # View live logs
```

PM2 runs in **cluster mode** (`instances: 'max'`) — one worker per CPU core.

### Development

```bash
npm run dev    # nodemon + SWC watch (reloads on save)
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server with hot-reload (nodemon + SWC) |
| `npm run build` | Compile source with SWC → `dist/` |
| `npm run build:tsc` | Type-check only (`tsc && tsc-alias`), no output |
| `npm start` | Build then run production server |
| `npm test` | Run Jest test suite |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run deploy:prod` | Build + PM2 production start |
| `npm run deploy:dev` | PM2 dev process start |
| `npm run docker:up` | Start Docker Compose stack |
| `npm run prod:health` | Ping production `/health` endpoint |
| `npm run prod:ready` | Ping production `/ready` endpoint |
| `npm run prod:logs` | Tail last 50 PM2 log lines |
| `npm run prod:restart` | Restart PM2 production process |

---

## Architecture Reference

For in-depth technical documentation see [ARCHITECTURE.md](ARCHITECTURE.md), which covers:

- System topology & cross-system dependency diagrams
- Full request lifecycle (sequence diagrams)
- JWT token strategy & refresh rotation
- Role guards (`admin`, `lounge`, `agent`, `client`)
- Security hardening table (brute force, CSRF, XSS, injection, enumeration)
- MongoDB collections, indexes, and data-modeling principles
- Real-time event catalog (all 12 server→client events)
- Cloudflare R2 key structure
- Notification pipeline (27 types, 3 delivery channels)
- Design patterns (Service Layer, Observer, Singleton, Facade, DTO)
- Middleware pipeline & rate limiting
- Complete env variable reference
- Deployment architecture (Docker, Nginx, PM2)
- Error handling & HTTP status code conventions

Individual system deep-dives:

| System | Documentation |
|--------|--------------|
| AuthSystem | [src/systems/AuthSystem/README.md](src/systems/AuthSystem/README.md) |
| UserManager | [src/systems/UserManager/README.md](src/systems/UserManager/README.md) |
| BookingSystem | [src/systems/BookingSystem/README.md](src/systems/BookingSystem/README.md) |
| ServiceCatalogSystem | [src/systems/ServiceCatalogSystem/README.md](src/systems/ServiceCatalogSystem/README.md) |
| FeedContentSystem | [src/systems/FeedContentSystem/README.md](src/systems/FeedContentSystem/README.md) |
| ChatSystem | [src/systems/ChatSystem/README.md](src/systems/ChatSystem/README.md) |
| NotificationSystem | [src/systems/NotificationSystem/README.md](src/systems/NotificationSystem/README.md) |
| MarketplaceSystem | [src/systems/MarketplaceSystem/README.md](src/systems/MarketplaceSystem/README.md) |
| AdminSystem | [src/systems/AdminSystem/README.md](src/systems/AdminSystem/README.md) |

---

<p align="center">
  <em>Frame Beauty Backend — Built with ❤️ in Tunisia</em>
</p>

## Architecture

Main domain systems live under `src/systems`:

- `AuthSystem`
- `UserManager`
- `ServiceCatalogSystem`
- `BookingSystem`
- `NotificationSystem`
- `FeedContentSystem`
- `MarketplaceSystem`
- `ChatSystem`
- `AdminSystem`

For deeper architecture details, see `ARCHITECTURE.md`.
