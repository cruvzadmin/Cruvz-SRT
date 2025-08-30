#!/bin/bash

# Minimal deployment for immediate testing
set -e

echo "🚀 Starting Minimal Test Deployment..."

# Clean up
docker compose down --remove-orphans 2>/dev/null || true

# Create minimal backend image from enhanced-backend.js 
echo "📦 Creating minimal backend service..."
cat > /tmp/minimal-dockerfile << 'EOF'
FROM node:18-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY enhanced-backend.js server.js
RUN npm init -y
RUN npm install express cors dotenv pg axios
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD curl -f http://localhost:5000/health || exit 1
CMD ["node", "server.js"]
EOF

# Build minimal backend
docker build -t cruvz-srt-backend:latest -f /tmp/minimal-dockerfile .

# Start essential infrastructure first
echo "🚀 Starting infrastructure services..."
docker compose up -d postgres redis

echo "⏳ Waiting for database..."
sleep 15

# Start backend
echo "🚀 Starting backend API..."
docker compose up -d --force-recreate backend

sleep 10

# Start origin (OvenMediaEngine)  
echo "🚀 Starting streaming engine..."
docker compose up -d origin

sleep 5

# Start remaining services
echo "🚀 Starting additional services..."
docker compose up -d web-app grafana prometheus node-exporter log-aggregator

sleep 5

echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ Minimal deployment completed!"
echo ""
echo "🌐 Service URLs:"
echo "  - Backend API: http://localhost:5000"
echo "  - Backend Health: http://localhost:5000/health"  
echo "  - Web App: http://localhost:3000"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - RTMP Streaming: rtmp://localhost:1935/live"
echo "  - Grafana: http://localhost:3001"
echo ""
echo "🔍 Quick Health Check:"
curl -s http://localhost:5000/health 2>/dev/null && echo "✅ Backend API is healthy" || echo "❌ Backend API not responding"

echo ""
echo "📝 Next steps:"
echo "  1. Test backend API: curl http://localhost:5000/health"
echo "  2. Run comprehensive validation: ./validate-production-complete.sh"
echo "  3. Test streaming protocols: ./validate-streaming-protocols.sh"