# Production Backend with PostgreSQL and Full Feature Set
FROM node:18-slim

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
COPY package-simple.json ./package.json
RUN rm -f package-lock.json

# Install dependencies with timeout - use npm install for production
RUN npm config set strict-ssl false && \
    npm install --only=production --timeout=300000

# Copy application source and configuration
COPY . .

# Create a non-root user for security
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

# Start application (CORRECTED: use server.js for production)
CMD ["node", "server.js"]
