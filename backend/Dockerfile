# Cruvz Streaming Backend API Dockerfile
# Production-ready lightweight build

FROM node:18-alpine

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy package files and scripts first
COPY package*.json ./
COPY scripts/ ./scripts/

# Install dependencies and build native modules
RUN npm install --no-optional

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
