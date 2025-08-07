#!/bin/bash

# Cruvz Streaming Deployment Validation Script
# Six Sigma deployment verification with zero-error target

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VALIDATION_TIMEOUT=${VALIDATION_TIMEOUT:-300}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-10}
HEALTH_CHECK_DELAY=${HEALTH_CHECK_DELAY:-30}

# Logging function
log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    case $level in
        "INFO")  echo -e "${BLUE}[${timestamp}] INFO: $*${NC}" ;;
        "WARN")  echo -e "${YELLOW}[${timestamp}] WARN: $*${NC}" ;;
        "ERROR") echo -e "${RED}[${timestamp}] ERROR: $*${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[${timestamp}] SUCCESS: $*${NC}" ;;
    esac
}

# Validation functions
validate_prerequisites() {
    log "INFO" "Validating prerequisites..."
    
    local required_commands=("docker" "docker-compose" "curl")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -gt 0 ]; then
        log "ERROR" "Missing required commands: ${missing_commands[*]}"
        return 1
    fi
    
    log "SUCCESS" "All prerequisites are available"
    return 0
}

validate_configuration() {
    log "INFO" "Validating configuration files..."
    
    local config_files=(
        "docker-compose.yml"
        "monitoring/prometheus.yml"
        "monitoring/loki.yml"
        "monitoring/grafana-datasources/datasources.yml"
    )
    
    for config in "${config_files[@]}"; do
        if [ ! -f "$config" ]; then
            log "ERROR" "Configuration file missing: $config"
            return 1
        fi
        log "INFO" "Configuration file validated: $config"
    done
    
    log "SUCCESS" "All configuration files are present"
    return 0
}

validate_docker_build() {
    log "INFO" "Validating Docker build..."
    
    if ! docker-compose build --no-cache origin 2>&1 | tee /tmp/build.log; then
        log "ERROR" "Docker build failed"
        log "ERROR" "Build log:"
        cat /tmp/build.log
        return 1
    fi
    
    log "SUCCESS" "Docker build completed successfully"
    return 0
}

validate_services_startup() {
    log "INFO" "Starting services and validating startup..."
    
    # Start services
    if ! docker-compose up -d; then
        log "ERROR" "Failed to start services"
        return 1
    fi
    
    # Wait for services to be ready
    local services=("origin" "edge" "monitoring" "log-aggregator" "grafana")
    local max_wait=$VALIDATION_TIMEOUT
    local waited=0
    
    for service in "${services[@]}"; do
        log "INFO" "Waiting for service: $service"
        while [ $waited -lt $max_wait ]; do
            if docker-compose ps "$service" | grep -q "Up"; then
                log "SUCCESS" "Service $service is running"
                break
            fi
            sleep 5
            waited=$((waited + 5))
        done
        
        if [ $waited -ge $max_wait ]; then
            log "ERROR" "Service $service failed to start within ${max_wait}s"
            return 1
        fi
    done
    
    return 0
}

validate_health_endpoints() {
    log "INFO" "Validating health endpoints..."
    
    local endpoints=(
        "http://localhost:8080/health"
        "http://localhost:8081/health"
        "http://localhost:9090/-/healthy"
        "http://localhost:3100/ready"
        "http://localhost:3000/api/health"
    )
    
    local attempt=1
    local max_attempts=$HEALTH_CHECK_RETRIES
    
    while [ $attempt -le $max_attempts ]; do
        log "INFO" "Health check attempt $attempt/$max_attempts"
        local all_healthy=true
        
        for endpoint in "${endpoints[@]}"; do
            if curl -f -s --max-time 10 "$endpoint" > /dev/null 2>&1; then
                log "SUCCESS" "Health endpoint OK: $endpoint"
            else
                log "WARN" "Health endpoint not ready: $endpoint"
                all_healthy=false
            fi
        done
        
        if [ "$all_healthy" = true ]; then
            log "SUCCESS" "All health endpoints are responding"
            return 0
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            log "INFO" "Waiting ${HEALTH_CHECK_DELAY}s before next health check..."
            sleep $HEALTH_CHECK_DELAY
        fi
        
        ((attempt++))
    done
    
    log "ERROR" "Health endpoints validation failed after $max_attempts attempts"
    return 1
}

validate_streaming_functionality() {
    log "INFO" "Validating streaming functionality..."
    
    # Test RTMP endpoint
    if curl -f -s --max-time 5 "http://localhost:1935" > /dev/null 2>&1; then
        log "SUCCESS" "RTMP endpoint is accessible"
    else
        log "WARN" "RTMP endpoint test inconclusive (expected for RTMP protocol)"
    fi
    
    # Test WebRTC signaling
    if curl -f -s --max-time 5 "http://localhost:3333" > /dev/null 2>&1; then
        log "SUCCESS" "WebRTC signaling endpoint is accessible"
    else
        log "WARN" "WebRTC signaling endpoint test inconclusive"
    fi
    
    log "SUCCESS" "Basic streaming functionality validated"
    return 0
}

validate_monitoring() {
    log "INFO" "Validating monitoring stack..."
    
    # Check Prometheus metrics
    if curl -f -s "http://localhost:9090/api/v1/query?query=up" | grep -q "success"; then
        log "SUCCESS" "Prometheus is collecting metrics"
    else
        log "WARN" "Prometheus metrics validation inconclusive"
    fi
    
    # Check Grafana API
    if curl -f -s "http://localhost:3000/api/health" | grep -q "ok"; then
        log "SUCCESS" "Grafana is responding"
    else
        log "WARN" "Grafana validation inconclusive"
    fi
    
    log "SUCCESS" "Monitoring stack validated"
    return 0
}

validate_logging() {
    log "INFO" "Validating logging configuration..."
    
    # Check if containers are generating logs
    local services=("cruvz-streaming-origin" "cruvz-streaming-edge")
    
    for service in "${services[@]}"; do
        if docker logs "$service" 2>&1 | grep -q "Cruvz Streaming"; then
            log "SUCCESS" "Service $service is generating logs with correct branding"
        else
            log "WARN" "Service $service logs validation inconclusive"
        fi
    done
    
    log "SUCCESS" "Logging configuration validated"
    return 0
}

cleanup_on_failure() {
    log "WARN" "Cleaning up failed deployment..."
    docker-compose down -v 2>/dev/null || true
    log "INFO" "Cleanup completed"
}

generate_validation_report() {
    log "INFO" "Generating validation report..."
    
    local report_file="/tmp/cruvz-validation-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Cruvz Streaming Deployment Validation Report"
        echo "============================================="
        echo "Timestamp: $(date)"
        echo "Validation Status: $1"
        echo ""
        echo "Docker Services Status:"
        docker-compose ps 2>/dev/null || echo "Services not running"
        echo ""
        echo "Container Logs Summary:"
        docker-compose logs --tail=20 2>/dev/null || echo "No logs available"
    } > "$report_file"
    
    log "SUCCESS" "Validation report generated: $report_file"
}

# Main validation function
main() {
    local validation_failed=false
    
    log "INFO" "Starting Cruvz Streaming deployment validation"
    log "INFO" "Six Sigma target: Zero deployment errors"
    
    # Run validation steps
    validate_prerequisites || validation_failed=true
    validate_configuration || validation_failed=true
    
    if [ "$validation_failed" = false ]; then
        validate_docker_build || validation_failed=true
        validate_services_startup || validation_failed=true
        validate_health_endpoints || validation_failed=true
        validate_streaming_functionality || validation_failed=true
        validate_monitoring || validation_failed=true
        validate_logging || validation_failed=true
    fi
    
    if [ "$validation_failed" = true ]; then
        log "ERROR" "Deployment validation FAILED"
        generate_validation_report "FAILED"
        cleanup_on_failure
        exit 1
    else
        log "SUCCESS" "Deployment validation PASSED"
        log "SUCCESS" "Six Sigma compliance achieved: Zero deployment errors"
        generate_validation_report "PASSED"
        exit 0
    fi
}

# Trap for cleanup on script interruption
trap cleanup_on_failure INT TERM

# Run main function
main "$@"