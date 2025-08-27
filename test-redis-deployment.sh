#!/bin/bash

# Cruvz-SRT Redis and Deployment Testing Script
# This script validates Redis configuration and deployment readiness

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

# Function to report errors
report_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ((ERRORS++))
}

# Function to report warnings
report_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    ((WARNINGS++))
}

# Function to report success
report_success() {
    echo -e "${GREEN}✅ SUCCESS: $1${NC}"
}

# Function to report info
report_info() {
    echo -e "${BLUE}ℹ️  INFO: $1${NC}"
}

echo -e "${BLUE}🔍 CRUVZ-SRT REDIS AND DEPLOYMENT VALIDATION${NC}"
echo "================================================"

# Test 1: Validate Redis Configuration
echo -e "\n${BLUE}1. Redis Configuration Validation${NC}"

# Check Redis YAML syntax
if python3 -c "import yaml; yaml.safe_load_all(open('k8s/redis.yaml'))" 2>/dev/null; then
    report_success "Redis YAML syntax is valid"
else
    report_error "Redis YAML syntax is invalid"
fi

# Check Redis authentication handling
if grep -q "if.*REDIS_PASSWORD.*then" k8s/redis.yaml; then
    report_success "Redis authentication is properly handled"
else
    report_error "Redis authentication handling is missing"
fi

# Check Redis health check improvements
if grep -q "redis-cli.*-a.*REDIS_PASSWORD" k8s/redis.yaml; then
    report_success "Redis health checks handle authentication"
else
    report_error "Redis health checks don't handle authentication properly"
fi

# Test 2: Validate Backend Redis Integration
echo -e "\n${BLUE}2. Backend Redis Integration${NC}"

# Check wait-for-redis init container in backend
if grep -q "wait-for-redis" k8s/backend.yaml; then
    report_success "Backend has Redis wait container"
else
    report_error "Backend missing Redis wait container"
fi

# Check Redis configuration in backend
if grep -q "REDIS_HOST.*redis-service" k8s/configmap.yaml; then
    report_success "Backend Redis host configuration is correct"
else
    report_error "Backend Redis host configuration is incorrect"
fi

# Test 3: Validate OvenMediaEngine Redis Integration  
echo -e "\n${BLUE}3. OvenMediaEngine Redis Integration${NC}"

# Check wait-for-redis init container in OME
if grep -q "wait-for-redis" k8s/ovenmediaengine.yaml; then
    report_success "OvenMediaEngine has Redis wait container"
else
    report_error "OvenMediaEngine missing Redis wait container"
fi

# Test 4: Resource and Storage Configuration
echo -e "\n${BLUE}4. Resource and Storage Configuration${NC}"

# Check Redis resource limits
if grep -A5 -B5 "resources:" k8s/redis.yaml | grep -q "memory.*256Mi"; then
    report_success "Redis memory requests are appropriate"
else
    report_warning "Redis memory requests may need adjustment"
fi

# Check Redis persistent volume
if grep -q "persistentVolumeClaim" k8s/redis.yaml; then
    report_success "Redis has persistent storage configured"
else
    report_error "Redis missing persistent storage"
fi

# Test 5: Network Configuration
echo -e "\n${BLUE}5. Network Configuration${NC}"

# Check Redis service configuration
if grep -A10 "kind: Service" k8s/redis.yaml | grep -q "port: 6379"; then
    report_success "Redis service port is correctly configured"
else
    report_error "Redis service port configuration is incorrect"
fi

# Check service name consistency
if grep -q "redis-service" k8s/configmap.yaml && grep -q "redis-service" k8s/backend.yaml; then
    report_success "Redis service name is consistent across configurations"
else
    report_error "Redis service name inconsistency detected"
fi

# Test 6: Deployment Script Validation
echo -e "\n${BLUE}6. Deployment Script Validation${NC}"

# Check Redis health validation in deployment script
if grep -q "Redis is healthy and responding" deploy-kubernetes.sh; then
    report_success "Deployment script includes Redis health validation"
else
    report_error "Deployment script missing Redis health validation"
fi

# Check comprehensive health checks
if grep -q "run_health_checks" deploy-kubernetes.sh; then
    report_success "Deployment script includes comprehensive health checks"
else
    report_error "Deployment script missing comprehensive health checks"
fi

# Test 7: Error Handling and Fallbacks
echo -e "\n${BLUE}7. Error Handling and Fallback Mechanisms${NC}"

# Check backend cache fallback
if grep -q "graceful.*fallback" backend/utils/cache.js; then
    report_success "Backend has graceful Redis fallback handling"
else
    report_warning "Backend may not handle Redis failures gracefully"
fi

# Check production error handling
if grep -q "NODE_ENV.*production" backend/utils/cache.js && grep -q "Redis.*connection.*failed" backend/utils/cache.js; then
    report_success "Production Redis error handling is configured"
else
    report_warning "Production Redis error handling may be insufficient"
fi

# Test 8: Security Configuration
echo -e "\n${BLUE}8. Security Configuration${NC}"

# Check Redis password handling
if grep -q "REDIS_PASSWORD" k8s/secrets.yaml; then
    report_success "Redis password is configured in secrets"
else
    report_warning "Redis password configuration not found"
fi

# Check empty password handling
if grep -q 'REDIS_PASSWORD: ""' k8s/secrets.yaml; then
    report_info "Redis password is empty (authentication disabled)"
else
    report_info "Redis password is set (authentication enabled)"
fi

# Test 9: Startup Order and Dependencies
echo -e "\n${BLUE}9. Startup Order and Dependencies${NC}"

# Check if deployment script waits for Redis before starting dependent services
if grep -A20 "Validating Redis health" deploy-kubernetes.sh | grep -q "backend"; then
    report_success "Deployment ensures Redis is ready before starting backend"
else
    report_error "Deployment may not ensure proper startup order"
fi

# Final Results
echo -e "\n" 
echo "================================================"
echo -e "${BLUE}🎯 REDIS DEPLOYMENT VALIDATION SUMMARY${NC}"
echo "================================================"

if [[ $ERRORS -eq 0 ]]; then
    report_success "All critical Redis deployment checks passed!"
    echo -e "\n${GREEN}🎉 REDIS DEPLOYMENT IS READY FOR PRODUCTION${NC}"
    
    if [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warnings detected - review recommended${NC}"
    fi
    
    echo -e "\n${BLUE}Next steps:${NC}"
    echo "1. Deploy to Kubernetes: ./deploy-kubernetes.sh"
    echo "2. Monitor Redis health: kubectl logs -f deployment/redis -n cruvz-srt"
    echo "3. Test connectivity: kubectl exec -n cruvz-srt deployment/redis -- redis-cli ping"
    
    exit 0
else
    echo -e "${RED}❌ $ERRORS critical errors detected${NC}"
    echo -e "${YELLOW}⚠️  $WARNINGS warnings detected${NC}"
    echo -e "\n${RED}⚠️  DEPLOYMENT NOT READY - FIX ERRORS BEFORE PROCEEDING${NC}"
    exit 1
fi