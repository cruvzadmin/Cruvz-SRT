#!/bin/bash

# Cruvz Streaming Health Check Script
# Six Sigma compliant health monitoring

set -euo pipefail

# Configuration
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:8080/health}"
TIMEOUT="${TIMEOUT:-10}"
MAX_RETRIES="${MAX_RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-5}"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Health check function
check_health() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log "Health check attempt $attempt/$MAX_RETRIES"
        
        if curl -f -s --max-time $TIMEOUT "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
            log "Health check passed"
            return 0
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log "Health check failed, retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        else
            log "Health check failed after $MAX_RETRIES attempts"
            return 1
        fi
        
        ((attempt++))
    done
}

# Process monitoring
check_process() {
    if pgrep -f "CruvzStreaming" > /dev/null; then
        log "CruvzStreaming process is running"
        return 0
    else
        log "CruvzStreaming process is not running"
        return 1
    fi
}

# Port monitoring
check_ports() {
    local ports=("1935" "3333" "9999")
    local failed=0
    
    for port in "${ports[@]}"; do
        if ss -tuln | grep ":$port " > /dev/null; then
            log "Port $port is listening"
        else
            log "Port $port is not listening"
            ((failed++))
        fi
    done
    
    if [ $failed -eq 0 ]; then
        log "All required ports are listening"
        return 0
    else
        log "$failed port(s) are not listening"
        return 1
    fi
}

# Memory usage check (simplified for compatibility)
check_memory() {
    local mem_usage=$(ps aux | grep CruvzStreaming | grep -v grep | awk '{print $4}' | head -1)
    local mem_threshold=${MEM_THRESHOLD:-80}
    
    if [ -n "$mem_usage" ]; then
        log "Memory usage: ${mem_usage}%"
        # Simple comparison for shell compatibility
        if [ "${mem_usage%.*}" -gt "${mem_threshold}" ] 2>/dev/null; then
            log "WARNING: Memory usage above threshold (${mem_threshold}%)"
            return 1
        fi
    else
        log "Could not determine memory usage"
        return 1
    fi
    
    return 0
}

# CPU usage check (simplified for compatibility)
check_cpu() {
    local cpu_usage=$(ps aux | grep CruvzStreaming | grep -v grep | awk '{print $3}' | head -1)
    local cpu_threshold=${CPU_THRESHOLD:-80}
    
    if [ -n "$cpu_usage" ]; then
        log "CPU usage: ${cpu_usage}%"
        # Simple comparison for shell compatibility
        if [ "${cpu_usage%.*}" -gt "${cpu_threshold}" ] 2>/dev/null; then
            log "WARNING: CPU usage above threshold (${cpu_threshold}%)"
            return 1
        fi
    else
        log "Could not determine CPU usage"
        return 1
    fi
    
    return 0
}

# Main health check
main() {
    local exit_code=0
    
    log "Starting Cruvz Streaming health check"
    
    # Check HTTP health endpoint
    if ! check_health; then
        exit_code=1
    fi
    
    # Check process
    if ! check_process; then
        exit_code=1
    fi
    
    # Check ports
    if ! check_ports; then
        exit_code=1
    fi
    
    # Check memory usage
    if ! check_memory; then
        log "Memory check failed, but continuing..."
    fi
    
    # Check CPU usage  
    if ! check_cpu; then
        log "CPU check failed, but continuing..."
    fi
    
    if [ $exit_code -eq 0 ]; then
        log "All health checks passed"
    else
        log "One or more health checks failed"
    fi
    
    exit $exit_code
}

# Run main function
main "$@"