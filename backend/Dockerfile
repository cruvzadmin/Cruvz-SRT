# Cruvz Streaming Backend API Dockerfile
# Multi-stage build for production optimization

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and scripts directory needed for postinstall
COPY package*.json ./
COPY scripts ./scripts
COPY backend ./backend

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy node_modules from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code, including backend directory
COPY --chown=nodejs:nodejs . .
COPY --chown=nodejs:nodejs backend ./backend

# Create necessary directories
RUN mkdir -p data logs uploads recordings && \
    chown -R nodejs:nodejs data logs uploads recordings

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
