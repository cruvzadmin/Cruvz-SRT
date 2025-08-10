#!/bin/bash

# ===============================================================================
# CRUVZ STREAMING - COMPREHENSIVE PRODUCTION VALIDATION SCRIPT
# Validates complete production deployment with detailed reporting
# ===============================================================================

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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/tmp/cruvz-validation"
VALIDATION_LOG="$LOG_DIR/validation-$(date +%Y%m%d-%H%M%S).log"
COMPOSE_FILE="docker-compose.prod.yml"
SCREENSHOT_FILE="$LOG_DIR/website-screenshot.png"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0

# Create log directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] $level: $*"
    
    case $level in
        "INFO")     echo -e "${BLUE}ℹ️  $message${NC}" | tee -a "$VALIDATION_LOG" ;;
        "SUCCESS")  echo -e "${GREEN}✅ $message${NC}" | tee -a "$VALIDATION_LOG" ;;
        "WARN")     echo -e "${YELLOW}⚠️  $message${NC}" | tee -a "$VALIDATION_LOG" ;;
        "ERROR")    echo -e "${RED}❌ $message${NC}" | tee -a "$VALIDATION_LOG" ;;
        "HEADER")   echo -e "${PURPLE}${BOLD}🧪 $message${NC}" | tee -a "$VALIDATION_LOG" ;;
        "TEST")     echo -e "${CYAN}🔍 $message${NC}" | tee -a "$VALIDATION_LOG" ;;
    esac
}

# Test result tracking
track_test() {
    local result=$1
    local test_name=$2
    
    ((TOTAL_TESTS++))
    
    case $result in
        "PASS")
            ((PASSED_TESTS++))
            log "SUCCESS" "PASS: $test_name"
            ;;
        "FAIL")
            ((FAILED_TESTS++))
            log "ERROR" "FAIL: $test_name"
            ;;
        "WARN")
            ((WARNING_TESTS++))
            log "WARN" "WARN: $test_name"
            ;;
    esac
}

# Print banner
print_banner() {
    clear
    echo ""
    log "HEADER" "============================================================================"
    log "HEADER" "       🧪 CRUVZ STREAMING - PRODUCTION VALIDATION SUITE                   "
    log "HEADER" "============================================================================"
    log "HEADER" "🔍 Comprehensive testing of production deployment"
    log "HEADER" "📊 Service health, functionality, and performance validation"
    log "HEADER" "🎯 Zero-error production verification"
    log "HEADER" "============================================================================"
    echo ""
}

# Test Docker environment
test_docker_environment() {
    log "TEST" "Testing Docker Environment..."
    
    if ! command -v docker &> /dev/null; then
        track_test "FAIL" "Docker command availability"
        return 1
    fi
    track_test "PASS" "Docker command availability"
    
    if ! docker info &> /dev/null; then
        track_test "FAIL" "Docker daemon accessibility"
        return 1
    fi
    track_test "PASS" "Docker daemon accessibility"
    
    if ! docker compose -f "$COMPOSE_FILE" ps &> /dev/null; then
        track_test "FAIL" "Docker Compose file validation"
        return 1
    fi
    track_test "PASS" "Docker Compose file validation"
}

# Test service containers
test_service_containers() {
    log "TEST" "Testing Service Containers..."
    
    local services=("backend" "origin" "web-app" "prometheus" "grafana" "redis")
    local container_prefix="cruvz-"
    
    for service in "${services[@]}"; do
        local container_name="${container_prefix}${service//-*/}-prod"
        
        if docker ps --filter "name=$container_name" --format "table {{.Names}}" | grep -q "$container_name"; then
            local status=$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null)
            if [ "$status" = "running" ]; then
                track_test "PASS" "Container $container_name is running"
            else
                track_test "FAIL" "Container $container_name status: $status"
            fi
        else
            track_test "FAIL" "Container $container_name not found"
        fi
    done
}

# Test service health endpoints
test_service_health() {
    log "TEST" "Testing Service Health Endpoints..."
    
    local endpoints=(
        "http://localhost:5000/health|Backend API Health"
        "http://localhost:8080|Streaming Engine"
        "http://localhost:3000/api/health|Grafana Health"
        "http://localhost:9090/-/healthy|Prometheus Health"
    )
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS='|' read -r endpoint name <<< "$endpoint_info"
        
        if curl -s -f --max-time 10 "$endpoint" > /dev/null 2>&1; then
            track_test "PASS" "$name endpoint"
        else
            track_test "FAIL" "$name endpoint"
        fi
    done
}

# Test web application accessibility
test_web_application() {
    log "TEST" "Testing Web Application..."
    
    # Test main website
    if curl -s -f --max-time 10 "http://localhost:80" > /dev/null 2>&1; then
        track_test "PASS" "Main website accessibility"
    else
        track_test "FAIL" "Main website accessibility"
    fi
    
    # Test dashboard page
    if curl -s -f --max-time 10 "http://localhost:80/pages/dashboard.html" > /dev/null 2>&1; then
        track_test "PASS" "Dashboard page accessibility"
    else
        track_test "WARN" "Dashboard page accessibility"
    fi
    
    # Test admin pages
    if curl -s -f --max-time 10 "http://localhost:80/pages/" > /dev/null 2>&1; then
        track_test "PASS" "Admin pages accessibility"
    else
        track_test "WARN" "Admin pages accessibility"
    fi
}

# Test backend API functionality
test_backend_api() {
    log "TEST" "Testing Backend API Functionality..."
    
    # Test health endpoint
    local health_response
    if health_response=$(curl -s --max-time 10 "http://localhost:5000/health" 2>/dev/null); then
        if echo "$health_response" | grep -q "healthy\|ok"; then
            track_test "PASS" "Backend health endpoint response"
        else
            track_test "WARN" "Backend health endpoint response format"
        fi
    else
        track_test "FAIL" "Backend health endpoint"
    fi
    
    # Test authentication endpoints
    if curl -s -f --max-time 10 "http://localhost:5000/api/auth" > /dev/null 2>&1; then
        track_test "PASS" "Authentication endpoint accessibility"
    else
        track_test "WARN" "Authentication endpoint accessibility"
    fi
    
    # Test user registration functionality
    local test_email="test-$(date +%s)@cruvz.local"
    if curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"name\":\"Test User\",\"email\":\"$test_email\",\"password\":\"Test123!@#\"}" \
        "http://localhost:5000/api/auth/register" | grep -q "success\|id\|token"; then
        track_test "PASS" "User registration functionality"
    else
        track_test "WARN" "User registration functionality"
    fi
}

# Test streaming endpoints
test_streaming_endpoints() {
    log "TEST" "Testing Streaming Endpoints..."
    
    # Test RTMP port
    if timeout 5 bash -c "</dev/tcp/localhost/1935" 2>/dev/null; then
        track_test "PASS" "RTMP port (1935) accessibility"
    else
        track_test "FAIL" "RTMP port (1935) accessibility"
    fi
    
    # Test SRT port
    if timeout 5 bash -c "</dev/udp/localhost/9999" 2>/dev/null; then
        track_test "PASS" "SRT port (9999) accessibility"
    else
        track_test "WARN" "SRT port (9999) accessibility"
    fi
    
    # Test WebRTC signaling port
    if timeout 5 bash -c "</dev/tcp/localhost/3333" 2>/dev/null; then
        track_test "PASS" "WebRTC signaling port (3333) accessibility"
    else
        track_test "FAIL" "WebRTC signaling port (3333) accessibility"
    fi
    
    # Test origin server API
    if curl -s -f --max-time 10 "http://localhost:8080" > /dev/null 2>&1; then
        track_test "PASS" "Origin server API accessibility"
    else
        track_test "FAIL" "Origin server API accessibility"
    fi
}

# Test monitoring systems
test_monitoring_systems() {
    log "TEST" "Testing Monitoring Systems..."
    
    # Test Prometheus
    if curl -s -f --max-time 10 "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
        track_test "PASS" "Prometheus monitoring system"
    else
        track_test "FAIL" "Prometheus monitoring system"
    fi
    
    # Test Grafana
    if curl -s -f --max-time 10 "http://localhost:3000/api/health" > /dev/null 2>&1; then
        track_test "PASS" "Grafana dashboard system"
    else
        track_test "FAIL" "Grafana dashboard system"
    fi
    
    # Test Grafana login
    if curl -s -X POST -H "Content-Type: application/json" \
        -d '{"user":"admin","password":"cruvz123"}' \
        "http://localhost:3000/api/login" | grep -q "message\|token"; then
        track_test "PASS" "Grafana authentication"
    else
        track_test "WARN" "Grafana authentication"
    fi
    
    # Test Redis
    if timeout 5 bash -c "</dev/tcp/localhost/6379" 2>/dev/null; then
        track_test "PASS" "Redis cache accessibility"
    else
        track_test "WARN" "Redis cache accessibility"
    fi
}

# Test database functionality
test_database_functionality() {
    log "TEST" "Testing Database Functionality..."
    
    # Test database file existence
    if [ -f "./data/database/cruvz_production.db" ]; then
        track_test "PASS" "Production database file exists"
    else
        track_test "WARN" "Production database file existence"
    fi
    
    # Test database connectivity through backend
    if docker compose -f "$COMPOSE_FILE" exec -T backend node -e "
        const db = require('./config/database');
        db.raw('SELECT 1 as test')
            .then(() => { console.log('DB_OK'); process.exit(0); })
            .catch(e => { console.error('DB_ERROR:', e.message); process.exit(1); });
    " 2>/dev/null | grep -q "DB_OK"; then
        track_test "PASS" "Database connectivity"
    else
        track_test "WARN" "Database connectivity"
    fi
}

# Test security configurations
test_security_configurations() {
    log "TEST" "Testing Security Configurations..."
    
    # Test security headers
    local security_headers=$(curl -s -I "http://localhost:5000" 2>/dev/null)
    
    if echo "$security_headers" | grep -q "X-Content-Type-Options"; then
        track_test "PASS" "X-Content-Type-Options header"
    else
        track_test "WARN" "X-Content-Type-Options header"
    fi
    
    if echo "$security_headers" | grep -q "X-Frame-Options"; then
        track_test "PASS" "X-Frame-Options header"
    else
        track_test "WARN" "X-Frame-Options header"
    fi
    
    # Test rate limiting
    if echo "$security_headers" | grep -qi "rate.limit"; then
        track_test "PASS" "Rate limiting headers"
    else
        track_test "WARN" "Rate limiting headers"
    fi
    
    # Test CORS configuration
    if curl -s -H "Origin: http://localhost" -I "http://localhost:5000" | grep -q "Access-Control"; then
        track_test "PASS" "CORS configuration"
    else
        track_test "WARN" "CORS configuration"
    fi
}

# Test performance and resource usage
test_performance() {
    log "TEST" "Testing Performance and Resource Usage..."
    
    # Test response times
    local backend_time=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:5000/health" 2>/dev/null)
    if (( $(echo "$backend_time < 2.0" | bc -l) )); then
        track_test "PASS" "Backend response time (${backend_time}s)"
    else
        track_test "WARN" "Backend response time (${backend_time}s)"
    fi
    
    local webapp_time=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:80" 2>/dev/null)
    if (( $(echo "$webapp_time < 1.0" | bc -l) )); then
        track_test "PASS" "Web app response time (${webapp_time}s)"
    else
        track_test "WARN" "Web app response time (${webapp_time}s)"
    fi
    
    # Test container resource usage
    local containers=$(docker compose -f "$COMPOSE_FILE" ps -q)
    local total_memory=0
    
    for container in $containers; do
        local memory=$(docker stats --no-stream --format "{{.MemUsage}}" "$container" 2>/dev/null | cut -d'/' -f1 | sed 's/[^0-9.]//g')
        if [ -n "$memory" ]; then
            total_memory=$(echo "$total_memory + $memory" | bc -l 2>/dev/null || echo "0")
        fi
    done
    
    if (( $(echo "$total_memory < 4000" | bc -l) )); then
        track_test "PASS" "Total memory usage (${total_memory}MB)"
    else
        track_test "WARN" "Total memory usage (${total_memory}MB)"
    fi
}

# Test screenshot capture
test_screenshot_capture() {
    log "TEST" "Testing Website Screenshot Capture..."
    
    # Try to capture screenshot using headless browser if available
    if command -v chromium-browser &> /dev/null || command -v google-chrome &> /dev/null; then
        local browser_cmd="chromium-browser"
        command -v google-chrome &> /dev/null && browser_cmd="google-chrome"
        
        if timeout 30 $browser_cmd --headless --disable-gpu --no-sandbox --window-size=1280,720 \
            --screenshot="$SCREENSHOT_FILE" "http://localhost:80" 2>/dev/null; then
            track_test "PASS" "Website screenshot capture"
            log "INFO" "Screenshot saved: $SCREENSHOT_FILE"
        else
            track_test "WARN" "Website screenshot capture"
        fi
    else
        track_test "WARN" "Browser not available for screenshot"
    fi
}

# Generate validation report
generate_validation_report() {
    local report_file="$LOG_DIR/validation-report-$(date +%Y%m%d-%H%M%S).txt"
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    
    {
        echo "==============================================================================="
        echo "CRUVZ STREAMING - PRODUCTION VALIDATION REPORT"
        echo "==============================================================================="
        echo "Validation Time: $(date)"
        echo "Validation Log: $VALIDATION_LOG"
        echo ""
        echo "TEST SUMMARY:"
        echo "-------------"
        echo "Total Tests:    $TOTAL_TESTS"
        echo "Passed:         $PASSED_TESTS"
        echo "Failed:         $FAILED_TESTS"
        echo "Warnings:       $WARNING_TESTS"
        echo "Success Rate:   ${success_rate}%"
        echo ""
        echo "VALIDATION STATUS:"
        echo "------------------"
        if [ $success_rate -ge 95 ]; then
            echo "✅ EXCELLENT - Production ready with minimal issues"
        elif [ $success_rate -ge 85 ]; then
            echo "✅ GOOD - Production ready with minor warnings"
        elif [ $success_rate -ge 70 ]; then
            echo "⚠️  ACCEPTABLE - Production usable with some issues"
        else
            echo "❌ NEEDS IMPROVEMENT - Significant issues detected"
        fi
        echo ""
        echo "SERVICE STATUS:"
        echo "---------------"
        docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || echo "Unable to get service status"
        echo ""
        echo "RECOMMENDATIONS:"
        echo "----------------"
        if [ $FAILED_TESTS -gt 0 ]; then
            echo "- Review failed tests in validation log"
            echo "- Check service logs for error details"
            echo "- Verify network connectivity and ports"
        fi
        if [ $WARNING_TESTS -gt 0 ]; then
            echo "- Address warning tests for optimal performance"
            echo "- Consider security hardening for production use"
        fi
        if [ $success_rate -ge 95 ]; then
            echo "- System is production-ready"
            echo "- Consider monitoring and alerting setup"
        fi
        echo ""
        echo "NEXT STEPS:"
        echo "-----------"
        echo "- Monitor system performance in production"
        echo "- Set up regular health checks"
        echo "- Implement backup and recovery procedures"
        echo "- Review logs regularly for optimization opportunities"
        echo ""
        echo "==============================================================================="
    } > "$report_file"
    
    log "SUCCESS" "Validation report generated: $report_file"
    cat "$report_file"
}

# Display final validation results
display_final_results() {
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    
    echo ""
    log "HEADER" "============================================================================"
    log "HEADER" "🧪 PRODUCTION VALIDATION COMPLETED"
    log "HEADER" "============================================================================"
    
    if [ $success_rate -ge 95 ]; then
        log "SUCCESS" "🎉 EXCELLENT VALIDATION RESULTS!"
        log "SUCCESS" "✅ $PASSED_TESTS/$TOTAL_TESTS tests passed ($success_rate%)"
        log "SUCCESS" "✅ Production deployment is ready for live use"
    elif [ $success_rate -ge 85 ]; then
        log "SUCCESS" "🎯 GOOD VALIDATION RESULTS!"
        log "SUCCESS" "✅ $PASSED_TESTS/$TOTAL_TESTS tests passed ($success_rate%)"
        log "WARN" "⚠️  $WARNING_TESTS warnings need attention"
    elif [ $success_rate -ge 70 ]; then
        log "WARN" "⚠️  ACCEPTABLE VALIDATION RESULTS"
        log "WARN" "⚠️  $PASSED_TESTS/$TOTAL_TESTS tests passed ($success_rate%)"
        log "WARN" "⚠️  $FAILED_TESTS failures and $WARNING_TESTS warnings need attention"
    else
        log "ERROR" "❌ VALIDATION ISSUES DETECTED"
        log "ERROR" "❌ $PASSED_TESTS/$TOTAL_TESTS tests passed ($success_rate%)"
        log "ERROR" "❌ $FAILED_TESTS failures require immediate attention"
    fi
    
    echo ""
    log "INFO" "📝 Validation log: $VALIDATION_LOG"
    if [ -f "$SCREENSHOT_FILE" ]; then
        log "INFO" "📸 Website screenshot: $SCREENSHOT_FILE"
    fi
    
    log "HEADER" "============================================================================"
}

# Main validation function
main() {
    print_banner
    
    log "INFO" "Starting comprehensive production validation..."
    log "INFO" "Validation log: $VALIDATION_LOG"
    echo ""
    
    # Run all validation tests
    test_docker_environment
    test_service_containers
    test_service_health
    test_web_application
    test_backend_api
    test_streaming_endpoints
    test_monitoring_systems
    test_database_functionality
    test_security_configurations
    test_performance
    test_screenshot_capture
    
    # Generate comprehensive report
    generate_validation_report
    
    # Display final results
    display_final_results
    
    # Exit with appropriate code
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    if [ $success_rate -ge 85 ]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script arguments
case "${1:-validate}" in
    "validate"|"test"|"")
        main
        ;;
    "quick")
        log "INFO" "Running quick validation checks..."
        test_service_containers
        test_service_health
        test_web_application
        display_final_results
        ;;
    "health")
        log "INFO" "Running health checks only..."
        test_service_health
        display_final_results
        ;;
    "help"|"-h"|"--help")
        echo "Cruvz Streaming - Production Validation Script"
        echo ""
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  validate    Run comprehensive validation (default)"
        echo "  quick       Run quick validation checks"
        echo "  health      Run health checks only"
        echo "  help        Show this help message"
        echo ""
        exit 0
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        log "INFO" "Use '$0 help' for usage information"
        exit 1
        ;;
esac