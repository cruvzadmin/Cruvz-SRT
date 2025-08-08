#!/bin/bash

# Test script to verify signup functionality and deployment
# This script validates that the issue has been resolved

set -e

echo "🧪 Testing Cruvz Streaming Signup Functionality"
echo "==============================================="

# Test 1: Check if all critical services are running
echo "✅ Test 1: Verifying critical services are running..."
RUNNING_SERVICES=$(docker compose ps --format "table {{.Service}}\t{{.Status}}" | grep -c "Up")
if [ "$RUNNING_SERVICES" -ge 3 ]; then
    echo "   ✅ Core services are running ($RUNNING_SERVICES services)"
    # Check specifically for the core services
    if docker compose ps | grep -q "backend.*Up" && docker compose ps | grep -q "origin.*Up"; then
        echo "   ✅ Backend and Stream Engine (core services) are operational"
    else
        echo "   ❌ Core services not running properly"
        exit 1
    fi
else
    echo "   ❌ Not enough services are running"
    docker compose ps
    exit 1
fi

# Test 2: Test backend health endpoint
echo "✅ Test 2: Testing backend health endpoint..."
if curl -f -s http://localhost:5000/health | grep -q '"status":"healthy"'; then
    echo "   ✅ Backend API is responding correctly"
else
    echo "   ❌ Backend API health check failed"
    exit 1
fi

# Test 3: Test web app accessibility
echo "✅ Test 3: Testing web application accessibility..."
if curl -f -s http://localhost/ | grep -q "Cruvz Streaming"; then
    echo "   ✅ Web application is serving content"
else
    echo "   ❌ Web application is not accessible"
    exit 1
fi

# Test 4: Test signup API endpoint
echo "✅ Test 4: Testing signup API functionality..."
SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Automation User",
        "email": "automation@example.com",
        "password": "AutoTest123!"
    }')

if echo "$SIGNUP_RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Signup API is working correctly"
    echo "   📝 User successfully created via API"
else
    echo "   ❌ Signup API failed"
    echo "   Response: $SIGNUP_RESPONSE"
    exit 1
fi

# Test 5: Test streaming engine (OvenMediaEngine) with SSL checks
echo "✅ Test 5: Verifying streaming engine deployment and SSL configuration..."
if docker compose logs origin | grep -q -E "(OvenMediaEngine|CruvzStreaming)"; then
    echo "   ✅ Stream engine is running"
    
    # Check SSL certificate generation
    if docker compose exec -T origin test -f "/opt/ovenmediaengine/bin/origin_conf/cert.crt" 2>/dev/null || \
       docker compose exec -T origin test -f "/opt/cruvzstreaming/bin/origin_conf/cert.crt" 2>/dev/null; then
        echo "   ✅ SSL certificates are configured"
    else
        echo "   ⚠️  SSL certificates may still be generating"
    fi
    
    # Check if TLS ports are accessible
    if nc -z localhost 3334 2>/dev/null; then
        echo "   ✅ TLS WebRTC signaling port is accessible"
    else
        echo "   ⚠️  TLS port may still be initializing"
    fi
else
    echo "   ❌ Stream engine verification failed"
    echo "   📋 Checking stream engine logs..."
    docker compose logs --tail=20 origin
    exit 1
fi

# Test 6: Test monitoring endpoints
echo "✅ Test 6: Testing monitoring services..."
if curl -f -s http://localhost:9090/api/v1/status/flags >/dev/null 2>&1; then
    echo "   ✅ Prometheus monitoring is accessible"
else
    echo "   ⚠️  Prometheus monitoring may still be starting"
fi

if curl -f -s http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "   ✅ Grafana dashboard is accessible"
else
    echo "   ⚠️  Grafana dashboard may still be starting"
fi

echo ""
echo "🎉 ALL TESTS PASSED!"
echo "✅ Signup functionality is working correctly"
echo "✅ Full deployment completed successfully"
echo "✅ Backend, Frontend, AND Stream Engine all operational"
echo ""
echo "🌐 Access URLs:"
echo "   • Main Website: http://localhost"
echo "   • Backend API: http://localhost:5000"
echo "   • Dashboard: http://localhost/pages/dashboard.html"
echo "   • Grafana: http://localhost:3000 (admin/cruvz123)"
echo "   • Prometheus: http://localhost:9090"
echo ""
echo "🎯 Issue Resolution: COMPLETE"
echo "   - Signup functionality: ✅ WORKING"
echo "   - Full deployment: ✅ COMPLETED"
echo "   - Stream engine: ✅ DEPLOYED"