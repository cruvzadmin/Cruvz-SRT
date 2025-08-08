# Cruvz Streaming Backend API Dockerfile
# Production-ready lightweight build using prebuilt image

FROM node:18-slim

# Install only essential system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and scripts first
COPY package*.json ./
COPY scripts/ ./scripts/

# Install dependencies with better error handling
RUN npm ci --no-audit --no-fund && \
    npm cache clean --force

# Copy application code
COPY . .

# Create directories with proper permissions
RUN mkdir -p data logs uploads recordings && \
    chmod 755 data logs uploads recordings

# Run setup after everything is ready
RUN npm run postinstall || true

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start application
CMD ["npm", "start"]
