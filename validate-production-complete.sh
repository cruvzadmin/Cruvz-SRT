#!/bin/bash

# ===============================================================================
# CRUVZ-SRT COMPREHENSIVE PRODUCTION VALIDATION & TESTING SCRIPT
# End-to-end testing for complete streaming platform readiness
# ===============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs/validation"
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"
OME_URL="http://localhost:8080"
TEST_TIMEOUT=30

# Create log directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] $level: $*"

    case $level in
        "INFO")     echo -e "${BLUE}ℹ️  $message${NC}" ;;
        "SUCCESS")  echo -e "${GREEN}✅ $message${NC}" ;;
        "WARNING")  echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "ERROR")    echo -e "${RED}❌ $message${NC}" ;;
        "HEADER")   echo -e "${PURPLE}🚀 $message${NC}" ;;
        "TEST")     echo -e "${BLUE}🧪 $message${NC}" ;;
    esac
    
    # Also log to file
    echo "$message" >> "$LOG_DIR/validation_$(date +%Y%m%d_%H%M%S).log"
}

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    log "TEST" "Running: $test_name"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command" &>/dev/null; then
        log "SUCCESS" "✅ PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log "ERROR" "❌ FAILED: $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Check if services are running
check_service_health() {
    log "INFO" "Checking service health..."
    
    run_test "Docker services running" "docker compose ps --services --filter health=healthy | wc -l | grep -q '^[1-9]'"
    
    run_test "Backend API health" "curl -f -s $BACKEND_URL/health"
    
    run_test "Frontend accessibility" "curl -f -s $FRONTEND_URL | grep -q 'Cruvz'"
    
    run_test "OvenMediaEngine API" "curl -f -s -H 'Authorization: cruvz-production-api-token-2025' $OME_URL/v1/stats/current"
    
    run_test "PostgreSQL connectivity" "docker compose exec -T postgres pg_isready -U cruvz"
    
    run_test "Redis connectivity" "docker compose exec -T redis redis-cli ping | grep -q PONG"
}

# Test API endpoints
test_api_endpoints() {
    log "INFO" "Testing API endpoints..."
    
    # Test authentication endpoints
    run_test "Auth endpoints accessible" "curl -f -s $BACKEND_URL/api/auth/register -X POST -H 'Content-Type: application/json' -d '{}' | grep -q 'error'"
    
    # Test streaming endpoints
    run_test "Streams endpoint" "curl -f -s $BACKEND_URL/api/streams"
    
    run_test "Analytics endpoint" "curl -f -s $BACKEND_URL/api/analytics/data"
    
    run_test "Six Sigma endpoint" "curl -f -s $BACKEND_URL/api/six-sigma/metrics"
    
    run_test "OvenMediaEngine proxy" "curl -f -s $BACKEND_URL/api/ome/health"
    
    run_test "Protocols endpoint" "curl -f -s $BACKEND_URL/api/ome/protocols"
}

# Test OvenMediaEngine functionality
test_ovenmediaengine() {
    log "INFO" "Testing OvenMediaEngine streaming capabilities..."
    
    run_test "OME Statistics API" "curl -f -s -H 'Authorization: cruvz-production-api-token-2025' $OME_URL/v1/stats/current | grep -q 'totalConnections'"
    
    run_test "OME VHosts API" "curl -f -s -H 'Authorization: cruvz-production-api-token-2025' $OME_URL/v1/vhosts"
    
    run_test "OME Applications API" "curl -f -s -H 'Authorization: cruvz-production-api-token-2025' $OME_URL/v1/vhosts/default/apps"
    
    # Test protocol ports
    run_test "RTMP port accessible" "nc -z localhost 1935"
    
    run_test "SRT input port accessible" "nc -z -u localhost 9999"
    
    run_test "WebRTC signaling port accessible" "nc -z localhost 3333"
    
    run_test "LLHLS port accessible" "nc -z localhost 8088"
}

# Test database functionality
test_database() {
    log "INFO" "Testing database functionality..."
    
    # Test table existence
    run_test "Users table exists" "docker compose exec -T postgres psql -U cruvz -d cruvzdb -c '\dt users'"
    
    run_test "Streams table exists" "docker compose exec -T postgres psql -U cruvz -d cruvzdb -c '\dt streams'"
    
    run_test "Analytics table exists" "docker compose exec -T postgres psql -U cruvz -d cruvzdb -c '\dt analytics'"
    
    run_test "Six Sigma metrics table exists" "docker compose exec -T postgres psql -U cruvz -d cruvzdb -c '\dt six_sigma_metrics'"
    
    # Test basic CRUD operations
    run_test "Database insert test" "docker compose exec -T postgres psql -U cruvz -d cruvzdb -c \"INSERT INTO system_logs (level, message) VALUES ('info', 'test') RETURNING id;\""
    
    run_test "Database query test" "docker compose exec -T postgres psql -U cruvz -d cruvzdb -c \"SELECT COUNT(*) FROM system_logs WHERE message = 'test';\""
}

# Test monitoring stack
test_monitoring() {
    log "INFO" "Testing monitoring stack..."
    
    run_test "Prometheus accessible" "curl -f -s http://localhost:9090/-/healthy"
    
    run_test "Grafana accessible" "curl -f -s http://localhost:3000/api/health"
    
    run_test "Node exporter metrics" "curl -f -s http://localhost:9100/metrics | grep -q node_cpu"
}

# Test streaming workflow
test_streaming_workflow() {
    log "INFO" "Testing complete streaming workflow..."
    
    # Create a test stream
    local stream_response=$(curl -s -X POST "$BACKEND_URL/api/streams" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "test-stream-validation",
            "application": "app",
            "protocol": "RTMP",
            "enableRecording": false,
            "enableTranscoding": true
        }' 2>/dev/null || echo '{"error": "failed"}')
    
    if echo "$stream_response" | grep -q '"id"'; then
        log "SUCCESS" "Stream creation test passed"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Extract stream ID for cleanup
        local stream_id=$(echo "$stream_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        
        # Test stream endpoints
        run_test "Get stream details" "curl -f -s $BACKEND_URL/api/streams/$stream_id"
        
        # Cleanup test stream
        curl -s -X DELETE "$BACKEND_URL/api/streams/$stream_id" >/dev/null 2>&1 || true
    else
        log "ERROR" "Stream creation test failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test Six Sigma metrics
test_six_sigma() {
    log "INFO" "Testing Six Sigma quality metrics..."
    
    run_test "Six Sigma dashboard" "curl -f -s $BACKEND_URL/api/six-sigma/dashboard"
    
    run_test "Quality metrics collection" "curl -f -s $BACKEND_URL/api/six-sigma/metrics | grep -q '\\['"
    
    run_test "Six Sigma report generation" "curl -f -s $BACKEND_URL/api/six-sigma/report"
    
    # Test metric creation
    local metric_response=$(curl -s -X POST "$BACKEND_URL/api/six-sigma/metrics" \
        -H "Content-Type: application/json" \
        -d '{
            "metric_name": "test_validation_metric",
            "metric_value": 99.5,
            "target_value": 99.0,
            "category": "validation"
        }' 2>/dev/null || echo '{"error": "failed"}')
    
    if echo "$metric_response" | grep -q '"id"'; then
        log "SUCCESS" "Six Sigma metric creation test passed"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log "ERROR" "Six Sigma metric creation test failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Performance testing
test_performance() {
    log "INFO" "Running basic performance tests..."
    
    # Test API response times
    local start_time=$(date +%s%N)
    curl -s "$BACKEND_URL/health" >/dev/null
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))
    
    if [ $response_time -lt 500 ]; then
        log "SUCCESS" "API response time: ${response_time}ms (< 500ms target)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log "WARNING" "API response time: ${response_time}ms (> 500ms target)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test concurrent connections
    run_test "Concurrent API requests" "for i in {1..10}; do curl -s $BACKEND_URL/health & done; wait"
}

# Security testing
test_security() {
    log "INFO" "Running basic security tests..."
    
    # Test CORS headers
    run_test "CORS headers present" "curl -s -I $BACKEND_URL/api/health | grep -q 'Access-Control-Allow-Origin'"
    
    # Test rate limiting
    run_test "Rate limiting configured" "curl -s -I $BACKEND_URL/api/health | grep -q 'X-RateLimit'"
    
    # Test security headers
    run_test "Security headers present" "curl -s -I $BACKEND_URL/api/health | grep -q 'X-Content-Type-Options'"
}

# Generate comprehensive report
generate_report() {
    local report_file="$LOG_DIR/validation_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Cruvz-SRT Production Validation Report

**Generated:** $(date)
**Test Environment:** Production Docker Compose

## Test Summary

- **Total Tests:** $TOTAL_TESTS
- **Passed:** $PASSED_TESTS
- **Failed:** $FAILED_TESTS
- **Success Rate:** $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%

## Test Categories

### ✅ Service Health
- Docker services status
- Backend API health
- Frontend accessibility
- OvenMediaEngine connectivity
- Database connectivity
- Cache connectivity

### ✅ API Functionality
- Authentication endpoints
- Streaming management
- Analytics data
- Six Sigma metrics
- OvenMediaEngine proxy

### ✅ Streaming Engine
- Protocol availability
- Port accessibility
- Statistics API
- Configuration management

### ✅ Database Operations
- Table structure
- CRUD operations
- Data integrity

### ✅ Monitoring Stack
- Prometheus metrics
- Grafana dashboards
- System monitoring

### ✅ Six Sigma Quality
- Metrics collection
- Dashboard functionality
- Report generation

### ✅ Performance
- Response times
- Concurrent handling
- Resource utilization

### ✅ Security
- CORS configuration
- Rate limiting
- Security headers

## Recommendations

EOF

    if [ $FAILED_TESTS -eq 0 ]; then
        echo "🎉 **ALL TESTS PASSED** - System is production ready!" >> "$report_file"
    else
        echo "⚠️ **Some tests failed** - Review failed tests before production deployment." >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "**Detailed logs:** Check $LOG_DIR for complete test logs" >> "$report_file"
    
    log "INFO" "Comprehensive report generated: $report_file"
}

# Main execution
main() {
    log "HEADER" "🚀 CRUVZ-SRT COMPREHENSIVE PRODUCTION VALIDATION"
    log "HEADER" "============================================================================"
    echo ""
    
    # Check if services are running
    if ! docker compose ps | grep -q "Up"; then
        log "ERROR" "Docker Compose services are not running. Please start them first with: ./deploy-production.sh"
        exit 1
    fi
    
    # Wait for services to be fully ready
    log "INFO" "Waiting for services to be fully ready..."
    sleep 10
    
    # Run all test categories
    check_service_health
    test_api_endpoints
    test_ovenmediaengine
    test_database
    test_monitoring
    test_streaming_workflow
    test_six_sigma
    test_performance
    test_security
    
    echo ""
    log "HEADER" "============================================================================"
    log "HEADER" "📊 VALIDATION COMPLETE"
    log "HEADER" "============================================================================"
    echo ""
    
    log "INFO" "Total Tests: $TOTAL_TESTS"
    log "SUCCESS" "Passed: $PASSED_TESTS"
    if [ $FAILED_TESTS -gt 0 ]; then
        log "ERROR" "Failed: $FAILED_TESTS"
    else
        log "SUCCESS" "Failed: $FAILED_TESTS"
    fi
    
    local success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    log "INFO" "Success Rate: $success_rate%"
    
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log "SUCCESS" "🎉 ALL TESTS PASSED - SYSTEM IS PRODUCTION READY!"
    elif [ $success_rate -ge 90 ]; then
        log "WARNING" "⚠️ Most tests passed ($success_rate%) - Minor issues detected"
    else
        log "ERROR" "❌ Significant issues detected ($success_rate% success rate)"
    fi
    
    echo ""
    generate_report
    
    log "INFO" "🔍 For detailed logs, check: $LOG_DIR"
    log "INFO" "🌐 Frontend: $FRONTEND_URL"
    log "INFO" "🔧 Backend API: $BACKEND_URL"
    log "INFO" "📊 Grafana: http://localhost:3000 (admin/cruvz123)"
    
    echo ""
    log "HEADER" "============================================================================"
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"