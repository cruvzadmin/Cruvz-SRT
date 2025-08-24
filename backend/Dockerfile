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

# Install dependencies (use npm ci if lockfile exists for reproducibility)
RUN if [ -f package-lock.json ]; then npm ci --only=production --timeout=300000; else npm install --only=production --timeout=300000; fi

# Copy application source and configuration
COPY . .

# Create a non-root user for security and set directory ownership
RUN useradd -r -u 1001 -m appuser \
 && mkdir -p data logs uploads \
 && chown -R appuser:appuser /app \
 && chmod 755 data logs uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "server.js"]
