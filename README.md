# Frame Beauty Backend API

Backend API for the Frame Beauty platform (booking, queues, social feed, marketplace, chat, and notifications).

## Stack

- Node.js + TypeScript + Express
- MongoDB + Mongoose
- Socket.IO
- Cloudflare R2 (optional media storage)
- Firebase FCM (optional push notifications)

## Quick Start

1) Install dependencies:

```bash
npm install
```

2) Create local env file from template:

```bash
cp .env.production.example .env.development.local
```

3) Fill required values (`MONGO_URI`, `SECRET_KEY`, `REFRESH_TOKEN_SECRET`, OAuth/email if used).

4) Run in development:

```bash
npm run dev
```

## Production Run

```bash
npm run build
npm start
```

For PM2:

```bash
npm run deploy:prod
```

## Security Notes

- Do not commit real secrets (`.env.*` files are ignored).
- Keep `ENABLE_ADMIN_BOOTSTRAP=false` after initial setup.
- `SECRET_KEY` and `REFRESH_TOKEN_SECRET` must be different and strong.

## Health Endpoints

- `GET /health` - basic service health
- `GET /ready` - readiness probe (database and websocket status)

## Scripts

- `npm run dev` - development server
- `npm run build` - compile to `dist`
- `npm start` - production start
- `npm test` - run tests
- `npm run lint` - lint source
- `npm run deploy:prod` - PM2 production deployment
- `npm run docker:up` - run Docker Compose stack

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
