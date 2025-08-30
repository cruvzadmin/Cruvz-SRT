#!/bin/bash

# Quick deployment script for testing - optimized build
set -e

echo "🚀 Starting Quick Deployment..."

# Clean up any existing containers
docker compose down --remove-orphans 2>/dev/null || true

# Build only essential services first
echo "📦 Building essential services..."

# Build backend with optimized process
echo "Building backend..."
docker build -t cruvz-srt-backend:latest ./backend/ --build-arg="NPM_CONFIG_CACHE=/tmp/.npm" || {
    echo "❌ Backend build failed, trying alternative approach..."
    # Create a simplified backend image for testing
    cat > /tmp/simple-backend-dockerfile << EOF
FROM node:18-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm install --production --no-optional
COPY backend/ .
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD curl -f http://localhost:5000/health || exit 1
CMD ["node", "server.js"]
EOF
    docker build -t cruvz-srt-backend:latest -f /tmp/simple-backend-dockerfile .
}

# Build frontend
echo "Building frontend..."
docker build -t cruvz-srt-frontend:latest ./frontend/

# Build origin (OvenMediaEngine)
echo "Building origin..."
docker build -t cruvz-srt-origin:latest -f Dockerfile .

echo "🚀 Starting services..."
docker compose up -d postgres redis
sleep 10

docker compose up -d backend
sleep 15

docker compose up -d origin web-app
sleep 10

echo "📊 Checking service status..."
docker compose ps

echo "✅ Quick deployment completed!"
echo "🌐 Access URLs:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:5000"
echo "  - Streaming: rtmp://localhost:1935/live"
echo "  - PostgreSQL: localhost:5432"