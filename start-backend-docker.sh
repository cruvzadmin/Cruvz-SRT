#!/bin/bash

# Start backend in Docker container with correct network
set -e

echo "🚀 Starting backend in Docker with proper networking..."

# Create a simple Dockerfile for the backend
cat > /tmp/backend-docker << 'EOF'
FROM node:18-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY enhanced-backend.js server.js
RUN echo '{"name":"cruvz-backend","version":"1.0.0","main":"server.js","dependencies":{"express":"^4.18.2","cors":"^2.8.5","dotenv":"^16.3.1","pg":"^8.11.3","axios":"^1.5.0"}}' > package.json
RUN npm install --silent
EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000
ENV POSTGRES_HOST=cruvz-postgres-prod
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=cruvzdb
ENV POSTGRES_USER=cruvz
ENV POSTGRES_PASSWORD=cruvzSRT91
ENV REDIS_HOST=cruvz-redis-prod
ENV REDIS_PORT=6379
ENV OME_API_URL=http://cruvz-ome:8088
ENV OME_API_TOKEN=Y3J1dnpfcHJvZHVjdGlvbl9hcGlfdG9rZW5fMjAyNQ==
ENV JWT_SECRET=cruvz_streaming_secret_production_2025
CMD ["node", "server.js"]
EOF

cd /home/runner/work/Cruvz-SRT/Cruvz-SRT

# Build the backend image
echo "📦 Building backend Docker image..."
docker build -t cruvz-backend-minimal:latest -f /tmp/backend-docker .

# Run the backend container
echo "🚀 Starting backend container..."
docker run -d \
  --name cruvz-backend \
  --network cruvz-production \
  -p 5000:5000 \
  cruvz-backend-minimal:latest

# Wait a moment and test
sleep 10

echo "🔍 Testing backend..."
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend is healthy!"
    curl -s http://localhost:5000/health | jq '.' 2>/dev/null || curl -s http://localhost:5000/health
else
    echo "❌ Backend not responding, checking logs..."
    docker logs cruvz-backend --tail=20
fi

echo ""
echo "📊 All services status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"