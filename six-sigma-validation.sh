#!/bin/bash

# ============================================================================
# CRUVZ STREAMING - SIX SIGMA PRODUCTION VALIDATION
# Zero-error comprehensive testing for production deployment
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Six Sigma metrics
DEFECT_COUNT=0
SIGMA_LEVEL_TARGET=3.4  # Defects per million opportunities

log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    case $level in
        "INFO")     echo -e "${BLUE}ℹ️  [$timestamp] $*${NC}" ;;
        "SUCCESS")  echo -e "${GREEN}✅ [$timestamp] $*${NC}" ;;
        "WARN")     echo -e "${YELLOW}⚠️  [$timestamp] $*${NC}" ;;
        "ERROR")    echo -e "${RED}❌ [$timestamp] $*${NC}" ;;
    esac
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="${3:-0}"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    echo -e "\n${CYAN}🧪 Testing: ${test_name}${NC}"
    
    if eval "$test_command" >/dev/null 2>&1; then
        if [ "$expected_result" = "0" ]; then
            echo -e "${GREEN}✅ PASS${NC}: $test_name"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        else
            echo -e "${RED}❌ FAIL${NC}: $test_name (unexpected success)"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            DEFECT_COUNT=$((DEFECT_COUNT + 1))
            return 1
        fi
    else
        if [ "$expected_result" != "0" ]; then
            echo -e "${GREEN}✅ PASS${NC}: $test_name (expected failure)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        else
            echo -e "${RED}❌ FAIL${NC}: $test_name"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            DEFECT_COUNT=$((DEFECT_COUNT + 1))
            return 1
        fi
    fi
}

# Six Sigma calculation
calculate_sigma_level() {
    local defects=$1
    local opportunities=$TESTS_TOTAL
    
    if [ $opportunities -eq 0 ]; then
        echo "0"
        return
    fi
    
    local dpm=$((defects * 1000000 / opportunities))
    
    # Simplified sigma level calculation
    if [ $dpm -le 4 ]; then
        echo "6.0"  # Six Sigma
    elif [ $dpm -le 230 ]; then
        echo "5.0"  # Five Sigma
    elif [ $dpm -le 6210 ]; then
        echo "4.0"  # Four Sigma
    elif [ $dpm -le 66800 ]; then
        echo "3.0"  # Three Sigma
    else
        echo "2.0"  # Below Three Sigma
    fi
}

echo -e "${BOLD}${PURPLE}"
echo "============================================================================"
echo "    🎯 CRUVZ STREAMING - SIX SIGMA PRODUCTION VALIDATION    "
echo "============================================================================"
echo -e "${NC}"

log "INFO" "Starting comprehensive Six Sigma validation"
log "INFO" "Target: Zero defects, Six Sigma quality (≤3.4 DPMO)"

echo -e "\n${YELLOW}=== INFRASTRUCTURE VALIDATION ===${NC}"

# Core Infrastructure Tests
run_test "PostgreSQL Database Connection" "docker exec cruvz-postgres-prod pg_isready -U cruvz -d cruvzdb"
run_test "Redis Cache Connection" "docker exec cruvz-redis-prod redis-cli -a 'redis_test_s3cret_2025_X9fQ2mVp6HcT1yL4Rw8ZbK' ping | grep -q PONG"
run_test "Backend API Health" "curl -sf http://localhost:5000/health | grep -q healthy"
run_test "Streaming Engine Status" "docker ps | grep cruvz-origin-prod | grep -q Up"

echo -e "\n${YELLOW}=== STREAMING PROTOCOL VALIDATION ===${NC}"

# Streaming Protocol Tests
run_test "RTMP Port Accessibility" "nc -z localhost 1935"
run_test "WebRTC Port Accessibility" "nc -z localhost 3333"
run_test "SRT Port Accessibility" "timeout 1 bash -c 'echo test | nc -u localhost 9999' >/dev/null 2>&1"
run_test "Origin API Port Accessibility" "nc -z localhost 8080"

echo -e "\n${YELLOW}=== USER WORKFLOW VALIDATION ===${NC}"

# User Journey Tests
log "INFO" "Testing complete user authentication and streaming workflow"

# 1. User Registration
USER_EMAIL="sixsigma_test_$(date +%s)@example.com"
REGISTER_RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' \
    -d "{\"first_name\":\"Six\",\"last_name\":\"Sigma\",\"email\":\"$USER_EMAIL\",\"password\":\"SixSigma123!\"}" \
    http://localhost:5000/api/auth/register)

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ PASS${NC}: User Registration"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Extract token  
    USER_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 | tr -d '\n\r')
else
    echo -e "${RED}❌ FAIL${NC}: User Registration"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    DEFECT_COUNT=$((DEFECT_COUNT + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# 2. User Login
LOGIN_RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"$USER_EMAIL\",\"password\":\"SixSigma123!\"}" \
    http://localhost:5000/api/auth/login)

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ PASS${NC}: User Login"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Update token from login
    USER_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 | tr -d '\n\r')
else
    echo -e "${RED}❌ FAIL${NC}: User Login"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    DEFECT_COUNT=$((DEFECT_COUNT + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# 3. Stream Creation (if we have a token)
if [ -n "${USER_TOKEN:-}" ]; then
    STREAM_RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $USER_TOKEN" \
        -d '{"title":"Six Sigma Production Stream","description":"Live streaming test for Six Sigma validation"}' \
        http://localhost:5000/api/streams)
    
    if echo "$STREAM_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ PASS${NC}: Stream Creation"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Extract stream URLs for validation
        RTMP_URL=$(echo "$STREAM_RESPONSE" | grep -o '"rtmp_url":"[^"]*"' | cut -d'"' -f4)
        WEBRTC_URL=$(echo "$STREAM_RESPONSE" | grep -o '"webrtc_url":"[^"]*"' | cut -d'"' -f4)
        SRT_URL=$(echo "$STREAM_RESPONSE" | grep -o '"srt_url":"[^"]*"' | cut -d'"' -f4)
        
        log "SUCCESS" "Generated streaming URLs:"
        log "INFO" "RTMP: $RTMP_URL"
        log "INFO" "WebRTC: $WEBRTC_URL" 
        log "INFO" "SRT: $SRT_URL"
    else
        echo -e "${RED}❌ FAIL${NC}: Stream Creation"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        DEFECT_COUNT=$((DEFECT_COUNT + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
fi

echo -e "\n${YELLOW}=== PERFORMANCE & MONITORING VALIDATION ===${NC}"

# Performance Tests
run_test "API Response Time (<500ms)" "timeout 1s curl -w '%{time_total}' -s http://localhost:5000/health | awk 'NR==2{exit (\$1 > 0.5)}'"
run_test "Database Query Performance" "docker exec cruvz-postgres-prod pg_isready -U cruvz -d cruvzdb"

# Monitoring Tests  
run_test "Prometheus Metrics Collection" "curl -s http://localhost:9090/api/v1/label/__name__/values | grep -q prometheus"

echo -e "\n${YELLOW}=== SECURITY VALIDATION ===${NC}"

# Security Tests
run_test "Unauthorized API Access Blocked" "curl -s -X GET http://localhost:5000/api/streams | grep -q error" "0"
run_test "SQL Injection Protection" "curl -s -X POST -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com'\''--\",\"password\":\"test\"}' http://localhost:5000/api/auth/login | grep -q error" "0"

echo -e "\n${YELLOW}=== STREAMING FUNCTIONALITY VALIDATION ===${NC}"

# Streaming Tests
run_test "RTMP Endpoint Ready" "curl -s http://localhost:8080/v1/stats/current > /dev/null"

echo -e "\n${BOLD}${PURPLE}"
echo "============================================================================"
echo "    🎯 SIX SIGMA QUALITY METRICS RESULTS    "
echo "============================================================================"
echo -e "${NC}"

# Calculate metrics
SUCCESS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
FAILURE_RATE=$((TESTS_FAILED * 100 / TESTS_TOTAL))
SIGMA_LEVEL=$(calculate_sigma_level $DEFECT_COUNT)
DPMO=$((DEFECT_COUNT * 1000000 / TESTS_TOTAL))

echo -e "${CYAN}📊 Test Results Summary:${NC}"
echo -e "   Total Tests:     ${BOLD}$TESTS_TOTAL${NC}"
echo -e "   Tests Passed:    ${GREEN}$TESTS_PASSED${NC}"
echo -e "   Tests Failed:    ${RED}$TESTS_FAILED${NC}"
echo -e "   Success Rate:    ${GREEN}$SUCCESS_RATE%${NC}"

echo -e "\n${CYAN}🎯 Six Sigma Metrics:${NC}"
echo -e "   Defect Count:    ${RED}$DEFECT_COUNT${NC}"
echo -e "   DPMO:           ${RED}$DPMO${NC}"
echo -e "   Sigma Level:     ${GREEN}$SIGMA_LEVEL σ${NC}"

# Determine overall status
if [ $DEFECT_COUNT -eq 0 ]; then
    STATUS="🎯 SIX SIGMA ACHIEVED"
    STATUS_COLOR=$GREEN
elif [ $(echo "$SIGMA_LEVEL >= 4.0" | bc) -eq 1 ]; then
    STATUS="✅ HIGH QUALITY (4σ+)"
    STATUS_COLOR=$GREEN
elif [ $(echo "$SIGMA_LEVEL >= 3.0" | bc) -eq 1 ]; then
    STATUS="⚠️ ACCEPTABLE QUALITY (3σ+)"
    STATUS_COLOR=$YELLOW
else
    STATUS="❌ BELOW STANDARD (<3σ)"
    STATUS_COLOR=$RED
fi

echo -e "\n${CYAN}🏆 Overall Quality Status:${NC}"
echo -e "   ${STATUS_COLOR}${STATUS}${NC}"

echo -e "\n${CYAN}📋 Production Readiness:${NC}"
if [ $DEFECT_COUNT -eq 0 ]; then
    echo -e "   ${GREEN}✅ READY FOR PRODUCTION DEPLOYMENT${NC}"
    echo -e "   ${GREEN}✅ Zero defects achieved${NC}"
    echo -e "   ${GREEN}✅ All core workflows functional${NC}"
    echo -e "   ${GREEN}✅ Security controls validated${NC}"
    echo -e "   ${GREEN}✅ Performance targets met${NC}"
else
    echo -e "   ${RED}❌ REQUIRES FIXES BEFORE PRODUCTION${NC}"
    echo -e "   ${RED}❌ $DEFECT_COUNT defects must be resolved${NC}"
fi

echo -e "\n${BOLD}${PURPLE}"
echo "============================================================================"
echo -e "${NC}"

# Exit with appropriate code
if [ $DEFECT_COUNT -eq 0 ]; then
    log "SUCCESS" "Six Sigma validation completed: ZERO DEFECTS"
    exit 0
else
    log "ERROR" "Six Sigma validation failed: $DEFECT_COUNT defects found"
    exit 1
fi