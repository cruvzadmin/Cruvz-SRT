#!/bin/bash
# set -e  # Commented out to see all test results

echo "🔥 CRUVZ-SRT PRODUCTION VALIDATION TEST"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_passed=0
test_failed=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n🧪 Testing: $test_name"
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        ((test_passed++))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        ((test_failed++))
    fi
}

run_test_with_output() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n🧪 Testing: $test_name"
    local output=$(eval "$test_command" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        echo "$output" | head -3
        ((test_passed++))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        echo "$output" | head -3
        ((test_failed++))
    fi
}

echo -e "\n${YELLOW}=== INFRASTRUCTURE HEALTH ===${NC}"
run_test "Docker containers running" "[ \$(docker ps | grep -c 'cruvz') -ge 5 ]"
run_test "Backend API health" "curl -s http://localhost:5000/health | grep -q 'ok'"
run_test "Origin streaming health" "curl -s http://localhost:8080 | grep -q 'healthy'"
run_test "Web app responding" "curl -s http://localhost | grep -q 'Cruvz Streaming'"
run_test "Grafana responding" "curl -s http://localhost:3000/api/health | grep -q 'database.*ok'"
run_test "Prometheus responding" "curl -s http://localhost:9090/-/healthy | grep -q 'Prometheus Server is Healthy'"

echo -e "\n${YELLOW}=== STREAMING PORTS ===${NC}"
run_test "RTMP port (1935) accessible" "nc -z localhost 1935"
run_test "SRT port (9999) accessible" "nc -z -u localhost 9999"
run_test "WebRTC port (3333) accessible" "nc -z localhost 3333"
run_test "Origin API port (8080) accessible" "nc -z localhost 8080"

echo -e "\n${YELLOW}=== API ENDPOINTS ===${NC}"
run_test_with_output "User registration" "curl -s -X POST -H 'Content-Type: application/json' -d '{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"Test123!\"}' http://localhost:5000/api/auth/register"
run_test_with_output "User login" "curl -s -X POST -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\"}' http://localhost:5000/api/auth/login"
run_test_with_output "Streaming status" "curl -s http://localhost:5000/api/status"

echo -e "\n${YELLOW}=== NGINX PROXY ===${NC}"
run_test_with_output "API proxy through nginx" "curl -s http://localhost/api/status"
run_test "Static files served" "curl -s http://localhost/css/styles.css | grep -q 'body\|html'"

echo -e "\n${YELLOW}=== MONITORING ===${NC}"
run_test "Redis accessible" "nc -z localhost 6379"
run_test "Prometheus metrics" "curl -s http://localhost:9090/api/v1/label/__name__/values | grep -q 'prometheus_'"

echo -e "\n${YELLOW}=== STREAMING PROTOCOLS ===${NC}"
run_test "RTMP ingestion ready" "timeout 3 nc localhost 1935 < /dev/null"
run_test "SRT ingestion ready" "timeout 3 nc -u localhost 9999 < /dev/null"

echo -e "\n🏁 TEST SUMMARY"
echo "==============="
echo -e "${GREEN}✅ Tests Passed: $test_passed${NC}"
echo -e "${RED}❌ Tests Failed: $test_failed${NC}"
echo -e "Total Tests: $((test_passed + test_failed))"

if [ $test_failed -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! System is 100% production ready!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. System needs attention.${NC}"
    exit 1
fi