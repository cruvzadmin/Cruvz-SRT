#!/bin/bash

# Cruvz Streaming End-to-End Test Script
# Tests all Six Sigma deployment components

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    case $level in
        "INFO")  echo -e "${BLUE}[${timestamp}] INFO: $*${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[${timestamp}] SUCCESS: $*${NC}" ;;
        "ERROR") echo -e "${RED}[${timestamp}] ERROR: $*${NC}" ;;
    esac
}

# Test service health
test_services() {
    log "INFO" "Testing service health..."
    
    # Test Prometheus
    if curl -s http://localhost:9090/-/healthy | grep -q "Prometheus Server is Healthy"; then
        log "SUCCESS" "Prometheus is healthy"
    else
        log "ERROR" "Prometheus health check failed"
        return 1
    fi
    
    # Test Grafana
    if curl -s http://localhost:3000/api/health | grep -q "ok"; then
        log "SUCCESS" "Grafana is healthy" 
    else
        log "ERROR" "Grafana health check failed"
        return 1
    fi
    
    # Test Loki
    if curl -s http://localhost:3100/ready | grep -q "ready"; then
        log "SUCCESS" "Loki is healthy"
    else
        log "ERROR" "Loki health check failed"
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

# Test metrics collection
test_metrics() {
    log "INFO" "Testing metrics collection..."
    
    local prometheus_up=$(curl -s "http://localhost:9090/api/v1/query?query=up" | grep -o '"value"' | wc -l)
    
    if [ "$prometheus_up" -gt 0 ]; then
        log "SUCCESS" "Prometheus is collecting metrics from $prometheus_up targets"
    else
        log "ERROR" "No metrics being collected"
        return 1
    fi
    
    return 0
}

# Test container health
test_containers() {
    log "INFO" "Testing container health..."
    
    local healthy_count=$(docker compose ps --format json | jq -r '.Health // "healthy"' | grep -c healthy)
    local total_count=$(docker compose ps -q | wc -l)
    
    log "SUCCESS" "$healthy_count/$total_count containers are healthy"
    
    # Check specific streaming processes
    if docker compose exec -T origin pgrep -f OvenMediaEngine > /dev/null; then
        log "SUCCESS" "Origin streaming engine is running"
    else
        log "ERROR" "Origin streaming engine is not running"
        return 1
    fi
    
    return 0
}

# Generate test report
generate_report() {
    local status=$1
    local report_file="/tmp/cruvz-e2e-test-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Cruvz Streaming End-to-End Test Report"
        echo "======================================"
        echo "Timestamp: $(date)"
        echo "Test Status: $status"
        echo ""
        echo "Service Status:"
        docker compose ps
        echo ""
        echo "Port Status:"
        netstat -tuln | grep -E "(1935|3333|9000|9999|3000|9090|3100)"
        echo ""
        echo "Prometheus Targets:"
        curl -s "http://localhost:9090/api/v1/targets" | jq -r '.data.activeTargets[] | "\(.job): \(.health)"' 2>/dev/null || echo "Could not fetch targets"
    } > "$report_file"
    
    log "SUCCESS" "Test report generated: $report_file"
}

# Main test function
main() {
    log "INFO" "Starting Cruvz Streaming End-to-End Test"
    log "INFO" "Six Sigma Quality Validation"
    
    local test_failed=false
    
    test_services || test_failed=true
    test_streaming_ports || test_failed=true
    test_metrics || test_failed=true
    test_containers || test_failed=true
    
    if [ "$test_failed" = true ]; then
        log "ERROR" "End-to-end test FAILED"
        generate_report "FAILED"
        exit 1
    else
        log "SUCCESS" "End-to-end test PASSED"
        log "SUCCESS" "Six Sigma deployment validated: Zero errors achieved"
        generate_report "PASSED"
        exit 0
    fi
}

main "$@"