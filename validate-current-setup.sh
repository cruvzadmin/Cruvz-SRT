#!/bin/bash

# Custom validation for current infrastructure setup
set -e

echo "🚀 CRUVZ-SRT INFRASTRUCTURE VALIDATION"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

test_service() {
    local name="$1"
    local test_cmd="$2"
    
    echo -n "🔍 Testing $name... "
    if eval "$test_cmd" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "📊 INFRASTRUCTURE HEALTH TESTS"
echo "==============================="

# Test PostgreSQL
test_service "PostgreSQL Database" "docker exec cruvz-postgres-prod pg_isready -U cruvz -d cruvzdb"

# Test Redis
test_service "Redis Cache" "docker exec cruvz-redis-prod redis-cli ping | grep -q PONG"

# Test Backend API
test_service "Backend API Health" "curl -sf http://localhost:5000/health"
test_service "Backend API Info" "curl -sf http://localhost:5000/api/info"
test_service "Backend Streaming Protocols" "curl -sf http://localhost:5000/api/streaming/protocols"

echo ""
echo "🎥 STREAMING INFRASTRUCTURE TESTS"
echo "=================================="

# Test streaming ports
test_service "RTMP Port (1935)" "nc -z localhost 1935"
test_service "HLS Port (8088)" "nc -z localhost 8088"
test_service "WebRTC Port (3333)" "nc -z localhost 3333"
test_service "SRT Input Port (9999)" "nc -z localhost 9999"
test_service "SRT Output Port (9998)" "nc -z localhost 9998"

# Test OvenMediaEngine
test_service "OvenMediaEngine Container" "docker ps | grep -q cruvz-ome"

echo ""
echo "🔗 NETWORK CONNECTIVITY TESTS"
echo "=============================="

# Test container networking
test_service "PostgreSQL Container Network" "docker exec cruvz-postgres-prod hostname -i"
test_service "Redis Container Network" "docker exec cruvz-redis-prod hostname -i"
test_service "OvenMediaEngine Container Network" "docker exec cruvz-ome hostname -i"

echo ""
echo "📋 SUMMARY"
echo "=========="
echo -e "✅ Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "❌ Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "📊 Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Infrastructure is ready for production.${NC}"
    echo ""
    echo "🌐 AVAILABLE SERVICES:"
    echo "  • Backend API: http://localhost:5000"
    echo "  • PostgreSQL: localhost:5432 (user: cruvz, db: cruvzdb)"
    echo "  • Redis: localhost:6379"
    echo "  • RTMP Streaming: rtmp://localhost:1935/live"
    echo "  • HLS Streaming: http://localhost:8088/live/{stream_key}/index.m3u8"
    echo "  • WebRTC: ws://localhost:3333"
    echo "  • SRT Input: srt://localhost:9999"
    echo "  • SRT Output: srt://localhost:9998"
    echo ""
    echo "🎯 READY FOR END-TO-END TESTING!"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Please check the infrastructure.${NC}"
    exit 1
fi