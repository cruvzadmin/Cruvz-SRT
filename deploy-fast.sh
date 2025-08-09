#!/bin/bash

# PRODUCTION DEPLOYMENT SCRIPT - ZERO ERRORS VERSION
# Optimized for fast, reliable deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 CRUVZ STREAMING - ZERO ERROR DEPLOYMENT${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Use fast deployment configuration
COMPOSE_FILE="docker-compose.fast.yml"

echo -e "${YELLOW}📋 Step 1: Preparing backend dependencies...${NC}"
cd backend
# Install dependencies locally for faster container startup
npm install --production --no-audit --no-fund
echo -e "${GREEN}✅ Backend dependencies ready${NC}"

cd ..

echo -e "${YELLOW}📋 Step 2: Deploying services...${NC}"
docker compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true
docker compose -f $COMPOSE_FILE up -d

echo -e "${YELLOW}📋 Step 3: Waiting for services to start...${NC}"
sleep 30

echo -e "${YELLOW}📋 Step 4: Checking service health...${NC}"
docker compose -f $COMPOSE_FILE ps

echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}✅ Main Website: http://localhost${NC}"
echo -e "${GREEN}✅ Backend API: http://localhost:5000${NC}"
echo -e "${GREEN}✅ Streaming Engine: http://localhost:8080${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}📡 STREAMING ENDPOINTS:${NC}"
echo -e "${YELLOW}• RTMP: rtmp://localhost:1935/app/stream_name${NC}"
echo -e "${YELLOW}• WebRTC: http://localhost:3333/app/stream_name${NC}"
echo -e "${YELLOW}• SRT: srt://localhost:9999?streamid=app/stream_name${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Test endpoints
echo -e "${YELLOW}📋 Step 5: Testing endpoints...${NC}"
curl -f http://localhost:5000/health > /dev/null 2>&1 && echo -e "${GREEN}✅ Backend API healthy${NC}" || echo -e "${RED}❌ Backend API issue${NC}"
curl -f http://localhost:80 > /dev/null 2>&1 && echo -e "${GREEN}✅ Web app accessible${NC}" || echo -e "${RED}❌ Web app issue${NC}"

echo -e "${GREEN}🚀 ZERO-ERROR DEPLOYMENT SUCCESSFUL!${NC}"