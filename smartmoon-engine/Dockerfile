# SmartMoon WhatsApp Engine — Production Dockerfile
# Multi-stage build for minimal image size

# ── Stage 1: Build ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production ────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN adduser -D -u 1001 smartmoon

# Create data directories AND grant ownership BEFORE switching user
# (Docker volumes mount as root — ownership must be set here)
RUN mkdir -p /data/sessions /data/media \
    && chown -R smartmoon:smartmoon /data

USER smartmoon

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3100/health || exit 1

CMD ["node", "dist/index.js"]
