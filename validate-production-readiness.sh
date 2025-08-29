#!/bin/bash

# ===============================================================================
# CRUVZ-SRT PRODUCTION READINESS ASSESSMENT
# Comprehensive validation of production deployment configuration
# ===============================================================================

set -uo pipefail  # Removed -e to allow check failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="cruvz-srt"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Logging function
log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] $level: $*"

    case $level in
        "INFO")     echo -e "${BLUE}ℹ️  $message${NC}" ;;
        "SUCCESS")  echo -e "${GREEN}✅ $message${NC}" && ((PASSED_CHECKS++)) ;;
        "WARNING")  echo -e "${YELLOW}⚠️  $message${NC}" && ((WARNING_CHECKS++)) ;;
        "ERROR")    echo -e "${RED}❌ $message${NC}" && ((FAILED_CHECKS++)) ;;
        "HEADER")   echo -e "${PURPLE}🚀 $message${NC}" && return ;;
    esac
    ((TOTAL_CHECKS++))
}

# Check function wrapper
check() {
    local description=$1
    local command=$2
    
    if eval "$command" >/dev/null 2>&1; then
        log "SUCCESS" "$description"
    else
        log "ERROR" "$description"
    fi
}

# Warning check function
warn_check() {
    local description=$1
    local command=$2
    
    if eval "$command" &>/dev/null; then
        log "SUCCESS" "$description"
    else
        log "WARNING" "$description"
    fi
}

# Header
log "HEADER" "🔍 CRUVZ-SRT PRODUCTION READINESS ASSESSMENT"
log "HEADER" "============================================================================"

# 1. Security Configuration Checks
log "INFO" "🔒 Checking Security Configuration..."

# Check for security contexts in deployments
check "Security contexts configured in backend deployment" \
    "grep -q 'securityContext:' k8s/backend.yaml"

check "Security contexts configured in frontend deployment" \
    "grep -q 'securityContext:' k8s/frontend.yaml"

check "Security contexts configured in PostgreSQL deployment" \
    "grep -q 'securityContext:' k8s/postgres.yaml"

check "Security contexts configured in Redis deployment" \
    "grep -q 'securityContext:' k8s/redis.yaml"

check "RBAC configuration exists" \
    "test -f k8s/rbac.yaml"

check "Network policies configured" \
    "test -f k8s/network-policy.yaml"

check "Non-root user specified in containers" \
    "grep -q 'runAsNonRoot: true' k8s/backend.yaml k8s/frontend.yaml k8s/postgres.yaml k8s/redis.yaml"

check "Capabilities dropped in containers" \
    "grep -q 'drop:' k8s/backend.yaml k8s/frontend.yaml k8s/postgres.yaml k8s/redis.yaml"

# 2. Resource Management Checks
log "INFO" "💾 Checking Resource Management..."

check "Resource limits defined for backend" \
    "grep -A10 'resources:' k8s/backend.yaml | grep -q 'limits:'"

check "Resource limits defined for frontend" \
    "grep -A10 'resources:' k8s/frontend.yaml | grep -q 'limits:'"

check "Resource limits defined for PostgreSQL" \
    "grep -A10 'resources:' k8s/postgres.yaml | grep -q 'limits:'"

check "Resource limits defined for Redis" \
    "grep -A10 'resources:' k8s/redis.yaml | grep -q 'limits:'"

check "Memory requests properly configured" \
    "grep -q 'memory:' k8s/backend.yaml k8s/frontend.yaml k8s/postgres.yaml k8s/redis.yaml"

check "CPU requests properly configured" \
    "grep -q 'cpu:' k8s/backend.yaml k8s/frontend.yaml k8s/postgres.yaml k8s/redis.yaml"

# 3. Storage and Persistence Checks
log "INFO" "💽 Checking Storage and Persistence..."

check "Persistent volumes configured" \
    "grep -q 'PersistentVolume' k8s/storage.yaml"

check "Persistent volume claims configured" \
    "find k8s/ -name '*.yaml' -exec grep -l 'PersistentVolumeClaim' {} \; | wc -l | grep -q '[1-9]'"

check "Storage class defined" \
    "grep -q 'StorageClass' k8s/storage.yaml"

check "PostgreSQL data persistence configured" \
    "grep -q 'postgres-storage' k8s/postgres.yaml"

check "Redis data persistence configured" \
    "grep -q 'redis-storage' k8s/redis.yaml"

check "Production storage not using hostPath" \
    "! grep -q 'hostPath:' k8s/storage.yaml"

check "Local storage with node affinity configured" \
    "grep -q 'nodeAffinity:' k8s/storage.yaml"

# 4. Health Checks and Monitoring
log "INFO" "🏥 Checking Health Checks and Monitoring..."

check "Liveness probes configured for backend" \
    "grep -q 'livenessProbe:' k8s/backend.yaml"

check "Readiness probes configured for backend" \
    "grep -q 'readinessProbe:' k8s/backend.yaml"

check "Health checks configured for PostgreSQL" \
    "grep -q 'livenessProbe:' k8s/postgres.yaml"

check "Health checks configured for Redis" \
    "grep -q 'livenessProbe:' k8s/redis.yaml"

check "Health checks configured for frontend" \
    "grep -q 'livenessProbe:' k8s/frontend.yaml"

check "Monitoring stack configured" \
    "test -f k8s/monitoring.yaml"

check "Grafana dashboards configured" \
    "test -f k8s/grafana.yaml"

check "Prometheus configuration exists" \
    "grep -q 'prometheus' k8s/monitoring.yaml"

# 5. Database Configuration Checks
log "INFO" "🗄️ Checking Database Configuration..."

check "PostgreSQL production configuration optimized" \
    "grep -q 'max_connections=200' k8s/postgres.yaml"

check "PostgreSQL memory settings configured" \
    "grep -q 'shared_buffers=256MB' k8s/postgres.yaml"

check "PostgreSQL authentication improved" \
    "grep -q 'scram-sha-256' k8s/postgres.yaml"

check "Database migration scripts exist" \
    "test -f backend/run-migrations.js"

check "Database backup strategy configured" \
    "test -f k8s/backup.yaml"

check "Backup cron job configured" \
    "grep -q 'CronJob' k8s/backup.yaml"

# 6. Backend Configuration Checks
log "INFO" "⚙️ Checking Backend Configuration..."

check "Production database connection pool optimized" \
    "grep -q 'acquireTimeoutMillis: 60000' backend/knexfile.js"

check "Redis connection resilience improved" \
    "grep -q 'retryStrategy' backend/utils/cache.js"

check "Environment variables properly configured" \
    "grep -q 'configMapRef:' k8s/backend.yaml"

check "Secrets properly referenced" \
    "grep -q 'secretRef:' k8s/backend.yaml"

check "Init containers for dependency waiting" \
    "grep -q 'initContainers:' k8s/backend.yaml"

# 7. Network and Service Configuration
log "INFO" "🌐 Checking Network and Service Configuration..."

check "Services properly configured" \
    "grep -q 'Service' k8s/backend.yaml k8s/frontend.yaml k8s/postgres.yaml k8s/redis.yaml"

check "Cluster IP services configured" \
    "grep -q 'ClusterIP' k8s/backend.yaml k8s/postgres.yaml k8s/redis.yaml"

check "Network policies restrict traffic" \
    "grep -q 'NetworkPolicy' k8s/network-policy.yaml"

check "Ingress and egress rules defined" \
    "grep -q 'policyTypes:' k8s/network-policy.yaml"

# 8. Secrets and Configuration Management
log "INFO" "🔐 Checking Secrets and Configuration Management..."

check "Database passwords properly secured" \
    "grep -q 'POSTGRES_PASSWORD' k8s/secrets.yaml"

check "JWT secrets configured" \
    "grep -q 'JWT_SECRET' k8s/secrets.yaml"

check "OvenMediaEngine access tokens secured" \
    "grep -q 'OME_ACCESS_TOKEN' k8s/secrets.yaml"

check "Secrets are base64 encoded" \
    "grep -E '^  [A-Z_]+: [A-Za-z0-9+/=]+' k8s/secrets.yaml"

# 9. Backup and Recovery Checks
log "INFO" "💾 Checking Backup and Recovery..."

check "Automated backup jobs configured" \
    "grep -q 'postgres-backup' k8s/backup.yaml"

check "Manual backup job available" \
    "grep -q 'postgres-manual-backup' k8s/backup.yaml"

check "Backup retention policy configured" \
    "grep -q 'mtime +7' k8s/backup.yaml"

check "Backup storage configured" \
    "grep -q 'postgres-backup-pvc' k8s/backup.yaml"

# 10. OvenMediaEngine Configuration
log "INFO" "📺 Checking OvenMediaEngine Configuration..."

check "OvenMediaEngine deployment configured" \
    "test -f k8s/ovenmediaengine.yaml"

check "Streaming ports properly configured" \
    "grep -q '1935' k8s/ovenmediaengine.yaml"  # RTMP

check "SRT ports configured" \
    "grep -q '9999' k8s/ovenmediaengine.yaml"

check "WebRTC ports configured" \
    "grep -q '3333' k8s/ovenmediaengine.yaml"

check "HLS/LLHLS ports configured" \
    "grep -q '8088' k8s/ovenmediaengine.yaml"

# Summary
echo ""
log "HEADER" "============================================================================"
log "HEADER" "📊 PRODUCTION READINESS ASSESSMENT SUMMARY"
log "HEADER" "============================================================================"
echo ""

echo -e "${GREEN}✅ Passed Checks: $PASSED_CHECKS${NC}"
echo -e "${YELLOW}⚠️  Warning Checks: $WARNING_CHECKS${NC}"
echo -e "${RED}❌ Failed Checks: $FAILED_CHECKS${NC}"
echo -e "${BLUE}📊 Total Checks: $TOTAL_CHECKS${NC}"

# Calculate success rate
SUCCESS_RATE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
echo -e "${PURPLE}📈 Success Rate: $SUCCESS_RATE%${NC}"

echo ""

# Production readiness verdict
if [[ $FAILED_CHECKS -eq 0 && $WARNING_CHECKS -le 2 ]]; then
    log "HEADER" "🎉 PRODUCTION READY! All critical checks passed."
    echo ""
    echo -e "${GREEN}✅ This deployment is ready for production use.${NC}"
    echo -e "${GREEN}✅ All security, performance, and reliability requirements are met.${NC}"
    exit 0
elif [[ $FAILED_CHECKS -le 2 && $SUCCESS_RATE -ge 90 ]]; then
    log "HEADER" "⚠️  MOSTLY READY - Minor issues need attention"
    echo ""
    echo -e "${YELLOW}⚠️  This deployment is mostly ready but has minor issues.${NC}"
    echo -e "${YELLOW}⚠️  Address the failed checks before production deployment.${NC}"
    exit 1
else
    log "HEADER" "❌ NOT READY - Critical issues must be resolved"
    echo ""
    echo -e "${RED}❌ This deployment is NOT ready for production.${NC}"
    echo -e "${RED}❌ Multiple critical issues must be resolved.${NC}"
    exit 2
fi