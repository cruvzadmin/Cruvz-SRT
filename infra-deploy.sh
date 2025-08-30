#!/bin/bash

# Infrastructure-first deployment approach
set -e

echo "🚀 Starting Infrastructure-First Deployment..."

# Clean up any existing containers
docker compose down --remove-orphans 2>/dev/null || true

echo "📦 Starting core infrastructure services..."

# Start PostgreSQL and Redis first
echo "🗄️ Starting database and cache..."
docker compose up -d postgres redis

# Wait for them to be ready
echo "⏳ Waiting for database and cache to be ready..."
sleep 20

# Check if they're healthy
echo "🔍 Checking infrastructure health..."
if docker compose exec postgres pg_isready -U cruvz -d cruvzdb 2>/dev/null; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL not ready"
fi

if docker compose exec redis redis-cli ping 2>/dev/null; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis not ready" 
fi

# Start OvenMediaEngine (we already have the image)
echo "🎥 Starting OvenMediaEngine..."
docker compose up -d origin

sleep 10

# Start monitoring services
echo "📊 Starting monitoring services..."
docker compose up -d grafana prometheus node-exporter log-aggregator

sleep 5

# Show status
echo "📊 Current service status:"
docker compose ps

echo ""
echo "✅ Infrastructure deployment completed!"
echo ""
echo "🌐 Available Services:"
echo "  - PostgreSQL: localhost:5432 (user: cruvz, db: cruvzdb)"
echo "  - Redis: localhost:6379"
echo "  - OvenMediaEngine: rtmp://localhost:1935/live"
echo "  - Grafana: http://localhost:3001 (admin/cruvz123)"
echo "  - Prometheus: http://localhost:9090"
echo ""
echo "📝 Next Steps:"
echo "  1. Deploy backend API (when ready)"
echo "  2. Run health checks: ./validate-production-complete.sh"
echo "  3. Test streaming: ./validate-streaming-protocols.sh"
echo ""
echo "🎯 To proceed with backend deployment:"
echo "  - Build backend manually: docker build -t cruvz-srt-backend:latest ./backend/"
echo "  - Start backend: docker compose up -d backend"