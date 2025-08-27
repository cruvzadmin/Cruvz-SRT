#!/bin/bash

# ===============================================================================
# CRUVZ-SRT KUBERNETES DEPLOYMENT VALIDATION SCRIPT
# Validates all configurations and manifests before deployment
# ===============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] $level: $*"

    case $level in
        "INFO")     echo -e "${BLUE}ℹ️  $message${NC}" ;;
        "SUCCESS")  echo -e "${GREEN}✅ $message${NC}" ;;
        "WARNING")  echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "ERROR")    echo -e "${RED}❌ $message${NC}" ;;
        "HEADER")   echo -e "${BLUE}🚀 $message${NC}" ;;
    esac
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERRORS=0

# Function to report errors
report_error() {
    log "ERROR" "$1"
    ((ERRORS++))
}

# Validate YAML syntax
validate_yaml_files() {
    log "INFO" "Validating YAML syntax..."
    
    for file in k8s/*.yaml; do
        if [ -f "$file" ]; then
            if python3 -c "import yaml; yaml.safe_load_all(open('$file'))" 2>/dev/null; then
                log "SUCCESS" "✅ $file - valid YAML syntax"
            else
                report_error "❌ $file - invalid YAML syntax"
            fi
        fi
    done
}

# Validate Kubernetes manifests structure
validate_k8s_manifests() {
    log "INFO" "Validating Kubernetes manifest structure..."
    
    # Check required files exist
    required_files=(
        "k8s/namespace.yaml"
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
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log "SUCCESS" "✅ $file exists"
        else
            report_error "❌ Required file $file is missing"
        fi
    done
}

# Validate Docker configurations
validate_docker_configs() {
    log "INFO" "Validating Docker configurations..."
    
    # Check Dockerfiles exist
    docker_files=(
        "Dockerfile"
        "backend/Dockerfile"
        "frontend/Dockerfile"
    )
    
    for file in "${docker_files[@]}"; do
        if [ -f "$file" ]; then
            log "SUCCESS" "✅ $file exists"
        else
            report_error "❌ Required Dockerfile $file is missing"
        fi
    done
    
    # Check shell scripts
    scripts=(
        "docker/health-endpoint.sh"
        "docker/production-entrypoint.sh"
        "deploy-kubernetes.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            if bash -n "$script"; then
                log "SUCCESS" "✅ $script - valid shell syntax"
            else
                report_error "❌ $script - invalid shell syntax"
            fi
        else
            report_error "❌ Required script $script is missing"
        fi
    done
}

# Validate backend configuration
validate_backend_config() {
    log "INFO" "Validating backend configuration..."
    
    # Check Node.js syntax
    backend_files=(
        "backend/server.js"
        "backend/scripts/migrate.js"
        "backend/run-migrations.js"
    )
    
    for file in "${backend_files[@]}"; do
        if [ -f "$file" ]; then
            if node -c "$file" 2>/dev/null; then
                log "SUCCESS" "✅ $file - valid Node.js syntax"
            else
                report_error "❌ $file - invalid Node.js syntax"
            fi
        else
            report_error "❌ Required backend file $file is missing"
        fi
    done
}

# Validate image references
validate_image_references() {
    log "INFO" "Validating image references consistency..."
    
    # Extract image names from deployment script
    deploy_images=$(grep -o "cruvz-srt-[^:]*:latest" deploy-kubernetes.sh | sort | uniq)
    
    # Extract image names from manifests
    manifest_images=$(grep -o "cruvz-srt-[^:]*:latest" k8s/*.yaml | cut -d: -f2- | sort | uniq)
    
    log "INFO" "Deploy script images: $deploy_images"
    log "INFO" "Manifest images: $manifest_images"
    
    if [ "$deploy_images" = "$manifest_images" ]; then
        log "SUCCESS" "✅ Image references are consistent"
    else
        report_error "❌ Image references are inconsistent between deploy script and manifests"
    fi
}

# Validate health check endpoints
validate_health_checks() {
    log "INFO" "Validating health check configurations..."
    
    # Check OvenMediaEngine health endpoint
    if grep -q "port: 8090" k8s/ovenmediaengine.yaml && grep -q "health-endpoint.sh" docker/production-entrypoint.sh; then
        log "SUCCESS" "✅ OvenMediaEngine health check configured correctly"
    else
        report_error "❌ OvenMediaEngine health check configuration is incorrect"
    fi
    
    # Check backend health endpoint
    if grep -q "path: /health" k8s/backend.yaml && grep -q "app.get('/health'" backend/server.js; then
        log "SUCCESS" "✅ Backend health check configured correctly"
    else
        report_error "❌ Backend health check configuration is incorrect"
    fi
}

# Main validation function
main() {
    log "HEADER" "🔍 STARTING CRUVZ-SRT DEPLOYMENT VALIDATION"
    log "HEADER" "================================================"
    
    validate_yaml_files
    validate_k8s_manifests
    validate_docker_configs
    validate_backend_config
    validate_image_references
    validate_health_checks
    
    echo ""
    log "HEADER" "================================================"
    if [ $ERRORS -eq 0 ]; then
        log "SUCCESS" "🎉 ALL VALIDATIONS PASSED! Deployment is ready."
        log "HEADER" "================================================"
        exit 0
    else
        log "ERROR" "❌ $ERRORS validation error(s) found. Please fix before deployment."
        log "HEADER" "================================================"
        exit 1
    fi
}

# Run main function
main "$@"