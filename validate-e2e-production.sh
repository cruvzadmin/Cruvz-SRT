#!/bin/bash

# Cruvz-SRT End-to-End Production Validation Script
# This script validates complete system deployment and functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

NAMESPACE="cruvz-srt"
TIMEOUT=600  # 10 minutes timeout for deployments

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

# Check if kubectl is available and cluster is accessible
check_kubernetes() {
    log "INFO" "Checking Kubernetes availability..."
    
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log "WARNING" "No Kubernetes cluster available. Creating kind cluster..."
        create_kind_cluster
    else
        log "SUCCESS" "Kubernetes cluster is accessible"
    fi
}

# Create kind cluster for testing
create_kind_cluster() {
    if ! command -v kind &> /dev/null; then
        log "INFO" "Installing kind..."
        curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
        chmod +x ./kind
        sudo mv ./kind /usr/local/bin/kind
    fi
    
    log "INFO" "Creating kind cluster for testing..."
    cat << EOF > kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  image: kindest/node:v1.27.3
  extraPortMappings:
  - containerPort: 31935
    hostPort: 31935
    protocol: TCP
  - containerPort: 31999 
    hostPort: 31999
    protocol: UDP
  - containerPort: 31998
    hostPort: 31998
    protocol: UDP
  - containerPort: 33333
    hostPort: 33333
    protocol: TCP
  - containerPort: 38088
    hostPort: 38088
    protocol: TCP
  - containerPort: 30080
    hostPort: 30080
    protocol: TCP
EOF
    
    kind create cluster --name cruvz-srt-test --config kind-config.yaml
    kubectl cluster-info --context kind-cruvz-srt-test
    log "SUCCESS" "Kind cluster created successfully"
}

# Validate deployment readiness
validate_deployment() {
    log "HEADER" "Validating deployment configuration..."
    
    # Run existing validation
    if ./validate-deployment.sh > /dev/null 2>&1; then
        log "SUCCESS" "Basic deployment validation passed"
    else
        log "ERROR" "Basic deployment validation failed"
        exit 1
    fi
    
    # Run Redis-specific validation
    if ./test-redis-deployment.sh > /dev/null 2>&1; then
        log "SUCCESS" "Redis deployment validation passed"
    else
        log "ERROR" "Redis deployment validation failed"
        exit 1
    fi
}

# Deploy and validate complete system
deploy_system() {
    log "HEADER" "Deploying Cruvz-SRT system..."
    
    # Deploy using existing script
    ./deploy-kubernetes.sh
    
    log "SUCCESS" "Deployment script completed"
}

# Comprehensive health validation
validate_health() {
    log "HEADER" "Running comprehensive health validation..."
    
    # Wait for all pods to be ready
    log "INFO" "Waiting for all pods to be ready..."
    kubectl wait --for=condition=ready pod --all -n $NAMESPACE --timeout=${TIMEOUT}s
    
    # Check each service individually
    validate_redis_health
    validate_postgres_health
    validate_backend_health
    validate_ome_health
    validate_frontend_health
}

# Redis health validation
validate_redis_health() {
    log "INFO" "Validating Redis health..."
    
    # Check pod status
    local redis_pod=$(kubectl get pods -n $NAMESPACE -l app=redis -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$redis_pod" ]]; then
        log "ERROR" "Redis pod not found"
        return 1
    fi
    
    # Test Redis connectivity
    if kubectl exec -n $NAMESPACE $redis_pod -- redis-cli ping | grep -q "PONG"; then
        log "SUCCESS" "Redis is responding to ping"
    else
        log "ERROR" "Redis ping failed"
        kubectl logs -n $NAMESPACE $redis_pod --tail=20
        return 1
    fi
    
    # Test Redis info
    if kubectl exec -n $NAMESPACE $redis_pod -- redis-cli info server | grep -q "redis_version"; then
        log "SUCCESS" "Redis info command working"
    else
        log "WARNING" "Redis info command failed"
    fi
}

# PostgreSQL health validation
validate_postgres_health() {
    log "INFO" "Validating PostgreSQL health..."
    
    local postgres_pod=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$postgres_pod" ]]; then
        log "ERROR" "PostgreSQL pod not found"
        return 1
    fi
    
    # Test PostgreSQL connectivity
    if kubectl exec -n $NAMESPACE $postgres_pod -- pg_isready -U cruvz -d cruvzdb; then
        log "SUCCESS" "PostgreSQL is ready"
    else
        log "ERROR" "PostgreSQL health check failed"
        kubectl logs -n $NAMESPACE $postgres_pod --tail=20
        return 1
    fi
    
    # Test database schema
    if kubectl exec -n $NAMESPACE $postgres_pod -- psql -U cruvz -d cruvzdb -c "\\dt" | grep -q "users\|streams"; then
        log "SUCCESS" "Database schema is initialized"
    else
        log "WARNING" "Database schema may not be fully initialized"
    fi
}

# Backend health validation
validate_backend_health() {
    log "INFO" "Validating backend health..."
    
    local backend_pod=$(kubectl get pods -n $NAMESPACE -l app=backend -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$backend_pod" ]]; then
        log "ERROR" "Backend pod not found"
        return 1
    fi
    
    # Test health endpoint
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if kubectl exec -n $NAMESPACE $backend_pod -- curl -s http://localhost:5000/health | grep -q "ok\|healthy\|up"; then
            log "SUCCESS" "Backend health endpoint is responding"
            return 0
        fi
        
        log "INFO" "Backend not ready yet, attempt $attempt/$max_attempts..."
        sleep 10
        ((attempt++))
    done
    
    log "ERROR" "Backend health endpoint failed after $max_attempts attempts"
    kubectl logs -n $NAMESPACE $backend_pod --tail=20
    return 1
}

# OvenMediaEngine health validation
validate_ome_health() {
    log "INFO" "Validating OvenMediaEngine health..."
    
    local ome_pod=$(kubectl get pods -n $NAMESPACE -l app=ovenmediaengine -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$ome_pod" ]]; then
        log "ERROR" "OvenMediaEngine pod not found"
        return 1
    fi
    
    # Test health endpoint
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if kubectl exec -n $NAMESPACE $ome_pod -- curl -s http://localhost:8090/ > /dev/null 2>&1; then
            log "SUCCESS" "OvenMediaEngine health endpoint is responding"
            return 0
        fi
        
        log "INFO" "OvenMediaEngine not ready yet, attempt $attempt/$max_attempts..."
        sleep 10
        ((attempt++))
    done
    
    log "ERROR" "OvenMediaEngine health endpoint failed after $max_attempts attempts"
    kubectl logs -n $NAMESPACE $ome_pod --tail=20
    return 1
}

# Frontend health validation
validate_frontend_health() {
    log "INFO" "Validating frontend health..."
    
    local frontend_pod=$(kubectl get pods -n $NAMESPACE -l app=frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -z "$frontend_pod" ]]; then
        log "WARNING" "Frontend pod not found or not yet deployed"
        return 0
    fi
    
    # Test frontend is serving content
    if kubectl exec -n $NAMESPACE $frontend_pod -- curl -s http://localhost:3000/ | grep -q "html\|Cruvz\|<!DOCTYPE"; then
        log "SUCCESS" "Frontend is serving content"
    else
        log "WARNING" "Frontend may not be fully ready"
    fi
}

# Test streaming functionality
test_streaming() {
    log "HEADER" "Testing streaming functionality..."
    
    # Get service URLs
    local node_ip
    node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
    
    log "INFO" "Testing RTMP endpoint availability..."
    if nc -z $node_ip 31935 2>/dev/null; then
        log "SUCCESS" "RTMP port 31935 is accessible"
    else
        log "WARNING" "RTMP port 31935 is not accessible"
    fi
    
    log "INFO" "Testing SRT endpoints availability..."
    if nc -z -u $node_ip 31999 2>/dev/null; then
        log "SUCCESS" "SRT input port 31999 is accessible"
    else
        log "WARNING" "SRT input port 31999 is not accessible"
    fi
    
    log "INFO" "Testing WebRTC signaling endpoint..."
    if nc -z $node_ip 33333 2>/dev/null; then
        log "SUCCESS" "WebRTC signaling port 33333 is accessible"
    else
        log "WARNING" "WebRTC signaling port 33333 is not accessible"
    fi
    
    log "INFO" "Testing HLS endpoint availability..."
    if nc -z $node_ip 38088 2>/dev/null; then
        log "SUCCESS" "HLS port 38088 is accessible"
    else
        log "WARNING" "HLS port 38088 is not accessible"
    fi
}

# Show final status and access information
show_status() {
    log "HEADER" "Final System Status"
    
    echo ""
    log "INFO" "Pod Status:"
    kubectl get pods -n $NAMESPACE -o wide
    
    echo ""
    log "INFO" "Service Status:"
    kubectl get services -n $NAMESPACE
    
    echo ""
    log "INFO" "Persistent Volume Claims:"
    kubectl get pvc -n $NAMESPACE
    
    echo ""
    local node_ip
    node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
    
    log "SUCCESS" "System deployed successfully!"
    echo ""
    echo "Access URLs:"
    echo "  🎥 RTMP Input: rtmp://$node_ip:31935/app/"
    echo "  📡 SRT Input: srt://$node_ip:31999"
    echo "  🌐 WebRTC: http://$node_ip:33333"
    echo "  📺 HLS Playback: http://$node_ip:38088/app/{stream_name}/playlist.m3u8"
    echo "  🖥️  Frontend: http://$node_ip:30080"
    echo ""
}

# Cleanup function
cleanup() {
    if [[ "$1" == "full" ]]; then
        log "INFO" "Cleaning up kind cluster..."
        kind delete cluster --name cruvz-srt-test 2>/dev/null || true
        rm -f kind-config.yaml
    fi
}

# Main execution
main() {
    log "HEADER" "🎯 CRUVZ-SRT END-TO-END PRODUCTION VALIDATION"
    log "HEADER" "============================================================"
    
    # Set trap for cleanup on exit
    trap 'cleanup' EXIT
    
    check_kubernetes
    validate_deployment
    deploy_system
    validate_health
    test_streaming
    show_status
    
    log "SUCCESS" "🎉 END-TO-END VALIDATION COMPLETED SUCCESSFULLY!"
    log "INFO" "System is ready for production use"
}

# Handle command line arguments
case "${1:-}" in
    "cleanup")
        cleanup full
        exit 0
        ;;
    "health-only")
        validate_health
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac