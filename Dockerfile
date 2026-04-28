# ── Build stage ────────────────────────────────────────────
FROM node:20-alpine AS build

RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Install ALL deps (dev included) so SWC can compile
COPY package*.json ./
RUN npm install
# Copy source & config, then build
COPY .swcrc tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Development stage ─────────────────────────────────────
FROM node:20-alpine AS development

RUN apk add --no-cache dumb-init curl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=development
EXPOSE 3000

CMD ["dumb-init", "npm", "run", "dev"]

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init curl

RUN addgroup -g 1001 -S framebeauty && \
    adduser -S framebeauty -u 1001

WORKDIR /app

# Production deps only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

RUN chown -R framebeauty:framebeauty /app
USER framebeauty

ENV NODE_ENV=production
EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-10000}/health" || exit 1

CMD ["dumb-init", "node", "dist/server.js"]
