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
```
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=27017
DB_DATABASE=frame_beauty_dev
SECRET_KEY=<your-jwt-secret>
REFRESH_TOKEN_SECRET=<different-secret>
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

## Project Structure

```
src/
├── config/         # Environment config, Passport, constants
├── controllers/    # Route handlers
├── databases/      # MongoDB connection config
├── dtos/           # Request validation (class-validator)
├── exceptions/     # HTTP exception hierarchy
├── interfaces/     # TypeScript interfaces
├── middlewares/     # Auth, CSRF, rate-limit, validation, upload
├── models/         # Mongoose schemas
├── routes/         # Express route definitions
├── services/       # Business logic layer
└── utils/          # Logger, email, cron, admin init
```

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