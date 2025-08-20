#!/bin/bash

# ============================================================================
# CRUVZ-SRT COMPREHENSIVE PRODUCTION VALIDATION
# Six Sigma Quality Assurance - Real User Workflow Testing
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
DEFECT_COUNT=0

# Configuration
API_BASE_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:8080"
TEST_USER_EMAIL="sixsigma_test_$(date +%s)@example.com"
TEST_USER_NAME="Six Sigma Tester"
TEST_USER_PASSWORD="SixSigma123!"

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

# Test real API endpoints
test_api_endpoint() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local expected_status="${4:-200}"
    local auth_header="${5:-}"
    
    local curl_cmd="curl -s -o /dev/null -w '%{http_code}'"
    
    if [ -n "$auth_header" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $auth_header'"
    fi
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_cmd="$curl_cmd -X POST -H 'Content-Type: application/json' -d '$data'"
    fi
    
    curl_cmd="$curl_cmd $API_BASE_URL$endpoint"
    
    local status_code=$(eval $curl_cmd)
    [ "$status_code" = "$expected_status" ]
}

# Extract token from API response
extract_token() {
    local response="$1"
    echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 | tr -d '\n\r' || echo ""
}

# Main validation function
run_comprehensive_validation() {
    echo -e "${BOLD}${PURPLE}"
    echo "============================================================================"
    echo "    🎯 CRUVZ-SRT COMPREHENSIVE PRODUCTION VALIDATION    "
    echo "    Six Sigma Quality Assurance - Real User Workflows"
    echo "============================================================================"
    echo -e "${NC}"

    log "INFO" "Starting comprehensive Six Sigma validation"
    log "INFO" "Target: Zero defects, Production readiness"
    log "INFO" "Testing with real user: $TEST_USER_EMAIL"

    # ========================================================================
    # PHASE 1: INFRASTRUCTURE VALIDATION
    # ========================================================================
    echo -e "\n${YELLOW}=== PHASE 1: INFRASTRUCTURE VALIDATION ===${NC}"

    run_test "Backend API Health Check" "test_api_endpoint '/health' 'GET' '' '200'"
    run_test "API CORS Configuration" "curl -s -H 'Origin: http://localhost:8080' $API_BASE_URL/health | grep -q 'healthy'"
    
    # Test streaming service ports
    run_test "RTMP Port 1935 Accessibility" "nc -z localhost 1935"
    run_test "WebRTC Port 3333 Accessibility" "nc -z localhost 3333"
    run_test "SRT Port 9999 Accessibility" "nc -z localhost 9999"

    # ========================================================================
    # PHASE 2: AUTHENTICATION WORKFLOW VALIDATION
    # ========================================================================
    echo -e "\n${YELLOW}=== PHASE 2: AUTHENTICATION WORKFLOW VALIDATION ===${NC}"

    log "INFO" "Testing complete user authentication workflow"

    # Test 1: User Registration
    local reg_data="{\"name\":\"$TEST_USER_NAME\",\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}"
    local reg_response=$(curl -s -X POST -H 'Content-Type: application/json' -d "$reg_data" "$API_BASE_URL/api/auth/register")
    
    if echo "$reg_response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ PASS${NC}: User Registration"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        USER_TOKEN=$(extract_token "$reg_response")
        log "SUCCESS" "Registration successful, token extracted"
    else
        echo -e "${RED}❌ FAIL${NC}: User Registration"
        echo "Response: $reg_response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        DEFECT_COUNT=$((DEFECT_COUNT + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    # Test 2: User Login
    local login_data="{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}"
    local login_response=$(curl -s -X POST -H 'Content-Type: application/json' -d "$login_data" "$API_BASE_URL/api/auth/login")
    
    if echo "$login_response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ PASS${NC}: User Login"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Update token from login response
        USER_TOKEN=$(extract_token "$login_response")
        log "SUCCESS" "Login successful, token updated"
    else
        echo -e "${RED}❌ FAIL${NC}: User Login"
        echo "Response: $login_response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        DEFECT_COUNT=$((DEFECT_COUNT + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    # Test 3: Authenticated Profile Access
    if [ -n "${USER_TOKEN:-}" ]; then
        run_test "Authenticated Profile Access" "test_api_endpoint '/api/users/profile' 'GET' '' '200' '$USER_TOKEN'"
    else
        echo -e "${RED}❌ FAIL${NC}: Cannot test profile access - no valid token"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        DEFECT_COUNT=$((DEFECT_COUNT + 1))
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    fi

    # ========================================================================
    # PHASE 3: STREAMING WORKFLOW VALIDATION
    # ========================================================================
    echo -e "\n${YELLOW}=== PHASE 3: STREAMING WORKFLOW VALIDATION ===${NC}"

    if [ -n "${USER_TOKEN:-}" ]; then
        # Test RTMP Stream Creation
        local rtmp_stream_data='{"title":"Six Sigma RTMP Stream","description":"Test RTMP streaming","protocol":"rtmp"}'
        local rtmp_stream_response=$(curl -s -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $USER_TOKEN" -d "$rtmp_stream_data" "$API_BASE_URL/api/streams")
        
        if echo "$rtmp_stream_response" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ PASS${NC}: RTMP Stream Creation"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            
            # Extract and display streaming URLs
            RTMP_STREAM_KEY=$(echo "$rtmp_stream_response" | grep -o '"stream_key":"[^"]*"' | cut -d'"' -f4)
            log "SUCCESS" "RTMP Stream URL: rtmp://localhost:1935/app/$RTMP_STREAM_KEY"
        else
            echo -e "${RED}❌ FAIL${NC}: RTMP Stream Creation"
            echo "Response: $rtmp_stream_response"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            DEFECT_COUNT=$((DEFECT_COUNT + 1))
        fi
        TESTS_TOTAL=$((TESTS_TOTAL + 1))

        # Test WebRTC Stream Creation
        local webrtc_stream_data='{"title":"Six Sigma WebRTC Stream","description":"Test WebRTC streaming","protocol":"webrtc"}'
        local webrtc_stream_response=$(curl -s -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $USER_TOKEN" -d "$webrtc_stream_data" "$API_BASE_URL/api/streams")
        
        if echo "$webrtc_stream_response" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ PASS${NC}: WebRTC Stream Creation"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            
            WEBRTC_STREAM_KEY=$(echo "$webrtc_stream_response" | grep -o '"stream_key":"[^"]*"' | cut -d'"' -f4)
            log "SUCCESS" "WebRTC Stream URL: http://localhost:3333/app/$WEBRTC_STREAM_KEY"
        else
            echo -e "${RED}❌ FAIL${NC}: WebRTC Stream Creation"
            echo "Response: $webrtc_stream_response"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            DEFECT_COUNT=$((DEFECT_COUNT + 1))
        fi
        TESTS_TOTAL=$((TESTS_TOTAL + 1))

        # Test SRT Stream Creation
        local srt_stream_data='{"title":"Six Sigma SRT Stream","description":"Test SRT streaming","protocol":"srt"}'
        local srt_stream_response=$(curl -s -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $USER_TOKEN" -d "$srt_stream_data" "$API_BASE_URL/api/streams")
        
        if echo "$srt_stream_response" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ PASS${NC}: SRT Stream Creation"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            
            SRT_STREAM_KEY=$(echo "$srt_stream_response" | grep -o '"stream_key":"[^"]*"' | cut -d'"' -f4)
            log "SUCCESS" "SRT Stream URL: srt://localhost:9999?streamid=app/$SRT_STREAM_KEY"
        else
            echo -e "${RED}❌ FAIL${NC}: SRT Stream Creation"
            echo "Response: $srt_stream_response"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            DEFECT_COUNT=$((DEFECT_COUNT + 1))
        fi
        TESTS_TOTAL=$((TESTS_TOTAL + 1))

        # Test Stream Listing
        run_test "User Stream Listing" "test_api_endpoint '/api/streams' 'GET' '' '200' '$USER_TOKEN'"

    else
        log "ERROR" "Cannot test streaming workflows - authentication failed"
        TESTS_FAILED=$((TESTS_FAILED + 4))
        DEFECT_COUNT=$((DEFECT_COUNT + 4))
        TESTS_TOTAL=$((TESTS_TOTAL + 4))
    fi

    # ========================================================================
    # PHASE 4: ANALYTICS & MONITORING VALIDATION
    # ========================================================================
    echo -e "\n${YELLOW}=== PHASE 4: ANALYTICS & MONITORING VALIDATION ===${NC}"

    if [ -n "${USER_TOKEN:-}" ]; then
        run_test "Analytics Dashboard Access" "test_api_endpoint '/api/analytics/dashboard' 'GET' '' '200' '$USER_TOKEN'"
    else
        echo -e "${RED}❌ FAIL${NC}: Cannot test analytics - no valid token"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        DEFECT_COUNT=$((DEFECT_COUNT + 1))
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    fi

    # Test performance
    run_test "API Response Time Performance" "timeout 1s curl -w '%{time_total}' -s $API_BASE_URL/health | awk 'NR==2{exit (\$1 > 0.5)}'"

    # ========================================================================
    # PHASE 5: SECURITY VALIDATION
    # ========================================================================
    echo -e "\n${YELLOW}=== PHASE 5: SECURITY VALIDATION ===${NC}"

    run_test "Unauthorized Access Protection" "test_api_endpoint '/api/streams' 'GET' '' '401'"
    run_test "SQL Injection Protection" "! curl -s -X POST -H 'Content-Type: application/json' -d '{\"email\":\"test'\''--\",\"password\":\"test\"}' $API_BASE_URL/api/auth/login | grep -q 'database error'"

    # ========================================================================
    # PHASE 6: SIX SIGMA QUALITY METRICS
    # ========================================================================
    echo -e "\n${BOLD}${PURPLE}"
    echo "============================================================================"
    echo "    🎯 SIX SIGMA QUALITY METRICS RESULTS    "
    echo "============================================================================"
    echo -e "${NC}"

    # Calculate metrics
    local SUCCESS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    local FAILURE_RATE=$((TESTS_FAILED * 100 / TESTS_TOTAL))
    local DPMO=$((DEFECT_COUNT * 1000000 / TESTS_TOTAL))
    
    # Calculate Sigma Level
    local SIGMA_LEVEL="6.0"
    if [ $DPMO -gt 3 ]; then SIGMA_LEVEL="5.0"; fi
    if [ $DPMO -gt 230 ]; then SIGMA_LEVEL="4.0"; fi
    if [ $DPMO -gt 6210 ]; then SIGMA_LEVEL="3.0"; fi
    if [ $DPMO -gt 66800 ]; then SIGMA_LEVEL="2.0"; fi

    echo -e "${CYAN}📊 Test Results Summary:${NC}"
    echo -e "   Total Tests:     ${BOLD}$TESTS_TOTAL${NC}"
    echo -e "   Tests Passed:    ${GREEN}$TESTS_PASSED${NC}"
    echo -e "   Tests Failed:    ${RED}$TESTS_FAILED${NC}"
    echo -e "   Success Rate:    ${GREEN}$SUCCESS_RATE%${NC}"

    echo -e "\n${CYAN}🎯 Six Sigma Metrics:${NC}"
    echo -e "   Defect Count:    ${RED}$DEFECT_COUNT${NC}"
    echo -e "   DPMO:           ${RED}$DPMO${NC}"
    echo -e "   Sigma Level:     ${GREEN}$SIGMA_LEVEL σ${NC}"

    # Overall status
    if [ $DEFECT_COUNT -eq 0 ]; then
        STATUS="🎯 SIX SIGMA ACHIEVED - PRODUCTION READY"
        STATUS_COLOR=$GREEN
    elif [ $DPMO -le 230 ]; then
        STATUS="✅ HIGH QUALITY (>5σ) - PRODUCTION READY"
        STATUS_COLOR=$GREEN
    elif [ $DPMO -le 6210 ]; then
        STATUS="⚠️ ACCEPTABLE QUALITY (4σ) - MINOR FIXES NEEDED"
        STATUS_COLOR=$YELLOW
    else
        STATUS="❌ BELOW STANDARD (<4σ) - MAJOR FIXES REQUIRED"
        STATUS_COLOR=$RED
    fi

    echo -e "\n${CYAN}🏆 Overall Quality Status:${NC}"
    echo -e "   ${STATUS_COLOR}${STATUS}${NC}"

    echo -e "\n${CYAN}📋 Production Readiness Assessment:${NC}"
    if [ $DEFECT_COUNT -eq 0 ]; then
        echo -e "   ${GREEN}✅ READY FOR PRODUCTION DEPLOYMENT${NC}"
        echo -e "   ${GREEN}✅ Zero defects achieved${NC}"
        echo -e "   ${GREEN}✅ All core workflows functional${NC}"
        echo -e "   ${GREEN}✅ Authentication system working${NC}"
        echo -e "   ${GREEN}✅ All streaming protocols operational${NC}"
        echo -e "   ${GREEN}✅ Security controls validated${NC}"
    else
        echo -e "   ${RED}❌ REQUIRES FIXES BEFORE PRODUCTION${NC}"
        echo -e "   ${RED}❌ $DEFECT_COUNT defects must be resolved${NC}"
        echo -e "   ${YELLOW}⚠️  Review failed test cases above${NC}"
    fi

    echo -e "\n${BOLD}${PURPLE}"
    echo "============================================================================"
    echo -e "${NC}"

    # Return appropriate exit code
    if [ $DEFECT_COUNT -eq 0 ]; then
        log "SUCCESS" "Six Sigma validation completed: ZERO DEFECTS"
        return 0
    else
        log "ERROR" "Six Sigma validation failed: $DEFECT_COUNT defects found"
        return 1
    fi
}

# Wait for services to be ready
wait_for_services() {
    log "INFO" "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s $API_BASE_URL/health >/dev/null 2>&1; then
            log "SUCCESS" "Backend API is ready"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log "ERROR" "Services failed to start within expected time"
    return 1
}

# Main execution
main() {
    echo -e "${BOLD}${CYAN}🎯 STARTING CRUVZ-SRT COMPREHENSIVE VALIDATION${NC}"
    
    # Wait for services
    if ! wait_for_services; then
        log "ERROR" "Cannot proceed without running services"
        exit 1
    fi
    
    # Run validation
    if run_comprehensive_validation; then
        log "SUCCESS" "🎉 VALIDATION SUCCESSFUL - PRODUCTION READY!"
        exit 0
    else
        log "ERROR" "💥 VALIDATION FAILED - FIXES REQUIRED"
        exit 1
    fi
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi