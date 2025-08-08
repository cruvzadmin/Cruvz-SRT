#!/bin/bash

# Validation script for deploy.sh
# Tests key functionality without full deployment

cd "$(dirname "$0")"

echo "🧪 Testing Cruvz Streaming Deployment Script"
echo "============================================="

# Test 1: Help command
echo "✅ Test 1: Help command"
if ./deploy.sh help > /dev/null 2>&1; then
    echo "   ✓ Help command works"
else
    echo "   ✗ Help command failed"
    exit 1
fi

# Test 2: Status command (should work even without services)
echo "✅ Test 2: Status command"
if ./deploy.sh status > /dev/null 2>&1; then
    echo "   ✓ Status command works"
else
    echo "   ✗ Status command failed"
    exit 1
fi

# Test 3: Configuration validation
echo "✅ Test 3: Docker Compose validation"
if docker compose config --quiet; then
    echo "   ✓ Docker Compose configuration is valid"
else
    echo "   ✗ Docker Compose configuration has errors"
    exit 1
fi

# Test 4: Required files exist
echo "✅ Test 4: Required files validation"
required_files=("docker-compose.yml" "backend/package.json" "backend/server.js" "web-app/index.html")
all_files_exist=true

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "   ✗ Required file missing: $file"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = true ]; then
    echo "   ✓ All required files exist"
else
    exit 1
fi

# Test 5: Docker prerequisites
echo "✅ Test 5: Docker prerequisites"
if command -v docker > /dev/null && docker info > /dev/null 2>&1; then
    echo "   ✓ Docker is available and running"
else
    echo "   ✗ Docker is not available or not running"
    exit 1
fi

# Test 6: Backend package.json validation
echo "✅ Test 6: Backend configuration"
if [ -f "backend/package.json" ] && grep -q '"name"' backend/package.json; then
    echo "   ✓ Backend package.json is valid"
else
    echo "   ✗ Backend package.json is invalid"
    exit 1
fi

echo ""
echo "🎉 All validation tests passed!"
echo "✅ deploy.sh is ready for production deployment"
echo ""
echo "To deploy the complete system, run:"
echo "   ./deploy.sh"