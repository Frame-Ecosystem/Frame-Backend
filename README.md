# Frame Beauty API

> Enterprise backend API for the **Frame Beauty** platform — a child application of the **Frame** ecosystem.

Frame Beauty powers salon discovery, booking, real-time queue management, and social features for beauty professionals and clients.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ / TypeScript |
| Framework | Express.js |
| Database | MongoDB 6+ / Mongoose |
| Auth | JWT (access + refresh rotation) + Google OAuth 2.0 |
| Real-time | Socket.IO |
| Media | Cloudflare R2 |
| Push | Firebase Cloud Messaging |
| Email | Nodemailer (Brevo SMTP) |
| Process Mgmt | PM2 |
| Container | Docker + Nginx reverse proxy |

## Prerequisites

- Node.js 18+ and npm 9+
- MongoDB 6+ (local or hosted)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and fill in your values:

```bash
cp .env.example .env.development.local
```

Required variables:
```env
# Server
NODE_ENV=development
PORT=3000

# MongoDB
DB_HOST=127.0.0.1
DB_PORT=27017
DB_DATABASE=frame_beauty_dev

# JWT — must be two distinct secrets
SECRET_KEY=<your-jwt-secret>
REFRESH_TOKEN_SECRET=<different-refresh-secret>

# Admin seed account
ADMIN_EMAIL=admin@framebeauty.com
ADMIN_PASSWORD=Admin@123

# CORS allowed origin(s)
ORIGIN=http://localhost:3001

# Google OAuth 2.0
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/v1/auth/google/callback
FRONTEND_BASE_URL=http://localhost:3001

# Email — Brevo SMTP (optional — magic-link and password reset)
BREVO_SMTP_USER=<brevo-smtp-login>
BREVO_SMTP_KEY=<brevo-smtp-api-key>
SMTP_FROM=noreply@framebeauty.com

# Media — Cloudflare R2 (required if ENABLE_IMAGE_UPLOAD=true)
ENABLE_IMAGE_UPLOAD=false
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Firebase FCM push notifications (optional)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
# — or inline credentials:
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## Development

```bash
npm run dev
```

## Production Build & Run

```bash
npm run build
npm start
```

## Docker

```bash
npm run docker:build
npm run docker:up
```

## API Documentation

Swagger UI is available at `/api-docs` in non-production environments.

## Architecture — Vertical Domain Systems

The codebase is organised into **8 self-contained domain systems**, each owning its own controllers, services, models, routes, DTOs, and interfaces. This structure is designed for future microservice extraction.

```
src/
├── systems/
│   ├── AuthSystem/           # Registration, login, JWT, OAuth, sessions
│   ├── UserManager/          # User profiles (client/lounge), agents, follow graph
│   ├── BookingSystem/        # Appointments, walk-in queues, analytics, cron
│   ├── ServiceCatalogSystem/ # Service catalog, lounge offerings, ratings, suggestions
│   ├── NotificationSystem/   # WebSocket (Socket.IO), FCM push, notification history
│   ├── FeedContentSystem/    # Posts, reels, comments, likes, feed, moderation
│   ├── MarketplaceSystem/    # Stores, products, cart, orders, reviews, wishlist
│   └── AdminSystem/          # Platform administration, dashboards, moderation
│
├── shared/
│   └── services/             # Cross-system utilities (Cloudflare R2 upload)
│
├── config/                   # Env vars, Passport OAuth strategy, constants
├── databases/                # MongoDB connection
├── exceptions/               # HttpException base class
├── interfaces/               # Shared interfaces (routes.interface)
├── middlewares/              # Auth, CSRF, rate-limit, role, validation, upload
└── utils/                    # Logger, email, cron, admin seeder, validators
```

Each system has its own `README.md`:

| System | Description |
|---|---|
| [AuthSystem](src/systems/AuthSystem/README.md) | Magic-link signup, JWT refresh rotation, Google OAuth, CSRF |
| [UserManager](src/systems/UserManager/README.md) | Profiles, agents, blocking, social follow graph |
| [BookingSystem](src/systems/BookingSystem/README.md) | Service appointments, walk-in queue, cron automation |
| [ServiceCatalogSystem](src/systems/ServiceCatalogSystem/README.md) | Global catalog, lounge service offerings, ratings |
| [NotificationSystem](src/systems/NotificationSystem/README.md) | Real-time (Socket.IO) + FCM push + notification history |
| [FeedContentSystem](src/systems/FeedContentSystem/README.md) | Posts, reels, hashtags, comments, personalized feed |
| [MarketplaceSystem](src/systems/MarketplaceSystem/README.md) | E-commerce — stores, products, orders, reviews |
| [AdminSystem](src/systems/AdminSystem/README.md) | Platform admin — user, content, catalog management |

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Build + start in production mode |
| `npm test` | Run test suite |
| `npm run lint` | ESLint check |
| `npm run deploy:prod` | Build + PM2 production deploy |
| `npm run audit` | Security audit of production deps |

## Health Checks

- `GET /health` — Application health (always available)
- `GET /ready` — Readiness probe (database + WebSocket status)

---

**Part of the Frame Enterprise Platform** — Built with TypeScript, Express.js, MongoDB</content>
<parameter name="oldString">## Prerequisites
- Node.js 16+ and npm
- MongoDB (local or hosted)

## Setup
1. Install dependencies:

```bash
npm install
```

2. Create a local environment file (example `.env`):

```
DB_HOST=127.0.0.1
DB_PORT=27017
DB_DATABASE=dev
JWT_SECRET=your_jwt_secret
PORT=3000
```

## Run (development)

```bash
npm run dev
```

## Build & Run (production)

```bash
npm run build
npm start
```