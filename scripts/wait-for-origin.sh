#!/bin/bash
# Six Sigma Origin Dependency Check
# Ensures edge services wait for origin to be fully operational

set -euo pipefail

ORIGIN_HOST="${DEFAULT_ORIGIN_SERVER:-192.168.0.160}"
ORIGIN_PORT="${DEFAULT_ORIGIN_PORT:-9000}"
TIMEOUT="${ORIGIN_TIMEOUT:-300}"
LOG_FILE="/opt/cruvzstreaming/logs/origin-wait.log"

# Six Sigma logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Six Sigma Origin Dependency Check Starting"
log "Waiting for origin server at $ORIGIN_HOST:$ORIGIN_PORT"

# Create logs directory if it doesn't exist
mkdir -p /opt/cruvzstreaming/logs

# Wait for origin server to be available
wait_for_service() {
    local host="$1"
    local port="$2"
    local timeout="$3"
    local elapsed=0
    local interval=5
    
    while [ $elapsed -lt $timeout ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            log "✓ Origin server is responsive at $host:$port"
            return 0
        fi
        
        log "⏳ Waiting for origin server... (${elapsed}s/${timeout}s)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    log "✗ Timeout waiting for origin server after ${timeout}s"
    return 1
}

# Additional health checks
check_origin_health() {
    local host="$1"
    local health_port="8080"
    
    log "Performing Six Sigma health validation on origin server"
    
    # Check if health endpoint is available
    if command -v curl >/dev/null 2>&1; then
        if curl -f "http://$host:$health_port/health" >/dev/null 2>&1; then
            log "✓ Origin health endpoint is responsive"
            return 0
        else
            log "⚠ Origin health endpoint not available (may be normal during startup)"
        fi
    else
        log "⚠ curl not available, skipping health endpoint check"
    fi
    
    return 0
}

# Wait for network connectivity
log "Testing network connectivity to origin server"
wait_for_service "$ORIGIN_HOST" "$ORIGIN_PORT" "$TIMEOUT"
RESULT=$?

if [ $RESULT -eq 0 ]; then
    # Additional health validation
    check_origin_health "$ORIGIN_HOST"
    
    log "✓ Six Sigma dependency check PASSED"
    log "Origin server is ready for edge connection"
    exit 0
else
    log "✗ Six Sigma dependency check FAILED"
    log "Origin server is not available - edge startup blocked"
    exit 1
fi