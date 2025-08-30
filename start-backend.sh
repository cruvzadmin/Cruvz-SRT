#!/bin/bash

# Create and start a minimal backend service
set -e

echo "🚀 Creating minimal backend service..."

# Copy enhanced backend and start it directly
mkdir -p /tmp/backend-minimal
cp enhanced-backend.js /tmp/backend-minimal/server.js

# Create a minimal package.json
cat > /tmp/backend-minimal/package.json << 'EOF'
{
  "name": "cruvz-minimal-backend", 
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5", 
    "dotenv": "^16.3.1",
    "pg": "^8.11.3",
    "axios": "^1.5.0"
  }
}
EOF

# Create environment file
cat > /tmp/backend-minimal/.env << 'EOF'
NODE_ENV=production
PORT=5000
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cruvzdb
POSTGRES_USER=cruvz
POSTGRES_PASSWORD=cruvzSRT91
REDIS_HOST=localhost
REDIS_PORT=6379
OME_API_URL=http://localhost:8088
OME_API_TOKEN=Y3J1dnpfcHJvZHVjdGlvbl9hcGlfdG9rZW5fMjAyNQ==
JWT_SECRET=cruvz_streaming_secret_production_2025
EOF

echo "📦 Installing dependencies..."
cd /tmp/backend-minimal
npm install --silent

echo "🚀 Starting backend server..."
node server.js &
BACKEND_PID=$!

echo "Backend started with PID: $BACKEND_PID"

# Wait a moment and test
sleep 5

echo "🔍 Testing backend health..."
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend is responding!"
    curl -s http://localhost:5000/health | jq '.' 2>/dev/null || curl -s http://localhost:5000/health
else
    echo "❌ Backend not responding"
fi

echo ""
echo "✅ Minimal backend deployment completed!"
echo "🌐 Backend API available at: http://localhost:5000"
echo "🔍 Health check: http://localhost:5000/health"
echo ""
echo "To stop: kill $BACKEND_PID"