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

# Install dependencies (include dev deps for migrations)
RUN if [ -f package-lock.json ]; then npm ci --timeout=300000; else npm install --timeout=300000; fi

# Copy application source and configuration
COPY . .

# Create a non-root user for security
RUN useradd -r -u 1001 -m appuser

# Fix permissions: ensure logs, data, uploads are owned by appuser (important for logging!)
RUN mkdir -p /app/data /app/logs /app/uploads \
 && chown -R appuser:appuser /app/data /app/logs /app/uploads \
 && chmod 755 /app/data /app/logs /app/uploads

# Correction: Make /tmp/nginx-logs writable for log volume mounts (for log aggregator)
RUN mkdir -p /tmp/nginx-logs && chmod 777 /tmp/nginx-logs

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Correction: Health check should include Authorization header if backend has protected health endpoint (add env for token if needed).
# If your /health endpoint requires a token:
# HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#     CMD curl -f -H "Authorization: Bearer $BACKEND_HEALTH_TOKEN" http://localhost:5000/health || exit 1

# If not, keep as is:
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "server.js"]
