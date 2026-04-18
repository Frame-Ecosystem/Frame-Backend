# Common build stage
FROM node:20-alpine as common-build-stage

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create app directory and set correct permissions
RUN addgroup -g 1001 -S framebeauty && \
    adduser -S framebeauty -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Change ownership of the app directory
RUN chown -R framebeauty:framebeauty /app
USER framebeauty

EXPOSE 3000

# Development build stage
FROM common-build-stage as development-build-stage

ENV NODE_ENV=development

# Install dev dependencies for development
USER root
RUN npm ci
USER framebeauty

CMD ["dumb-init", "npm", "run", "dev"]

# Production build stage
FROM common-build-stage as production-build-stage

ENV NODE_ENV=production

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
USER root
RUN npm prune --production
USER framebeauty

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["dumb-init", "npm", "run", "start"]
