#!/bin/bash

# ===============================================================================
# CRUVZ-SRT PRODUCTION DEPLOYMENT SCRIPT
# One-command deployment for complete streaming platform
# ===============================================================================

echo "🚀 CRUVZ-SRT PRODUCTION DEPLOYMENT"
echo "======================================"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Set environment variables for production
export NODE_ENV=production
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "📦 Stopping any existing services..."
docker compose down --remove-orphans 2>/dev/null || true

echo "🧹 Cleaning up old volumes (keeping data)..."
docker system prune -f --volumes=false 2>/dev/null || true

echo "🔧 Building production images..."
if ! docker compose build --parallel; then
    echo "❌ Build failed!"
    exit 1
fi

echo "🚀 Starting all production services..."
if ! docker compose up -d; then
    echo "❌ Service startup failed!"
    exit 1
fi

echo "⏳ Waiting for services to initialize..."
sleep 30

echo "🔍 Checking service health..."
docker compose ps

echo "📊 Running production readiness test..."
node quick-streaming-test.js

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================"
echo "🌐 Frontend (React): http://localhost:3000"
echo "🔧 Backend API: http://localhost:5000"
echo "📊 Health Check: http://localhost:5000/health"
echo "🎥 OvenMediaEngine API: http://localhost:8080"
echo "📈 Grafana Dashboard: http://localhost:3000"
echo "📊 Prometheus Metrics: http://localhost:9090"
echo ""
echo "🎬 STREAMING ENDPOINTS:"
echo "• RTMP: rtmp://localhost:1935/app/{stream_name}"
echo "• SRT Input: srt://localhost:9999?streamid=input/app/{stream_name}"
echo "• SRT Output: srt://localhost:9998?streamid=app/{stream_name}"
echo "• WebRTC: ws://localhost:3333/app/{stream_name}"
echo "• LLHLS: http://localhost:8088/app/{stream_name}/llhls.m3u8"
echo "• HLS: http://localhost:8088/app/{stream_name}/playlist.m3u8"
echo ""
echo "📚 For detailed documentation, see docs/ directory"
echo "🔧 To stop services: docker compose down"
echo "📝 Logs: docker compose logs -f [service_name]"