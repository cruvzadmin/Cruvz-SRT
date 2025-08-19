#!/bin/bash

# Test deployment script to validate fixes
set -e

echo "🔧 Testing Cruvz-SRT deployment fixes..."

# Check docker availability
echo "✅ Checking Docker..."
docker --version
docker compose version

# Check directory structure
echo "✅ Checking directory structure..."
ls -la data/
ls -la data/logs/

# Test basic Docker Compose validation
echo "✅ Testing docker compose configuration..."
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f production-compose.yml config --quiet

echo "✅ All basic tests passed! Ready for deployment."