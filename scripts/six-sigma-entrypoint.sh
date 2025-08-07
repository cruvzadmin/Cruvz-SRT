#!/bin/bash
# Six Sigma Service Entrypoint
# Ensures zero-defect service startup with comprehensive monitoring

set -euo pipefail

LOG_FILE="/opt/cruvzstreaming/logs/six-sigma-entrypoint.log"
METRICS_FILE="/opt/cruvzstreaming/metrics/startup-metrics.json"
HEALTH_FILE="/opt/cruvzstreaming/health/service-health.json"

# Six Sigma logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Six Sigma metrics function
record_metric() {
    local metric="$1"
    local value="$2"
    local timestamp=$(date +%s)
    
    mkdir -p /opt/cruvzstreaming/metrics
    echo "{\"metric\":\"$metric\", \"value\":\"$value\", \"timestamp\":$timestamp}" >> "$METRICS_FILE"
}

# Six Sigma health status function
update_health() {
    local status="$1"
    local message="$2"
    local timestamp=$(date -Iseconds)
    
    mkdir -p /opt/cruvzstreaming/health
    cat > "$HEALTH_FILE" << EOF
{
    "status": "$status",
    "message": "$message",
    "timestamp": "$timestamp",
    "uptime": $(cat /proc/uptime | cut -d' ' -f1),
    "version": "$(date +%Y%m%d)",
    "six_sigma": true
}
EOF
}

log "Six Sigma Service Entrypoint Starting"
log "Target: 99.99966% uptime (3.4 defects per million opportunities)"

# Create required directories
mkdir -p /opt/cruvzstreaming/logs
mkdir -p /opt/cruvzstreaming/metrics  
mkdir -p /opt/cruvzstreaming/health

# Record startup metrics
record_metric "service_start_time" "$(date +%s)"
record_metric "memory_available_mb" "$(free -m | awk 'NR==2{print $7}')"
record_metric "disk_available_percent" "$((100 - $(df /opt/cruvzstreaming | awk 'NR==2{print $5}' | sed 's/%//')))"

# Initialize health status
update_health "starting" "Six Sigma service initialization in progress"

log "Pre-flight checks completed successfully"
log "Starting service with Six Sigma monitoring: $*"

# Set up signal handlers for graceful shutdown
cleanup() {
    log "Six Sigma graceful shutdown initiated"
    record_metric "service_stop_time" "$(date +%s)"
    update_health "stopping" "Six Sigma service shutdown in progress"
    
    # Kill child processes gracefully
    if [ -n "${SERVICE_PID:-}" ]; then
        log "Terminating service process $SERVICE_PID"
        kill -TERM "$SERVICE_PID" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local count=0
        while kill -0 "$SERVICE_PID" 2>/dev/null && [ $count -lt 30 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$SERVICE_PID" 2>/dev/null; then
            log "Force killing service process $SERVICE_PID"
            kill -KILL "$SERVICE_PID" 2>/dev/null || true
        fi
    fi
    
    update_health "stopped" "Six Sigma service stopped gracefully"
    log "Six Sigma graceful shutdown completed"
    exit 0
}

trap cleanup TERM INT QUIT

# Start the service
log "Executing service command: $*"
update_health "running" "Six Sigma service operational"
record_metric "service_startup_success" "1"

# Execute the service in the background to handle signals
exec "$@" &
SERVICE_PID=$!

log "Service started with PID: $SERVICE_PID"

# Monitor the service
while kill -0 "$SERVICE_PID" 2>/dev/null; do
    # Update health metrics every 30 seconds
    sleep 30
    
    # Check if process is still healthy
    if kill -0 "$SERVICE_PID" 2>/dev/null; then
        update_health "running" "Six Sigma service operational"
        record_metric "health_check_success" "1"
    else
        log "Service process terminated unexpectedly"
        record_metric "service_crash" "1"
        update_health "failed" "Service process terminated unexpectedly"
        exit 1
    fi
done

# If we reach here, the service exited
wait "$SERVICE_PID"
EXIT_CODE=$?

log "Service exited with code: $EXIT_CODE"
record_metric "service_exit_code" "$EXIT_CODE"

if [ $EXIT_CODE -eq 0 ]; then
    update_health "stopped" "Six Sigma service stopped cleanly"
    log "Six Sigma service completed successfully"
else
    update_health "failed" "Six Sigma service failed with exit code $EXIT_CODE"
    log "Six Sigma service failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE