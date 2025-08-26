# Production Backend with PostgreSQL and Full Feature Set
FROM node:18-slim

# Set environment variable for production
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Install essential build dependencies and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies first for better caching
COPY package*.json ./

# Clear npm cache and install dependencies including dev deps (needed for migrations)
RUN npm cache clean --force && \
    npm ci --timeout=300000 && \
    npm ls dotenv && \
    npm ls knex

# Copy application source and configuration
COPY . .

# Create a non-root user for security
RUN useradd -r -u 1001 -m appuser

# Create directories and fix permissions in simpler way
RUN mkdir -p /app/data /app/logs /app/uploads /tmp/nginx-logs \
 && chown -R appuser:appuser /app \
 && chmod -R 755 /app \
 && chmod 777 /tmp/nginx-logs

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check without special headers for now
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "server.js"]
