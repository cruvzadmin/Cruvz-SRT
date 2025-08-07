#!/bin/bash
# Six Sigma Configuration Validation Script
# Ensures zero-defect configuration before service startup

set -euo pipefail

CONFIG_DIR="${1:-origin_conf}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/opt/cruvzstreaming/logs/config-validation.log"

# Six Sigma logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Six Sigma validation function
validate() {
    local check="$1"
    local command="$2"
    
    log "Six Sigma Check: $check"
    if eval "$command"; then
        log "✓ PASS: $check"
        return 0
    else
        log "✗ FAIL: $check"
        return 1
    fi
}

log "Starting Six Sigma configuration validation for $CONFIG_DIR"

# Create logs directory if it doesn't exist
mkdir -p /opt/cruvzstreaming/logs

# Validation checks
VALIDATION_FAILED=0

# Check 1: Configuration files exist
validate "Configuration directory exists" "[ -d '/opt/cruvzstreaming/bin/$CONFIG_DIR' ]" || VALIDATION_FAILED=1

validate "Server.xml exists" "[ -f '/opt/cruvzstreaming/bin/$CONFIG_DIR/Server.xml' ]" || VALIDATION_FAILED=1

validate "Logger.xml exists" "[ -f '/opt/cruvzstreaming/bin/$CONFIG_DIR/Logger.xml' ]" || VALIDATION_FAILED=1

# Check 2: XML syntax validation
if command -v xmllint >/dev/null 2>&1; then
    validate "Server.xml syntax" "xmllint --noout '/opt/cruvzstreaming/bin/$CONFIG_DIR/Server.xml'" || VALIDATION_FAILED=1
    validate "Logger.xml syntax" "xmllint --noout '/opt/cruvzstreaming/bin/$CONFIG_DIR/Logger.xml'" || VALIDATION_FAILED=1
else
    log "WARNING: xmllint not available, skipping XML syntax validation"
fi

# Check 3: Port availability (for new deployments)
validate "Port 8080 availability" "! netstat -tuln 2>/dev/null | grep -q ':8080 '" || log "INFO: Port 8080 already in use (expected during restart)"

# Check 4: Required directories exist
validate "Logs directory" "[ -d '/opt/cruvzstreaming/logs' ]" || VALIDATION_FAILED=1
validate "Binary exists" "[ -f '/opt/cruvzstreaming/bin/CruvzStreaming' ]" || VALIDATION_FAILED=1
validate "Binary is executable" "[ -x '/opt/cruvzstreaming/bin/CruvzStreaming' ]" || VALIDATION_FAILED=1

# Check 5: Memory and disk space
validate "Sufficient memory available" "[ $(free -m | awk 'NR==2{printf \"%.0f\", $7*100/$2}') -gt 10 ]" || VALIDATION_FAILED=1
validate "Sufficient disk space" "[ $(df /opt/cruvzstreaming | awk 'NR==2{print $5}' | sed 's/%//') -lt 90 ]" || VALIDATION_FAILED=1

# Check 6: Network connectivity (if edge)
if [[ "$CONFIG_DIR" == "edge_conf" ]]; then
    if [[ -n "${DEFAULT_ORIGIN_SERVER:-}" && -n "${DEFAULT_ORIGIN_PORT:-}" ]]; then
        validate "Origin server connectivity" "timeout 10 nc -z ${DEFAULT_ORIGIN_SERVER} ${DEFAULT_ORIGIN_PORT}" || VALIDATION_FAILED=1
    fi
fi

# Six Sigma Quality Gate
if [ $VALIDATION_FAILED -eq 0 ]; then
    log "✓ Six Sigma validation PASSED - Zero defects detected"
    log "Configuration meets quality standards for zero-error deployment"
    exit 0
else
    log "✗ Six Sigma validation FAILED - Defects detected"
    log "Configuration does not meet quality standards - deployment blocked"
    exit 1
fi