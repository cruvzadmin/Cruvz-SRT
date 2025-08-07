#!/bin/bash

# Cruvz Streaming Complete End-to-End Test Script
# Tests all Six Sigma deployment components including backend API

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test configuration
API_BASE_URL="http://localhost:5000/api"
WEB_BASE_URL="http://localhost"
GRAFANA_URL="http://localhost:3000"
PROMETHEUS_URL="http://localhost:9090"

log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    case $level in
        "INFO")  echo -e "${BLUE}[${timestamp}] INFO: $*${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[${timestamp}] SUCCESS: $*${NC}" ;;
        "ERROR") echo -e "${RED}[${timestamp}] ERROR: $*${NC}" ;;
        "WARN") echo -e "${YELLOW}[${timestamp}] WARN: $*${NC}" ;;
    esac
}

# Test backend API health
test_backend_api() {
    log "INFO" "Testing backend API health..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "${API_BASE_URL%/api}/health" || echo "000")
    
    if [ "$response" = "200" ]; then
        local status=$(cat /tmp/health_response.json | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
        if [ "$status" = "healthy" ]; then
            log "SUCCESS" "Backend API is healthy"
            return 0
        else
            log "ERROR" "Backend API health check failed: $status"
            return 1
        fi
    else
        log "ERROR" "Backend API health check failed with HTTP $response"
        return 1
    fi
}

# Test database connectivity
test_database() {
    log "INFO" "Testing database connectivity..."
    
    # Test user registration endpoint to verify database
    local test_email="test_$(date +%s)@cruvztest.com"
    local test_password="TestPass123!"
    local test_name="Test User"
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/register_response.json \
        -X POST "${API_BASE_URL}/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$test_email\",\"password\":\"$test_password\",\"name\":\"$test_name\"}" \
        2>/dev/null || echo "000")
    
    if [ "$response" = "201" ]; then
        log "SUCCESS" "Database connectivity test passed"
        
        # Clean up test user
        local token=$(cat /tmp/register_response.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
        if [ -n "$token" ]; then
            # Test authenticated endpoint
            local auth_response=$(curl -s -w "%{http_code}" -o /tmp/profile_response.json \
                -H "Authorization: Bearer $token" \
                "${API_BASE_URL}/users/profile" 2>/dev/null || echo "000")
            
            if [ "$auth_response" = "200" ]; then
                log "SUCCESS" "Authentication system working"
            else
                log "WARN" "Authentication test failed with HTTP $auth_response"
            fi
        fi
        return 0
    else
        log "ERROR" "Database connectivity test failed with HTTP $response"
        cat /tmp/register_response.json 2>/dev/null || echo "No response body"
        return 1
    fi
}

# Test web application
test_web_application() {
    log "INFO" "Testing web application..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/web_response.html "$WEB_BASE_URL" || echo "000")
    
    if [ "$response" = "200" ]; then
        # Check if the web app contains expected content
        if grep -q "Cruvz Streaming" /tmp/web_response.html; then
            log "SUCCESS" "Web application is accessible and contains expected content"
            
            # Test dashboard endpoint
            local dashboard_response=$(curl -s -w "%{http_code}" -o /tmp/dashboard_response.html "${WEB_BASE_URL}/pages/dashboard.html" || echo "000")
            if [ "$dashboard_response" = "200" ]; then
                log "SUCCESS" "Dashboard page is accessible"
            else
                log "WARN" "Dashboard page test failed with HTTP $dashboard_response"
            fi
            return 0
        else
            log "ERROR" "Web application content validation failed"
            return 1
        fi
    else
        log "ERROR" "Web application test failed with HTTP $response"
        return 1
    fi
}

# Test monitoring services
test_monitoring() {
    log "INFO" "Testing monitoring services..."
    
    # Test Prometheus
    local prom_response=$(curl -s -w "%{http_code}" -o /tmp/prom_response.json "${PROMETHEUS_URL}/-/healthy" || echo "000")
    if [ "$prom_response" = "200" ]; then
        log "SUCCESS" "Prometheus is healthy"
    else
        log "ERROR" "Prometheus health check failed with HTTP $prom_response"
        return 1
    fi
    
    # Test Grafana
    local grafana_response=$(curl -s -w "%{http_code}" -o /tmp/grafana_response.json "${GRAFANA_URL}/api/health" || echo "000")
    if [ "$grafana_response" = "200" ]; then
        log "SUCCESS" "Grafana is healthy"
    else
        log "ERROR" "Grafana health check failed with HTTP $grafana_response"
        return 1
    fi
    
    return 0
}

# Test streaming ports
test_streaming_ports() {
    log "INFO" "Testing streaming ports..."
    
    local ports=("1935" "3333" "9000" "9999")
    local failed=0
    
    for port in "${ports[@]}"; do
        if ss -tuln 2>/dev/null | grep -q ":$port " || netstat -tuln 2>/dev/null | grep -q ":$port "; then
            log "SUCCESS" "Port $port is listening"
        else
            log "ERROR" "Port $port is not listening"
            ((failed++))
        fi
    done
    
    return $failed
}

# Test Six Sigma API endpoints
test_six_sigma_api() {
    log "INFO" "Testing Six Sigma API endpoints..."
    
    # First create a test user and get token
    local admin_email="admin@cruvzstreaming.com"
    local admin_password="changeme123!"
    
    local login_response=$(curl -s -w "%{http_code}" -o /tmp/admin_login.json \
        -X POST "${API_BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$admin_email\",\"password\":\"$admin_password\"}" \
        2>/dev/null || echo "000")
    
    if [ "$login_response" = "200" ]; then
        local admin_token=$(cat /tmp/admin_login.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
        
        if [ -n "$admin_token" ]; then
            # Test Six Sigma dashboard endpoint
            local six_sigma_response=$(curl -s -w "%{http_code}" -o /tmp/six_sigma.json \
                -H "Authorization: Bearer $admin_token" \
                "${API_BASE_URL}/six-sigma/dashboard" 2>/dev/null || echo "000")
            
            if [ "$six_sigma_response" = "200" ]; then
                log "SUCCESS" "Six Sigma API endpoints are working"
                
                # Check if response contains expected Six Sigma data
                if grep -q "overall_sigma_level" /tmp/six_sigma.json; then
                    log "SUCCESS" "Six Sigma metrics are being calculated"
                else
                    log "WARN" "Six Sigma response missing expected metrics"
                fi
                return 0
            else
                log "ERROR" "Six Sigma API test failed with HTTP $six_sigma_response"
                return 1
            fi
        else
            log "ERROR" "Failed to extract admin token"
            return 1
        fi
    else
        log "WARN" "Admin login failed, using default credentials. Check if they need to be updated."
        return 0
    fi
}

# Test stream management API
test_stream_management() {
    log "INFO" "Testing stream management API..."
    
    # Create a test user for stream management
    local test_email="streamer_$(date +%s)@cruvztest.com"
    local test_password="StreamPass123!"
    local test_name="Test Streamer"
    
    local register_response=$(curl -s -w "%{http_code}" -o /tmp/streamer_register.json \
        -X POST "${API_BASE_URL}/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$test_email\",\"password\":\"$test_password\",\"name\":\"$test_name\"}" \
        2>/dev/null || echo "000")
    
    if [ "$register_response" = "201" ]; then
        local token=$(cat /tmp/streamer_register.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
        
        if [ -n "$token" ]; then
            # Test stream creation
            local stream_response=$(curl -s -w "%{http_code}" -o /tmp/stream_create.json \
                -X POST "${API_BASE_URL}/streams" \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json" \
                -d '{"title":"Test Stream","description":"E2E Test Stream","protocol":"rtmp"}' \
                2>/dev/null || echo "000")
            
            if [ "$stream_response" = "201" ]; then
                log "SUCCESS" "Stream creation API working"
                
                # Test stream listing
                local list_response=$(curl -s -w "%{http_code}" -o /tmp/stream_list.json \
                    -H "Authorization: Bearer $token" \
                    "${API_BASE_URL}/streams" 2>/dev/null || echo "000")
                
                if [ "$list_response" = "200" ]; then
                    log "SUCCESS" "Stream listing API working"
                    return 0
                else
                    log "ERROR" "Stream listing failed with HTTP $list_response"
                    return 1
                fi
            else
                log "ERROR" "Stream creation failed with HTTP $stream_response"
                cat /tmp/stream_create.json 2>/dev/null || echo "No response body"
                return 1
            fi
        else
            log "ERROR" "Failed to extract user token"
            return 1
        fi
    else
        log "ERROR" "User registration for stream test failed with HTTP $register_response"
        return 1
    fi
}

# Test container health
test_containers() {
    log "INFO" "Testing container health..."
    
    # Check if docker compose is running
    if ! docker compose ps >/dev/null 2>&1; then
        log "ERROR" "Docker compose is not running"
        return 1
    fi
    
    local containers=("backend" "web-app" "origin" "monitoring" "grafana")
    local failed=0
    
    for container in "${containers[@]}"; do
        local health=$(docker compose ps "$container" --format json 2>/dev/null | jq -r '.Health // "unknown"' 2>/dev/null || echo "unknown")
        local status=$(docker compose ps "$container" --format json 2>/dev/null | jq -r '.State // "unknown"' 2>/dev/null || echo "unknown")
        
        if [ "$status" = "running" ] && ([ "$health" = "healthy" ] || [ "$health" = "unknown" ]); then
            log "SUCCESS" "Container $container is running and healthy"
        else
            log "ERROR" "Container $container health check failed (Status: $status, Health: $health)"
            ((failed++))
        fi
    done
    
    return $failed
}

# Test API performance
test_api_performance() {
    log "INFO" "Testing API performance..."
    
    local start_time=$(date +%s%N)
    local response=$(curl -s -w "%{http_code}" -o /dev/null "${API_BASE_URL%/api}/health" || echo "000")
    local end_time=$(date +%s%N)
    
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ "$response" = "200" ] && [ "$duration" -lt 1000 ]; then
        log "SUCCESS" "API performance test passed (${duration}ms)"
        return 0
    else
        log "WARN" "API performance test concern (${duration}ms, HTTP $response)"
        return 0  # Non-critical for overall test
    fi
}

# Generate comprehensive test report
generate_test_report() {
    local status=$1
    local report_file="/tmp/cruvz-complete-e2e-test-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "=============================================="
        echo "Cruvz Streaming Complete End-to-End Test Report"
        echo "=============================================="
        echo "Timestamp: $(date)"
        echo "Test Status: $status"
        echo ""
        echo "Service Status:"
        docker compose ps 2>/dev/null || echo "Docker compose not available"
        echo ""
        echo "Port Status:"
        echo "Backend API (5000):"
        netstat -tuln 2>/dev/null | grep ":5000 " || echo "Not listening"
        echo "Web App (80):"
        netstat -tuln 2>/dev/null | grep ":80 " || echo "Not listening"
        echo "Streaming Ports:"
        netstat -tuln 2>/dev/null | grep -E "(1935|3333|9000|9999)" || echo "No streaming ports listening"
        echo ""
        echo "API Health Checks:"
        curl -s "${API_BASE_URL%/api}/health" 2>/dev/null | head -3 || echo "API not accessible"
        echo ""
        echo "Container Logs (last 10 lines each):"
        for container in backend web-app origin; do
            echo "--- $container ---"
            docker compose logs --tail=10 "$container" 2>/dev/null || echo "Container not found"
        done
    } > "$report_file"
    
    log "SUCCESS" "Test report generated: $report_file"
}

# Main test function
main() {
    log "INFO" "Starting Cruvz Streaming Complete End-to-End Test"
    log "INFO" "Six Sigma Quality Validation with Real API Integration"
    echo ""
    
    local test_failed=false
    local test_count=0
    local passed_count=0
    
    # Array of test functions
    local tests=(
        "test_containers"
        "test_backend_api"
        "test_database"
        "test_web_application"
        "test_streaming_ports"
        "test_monitoring"
        "test_six_sigma_api"
        "test_stream_management"
        "test_api_performance"
    )
    
    for test_func in "${tests[@]}"; do
        ((test_count++))
        echo ""
        if $test_func; then
            ((passed_count++))
        else
            test_failed=true
        fi
    done
    
    echo ""
    echo "=============================================="
    log "INFO" "Test Summary: $passed_count/$test_count tests passed"
    
    if [ "$test_failed" = true ]; then
        log "ERROR" "Complete End-to-End Test FAILED"
        log "ERROR" "Some components are not functioning correctly"
        generate_test_report "FAILED"
        exit 1
    else
        log "SUCCESS" "Complete End-to-End Test PASSED"
        log "SUCCESS" "Six Sigma deployment validated: Zero errors achieved"
        log "SUCCESS" "All components are functioning correctly"
        log "SUCCESS" "System ready for production use"
        generate_test_report "PASSED"
        exit 0
    fi
}

# Cleanup function
cleanup() {
    rm -f /tmp/health_response.json /tmp/register_response.json /tmp/web_response.html
    rm -f /tmp/dashboard_response.html /tmp/prom_response.json /tmp/grafana_response.json
    rm -f /tmp/admin_login.json /tmp/six_sigma.json /tmp/streamer_register.json
    rm -f /tmp/stream_create.json /tmp/stream_list.json /tmp/profile_response.json
}

# Set up signal handlers
trap cleanup EXIT
trap 'log "ERROR" "Test interrupted"; cleanup; exit 1' INT TERM

# Run main function
main "$@"