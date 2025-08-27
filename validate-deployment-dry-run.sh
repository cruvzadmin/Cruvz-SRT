#!/bin/bash

# Cruvz-SRT Deployment Dry Run and Validation Script
# This script performs comprehensive validation without requiring a live Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERRORS=0
WARNINGS=0

# Function to log with colors
log() {
    case $1 in
        "ERROR")   echo -e "${RED}❌ [$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $2${NC}" ;;
        "SUCCESS") echo -e "${GREEN}✅ [$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $2${NC}" ;;
        "INFO")    echo -e "${BLUE}ℹ️  [$(date '+%Y-%m-%d %H:%M:%S')] INFO: $2${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  [$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $2${NC}" ;;
        "HEADER")  echo -e "${BLUE}🚀 [$(date '+%Y-%m-%d %H:%M:%S')] HEADER: $2${NC}" ;;
    esac
}

# Function to report errors
report_error() {
    log "ERROR" "$1"
    ((ERRORS++))
}

# Function to report warnings
report_warning() {
    log "WARNING" "$1"
    ((WARNINGS++))
}

echo ""
log "HEADER" "🎯 CRUVZ-SRT PRODUCTION DEPLOYMENT DRY RUN"
log "HEADER" "================================================"

# 1. Validate all YAML files
log "INFO" "Performing comprehensive YAML validation..."

# Test kubectl dry-run for all manifests
validate_manifests() {
    log "INFO" "Validating Kubernetes manifests with kubectl dry-run..."
    
    local manifests=(
        "k8s/namespace.yaml"
        "k8s/storage.yaml"
        "k8s/secrets.yaml"
        "k8s/configmap.yaml"
        "k8s/postgres.yaml"
        "k8s/redis.yaml"
        "k8s/backend.yaml"
        "k8s/ovenmediaengine.yaml"
        "k8s/frontend.yaml"
        "k8s/monitoring.yaml"
        "k8s/grafana.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            # Skip kubectl dry-run if no cluster available, just validate YAML syntax
            if kubectl cluster-info &>/dev/null; then
                if kubectl apply --dry-run=client -f "$manifest" > /dev/null 2>&1; then
                    log "SUCCESS" "$manifest passes kubectl validation"
                else
                    report_error "$manifest fails kubectl validation"
                    kubectl apply --dry-run=client -f "$manifest" 2>&1 | head -5
                fi
            else
                # Fallback to basic YAML validation
                if python3 -c "import yaml; yaml.safe_load_all(open('$manifest'))" 2>/dev/null; then
                    log "SUCCESS" "$manifest passes YAML syntax validation"
                else
                    report_error "$manifest has invalid YAML syntax"
                fi
            fi
        else
            report_error "$manifest file not found"
        fi
    done
}

# 2. Validate resource specifications
validate_resources() {
    log "INFO" "Validating resource specifications..."
    
    # Check Redis resources
    if grep -A20 "resources:" k8s/redis.yaml | grep -q "256Mi" && grep -A20 "resources:" k8s/redis.yaml | grep -q "0.5"; then
        log "SUCCESS" "Redis resource requests are properly configured"
    else
        report_warning "Redis resource configuration may need review"
    fi
    
    # Check PostgreSQL resources
    if grep -A20 "resources:" k8s/postgres.yaml | grep -q "1Gi" && grep -A20 "resources:" k8s/postgres.yaml | grep -q '"1"'; then
        log "SUCCESS" "PostgreSQL resource requests are properly configured"
    else
        report_warning "PostgreSQL resource configuration may need review"
    fi
    
    # Check Backend resources
    if grep -A20 "resources:" k8s/backend.yaml | grep -q "1Gi" && grep -A20 "resources:" k8s/backend.yaml | grep -q '"1"'; then
        log "SUCCESS" "Backend resource requests are properly configured"
    else
        report_warning "Backend resource configuration may need review"
    fi
    
    # Check OvenMediaEngine resources
    if grep -A20 "resources:" k8s/ovenmediaengine.yaml | grep -q "2Gi" && grep -A20 "resources:" k8s/ovenmediaengine.yaml | grep -q '"1"'; then
        log "SUCCESS" "OvenMediaEngine resource requests are properly configured"
    else
        report_warning "OvenMediaEngine resource configuration may need review"
    fi
}

# 3. Validate network configurations
validate_networking() {
    log "INFO" "Validating network configurations..."
    
    # Check service ports
    local expected_ports=(
        "6379:redis"
        "5432:postgres"
        "5000:backend"
        "8080:ovenmediaengine-api"
        "1935:rtmp"
        "9999:srt-input"
        "9998:srt-output"
        "3333:webrtc"
        "8088:hls"
    )
    
    for port_service in "${expected_ports[@]}"; do
        local port=$(echo $port_service | cut -d: -f1)
        local service=$(echo $port_service | cut -d: -f2)
        
        if grep -r "port: $port" k8s/ > /dev/null 2>&1; then
            log "SUCCESS" "$service port $port is configured"
        else
            report_warning "$service port $port may not be configured correctly"
        fi
    done
}

# 4. Validate dependencies and ordering
validate_dependencies() {
    log "INFO" "Validating service dependencies..."
    
    # Check init containers for dependencies
    if grep -q "wait-for-postgres" k8s/backend.yaml && grep -q "wait-for-redis" k8s/backend.yaml; then
        log "SUCCESS" "Backend has proper database dependency wait containers"
    else
        report_error "Backend missing proper dependency wait containers"
    fi
    
    if grep -q "wait-for-redis" k8s/ovenmediaengine.yaml; then
        log "SUCCESS" "OvenMediaEngine has proper Redis dependency wait container"
    else
        report_error "OvenMediaEngine missing Redis dependency wait container"
    fi
}

# 5. Validate persistent storage
validate_storage() {
    log "INFO" "Validating persistent storage configurations..."
    
    # Check StorageClass
    if grep -q "kind: StorageClass" k8s/storage.yaml; then
        log "SUCCESS" "StorageClass is defined"
    else
        report_error "StorageClass definition missing"
    fi
    
    # Check PVCs have storageClassName
    local pvcs=("redis-pvc" "postgres-storage" "backend-uploads-pvc" "ome-recordings-pvc")
    
    for pvc in "${pvcs[@]}"; do
        if grep -A10 "$pvc" k8s/*.yaml | grep -q "storageClassName"; then
            log "SUCCESS" "$pvc has storageClassName configured"
        else
            report_warning "$pvc may not have storageClassName configured"
        fi
    done
}

# 6. Validate security configurations
validate_security() {
    log "INFO" "Validating security configurations..."
    
    # Check secrets are base64 encoded
    if grep -q "Y3J1dnpTUlQ5MQ==" k8s/secrets.yaml; then
        log "SUCCESS" "PostgreSQL password is properly base64 encoded"
    else
        report_warning "PostgreSQL password encoding should be verified"
    fi
    
    # Check environment variable references
    if grep -q "envFrom:" k8s/backend.yaml && grep -q "secretRef:" k8s/backend.yaml; then
        log "SUCCESS" "Backend properly references secrets"
    else
        report_warning "Backend secret references should be verified"
    fi
}

# 7. Validate health checks
validate_health_checks() {
    log "INFO" "Validating health check configurations..."
    
    # Check Redis health checks
    if grep -A15 "readinessProbe:" k8s/redis.yaml | grep -q "ping"; then
        log "SUCCESS" "Redis readiness probe is configured"
    else
        report_error "Redis readiness probe missing or misconfigured"
    fi
    
    # Check Backend health checks
    if grep -A5 "readinessProbe:" k8s/backend.yaml | grep -q "/health"; then
        log "SUCCESS" "Backend readiness probe is configured"
    else
        report_error "Backend readiness probe missing or misconfigured"
    fi
    
    # Check OvenMediaEngine health checks
    if grep -A5 "readinessProbe:" k8s/ovenmediaengine.yaml | grep -q "8090"; then
        log "SUCCESS" "OvenMediaEngine readiness probe is configured"
    else
        report_error "OvenMediaEngine readiness probe missing or misconfigured"
    fi
}

# 8. Test deployment script syntax
validate_deployment_script() {
    log "INFO" "Validating deployment script..."
    
    if bash -n deploy-kubernetes.sh; then
        log "SUCCESS" "Deployment script syntax is valid"
    else
        report_error "Deployment script has syntax errors"
    fi
    
    # Check required functions exist
    local required_functions=("build_images" "deploy_kubernetes" "wait_for_services" "run_health_checks")
    
    for func in "${required_functions[@]}"; do
        if grep -q "^$func()" deploy-kubernetes.sh; then
            log "SUCCESS" "Function $func is defined in deployment script"
        else
            report_warning "Function $func may be missing in deployment script"
        fi
    done
}

# 9. Simulate deployment order
simulate_deployment() {
    log "INFO" "Simulating deployment order..."
    
    local deployment_order=(
        "namespace.yaml"
        "storage.yaml"
        "secrets.yaml"
        "configmap.yaml"
        "postgres.yaml"
        "redis.yaml"
        "backend.yaml"
        "ovenmediaengine.yaml"
        "frontend.yaml"
        "monitoring.yaml"
        "grafana.yaml"
    )
    
    for manifest in "${deployment_order[@]}"; do
        if [[ -f "k8s/$manifest" ]]; then
            log "SUCCESS" "✓ Deploy k8s/$manifest"
        else
            report_error "✗ Missing k8s/$manifest"
        fi
    done
}

# 10. Validate production readiness
validate_production_readiness() {
    log "INFO" "Validating production readiness..."
    
    # Check for development-specific configurations (exclude monitoring targets)
    if grep -r "localhost\|127.0.0.1" k8s/ | grep -v "targets.*localhost" > /dev/null 2>&1; then
        report_warning "Development-specific localhost references found"
    else
        log "SUCCESS" "No problematic localhost references found in Kubernetes manifests"
    fi
    
    # Check resource limits are set
    if grep -r "limits:" k8s/ > /dev/null 2>&1 && grep -A3 "limits:" k8s/redis.yaml | grep -q "memory"; then
        log "SUCCESS" "Resource limits are configured"
    else
        report_warning "Resource limits should be verified"
    fi
    
    # Check readiness probes are configured
    local services=("redis" "postgres" "backend" "ovenmediaengine")
    for service in "${services[@]}"; do
        if grep -A20 "app: $service" k8s/*.yaml | grep -q "readinessProbe" || grep -A20 "name: $service" k8s/*.yaml | grep -q "readinessProbe"; then
            log "SUCCESS" "$service has readiness probe configured"
        else
            report_warning "$service readiness probe should be verified"
        fi
    done
}

# Main execution
main() {
    validate_manifests
    validate_resources
    validate_networking
    validate_dependencies
    validate_storage
    validate_security
    validate_health_checks
    validate_deployment_script
    simulate_deployment
    validate_production_readiness
    
    echo ""
    log "HEADER" "================================================"
    log "HEADER" "🎯 DRY RUN VALIDATION SUMMARY"
    log "HEADER" "================================================"
    
    if [[ $ERRORS -eq 0 ]]; then
        log "SUCCESS" "🎉 ALL DRY RUN VALIDATIONS PASSED!"
        echo ""
        log "INFO" "Ready for production deployment. Next steps:"
        echo "1. Ensure Kubernetes cluster is available"
        echo "2. Run: ./deploy-kubernetes.sh"
        echo "3. Monitor deployment: kubectl get pods -n cruvz-srt -w"
        echo "4. Validate health: ./validate-e2e-production.sh health-only"
        
        if [[ $WARNINGS -gt 0 ]]; then
            echo ""
            log "WARNING" "$WARNINGS warnings detected - review recommended"
        fi
        
        exit 0
    else
        echo ""
        log "ERROR" "❌ $ERRORS critical errors detected"
        log "WARNING" "⚠️  $WARNINGS warnings detected"
        echo ""
        log "ERROR" "⚠️  DEPLOYMENT NOT READY - FIX ERRORS BEFORE PROCEEDING"
        exit 1
    fi
}

# Run main function
main "$@"