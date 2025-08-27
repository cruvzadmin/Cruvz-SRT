#!/bin/bash

# ===============================================================================
# CRUVZ-SRT KUBERNETES PRODUCTION DEPLOYMENT SCRIPT
# Complete platform deployment with Six Sigma monitoring
# ===============================================================================

set -euo pipefail

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
KUBE_CONFIG=${KUBECONFIG:-~/.kube/config}

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
        "HEADER")   echo -e "${PURPLE}🚀 $message${NC}" ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if kubectl can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    # Check Docker for building images
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker is not installed or not in PATH"
        exit 1
    fi
    
    log "SUCCESS" "Prerequisites check completed"
}

# Build Docker images
build_images() {
    log "INFO" "Building Docker images..."
    
    # Build backend image
    log "INFO" "Building backend image..."
    docker build -t cruvz-srt-backend:latest ./backend/
    
    # Build frontend image  
    log "INFO" "Building frontend image..."
    docker build -t cruvz-srt-frontend:latest ./frontend/
    
    # Build OvenMediaEngine image
    log "INFO" "Building OvenMediaEngine image..."
    docker build -t cruvz-srt-origin:latest .
    
    log "SUCCESS" "Docker images built successfully"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log "INFO" "Deploying to Kubernetes..."
    
    # Apply manifests in order
    log "INFO" "Creating namespace..."
    kubectl apply -f k8s/namespace.yaml
    
    log "INFO" "Setting up storage..."
    kubectl apply -f k8s/storage.yaml
    
    log "INFO" "Creating secrets and configmaps..."
    kubectl apply -f k8s/secrets.yaml
    kubectl apply -f k8s/configmap.yaml
    
    log "INFO" "Deploying PostgreSQL..."
    kubectl apply -f k8s/postgres.yaml
    
    log "INFO" "Deploying Redis..."
    kubectl apply -f k8s/redis.yaml
    
    log "INFO" "Waiting for database to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    
    log "INFO" "Verifying Redis connectivity..."
    # Wait for Redis pod to be ready with better validation
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
    
    # Additional Redis health validation
    log "INFO" "Validating Redis health..."
    until kubectl exec -n $NAMESPACE deployment/redis -- redis-cli ping > /dev/null 2>&1; do
        log "INFO" "Redis not yet responding to ping, waiting..."
        sleep 5
    done
    log "SUCCESS" "Redis is healthy and responding"
    
    log "INFO" "Deploying backend services..."
    kubectl apply -f k8s/backend.yaml
    
    log "INFO" "Deploying OvenMediaEngine..."
    kubectl apply -f k8s/ovenmediaengine.yaml
    
    log "INFO" "Waiting for core services to be ready..."
    kubectl wait --for=condition=ready pod -l app=backend -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=ovenmediaengine -n $NAMESPACE --timeout=300s
    
    log "INFO" "Deploying frontend..."
    kubectl apply -f k8s/frontend.yaml
    
    log "INFO" "Deploying monitoring stack..."
    kubectl apply -f k8s/monitoring.yaml
    kubectl apply -f k8s/grafana.yaml
    
    log "SUCCESS" "Kubernetes deployment completed"
}

# Wait for all services
wait_for_services() {
    log "INFO" "Waiting for all services to be ready..."
    
    # Wait for all deployments to be ready
    kubectl wait --for=condition=available deployment --all -n $NAMESPACE --timeout=600s
    
    log "SUCCESS" "All services are ready"
}

# Display service information
show_service_info() {
    log "INFO" "Getting service information..."
    
    echo ""
    log "HEADER" "============================================================================"
    log "HEADER" "🎉 CRUVZ-SRT KUBERNETES DEPLOYMENT COMPLETE!"
    log "HEADER" "============================================================================"
    echo ""
    
    # Get service URLs
    FRONTEND_IP=$(kubectl get service frontend-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    OME_IP=$(kubectl get service ovenmediaengine-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    GRAFANA_IP=$(kubectl get service grafana-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    
    # Get NodePort services if LoadBalancer IPs are not available
    if [[ "$FRONTEND_IP" == "pending" ]]; then
        NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
        FRONTEND_PORT=$(kubectl get service frontend-service -n $NAMESPACE -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "80")
        FRONTEND_URL="http://$NODE_IP:$FRONTEND_PORT"
    else
        FRONTEND_URL="http://$FRONTEND_IP"
    fi
    
    if [[ "$GRAFANA_IP" == "pending" ]]; then
        GRAFANA_PORT=$(kubectl get service grafana-service -n $NAMESPACE -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "3000")
        GRAFANA_URL="http://$NODE_IP:$GRAFANA_PORT"
    else
        GRAFANA_URL="http://$GRAFANA_IP:3000"
    fi
    
    echo "🌐 SERVICE URLS:"
    echo "• Frontend Dashboard: $FRONTEND_URL"
    echo "• Grafana Monitoring: $GRAFANA_URL (admin/cruvz123)"
    echo "• Backend API: Use port-forward: kubectl port-forward service/backend-service 5000:5000 -n $NAMESPACE"
    echo "• OvenMediaEngine API: Use port-forward: kubectl port-forward service/ovenmediaengine-service 8080:8080 -n $NAMESPACE"
    echo ""
    
    echo "🎬 STREAMING ENDPOINTS:"
    # Get NodePort for streaming services
    RTMP_PORT=$(kubectl get service ovenmediaengine-nodeport -n $NAMESPACE -o jsonpath='{.spec.ports[?(@.name=="rtmp")].nodePort}' 2>/dev/null || echo "31935")
    SRT_INPUT_PORT=$(kubectl get service ovenmediaengine-nodeport -n $NAMESPACE -o jsonpath='{.spec.ports[?(@.name=="srt-input")].nodePort}' 2>/dev/null || echo "31999")
    SRT_OUTPUT_PORT=$(kubectl get service ovenmediaengine-nodeport -n $NAMESPACE -o jsonpath='{.spec.ports[?(@.name=="srt-output")].nodePort}' 2>/dev/null || echo "31998")
    WEBRTC_PORT=$(kubectl get service ovenmediaengine-nodeport -n $NAMESPACE -o jsonpath='{.spec.ports[?(@.name=="webrtc-signal")].nodePort}' 2>/dev/null || echo "33333")
    LLHLS_PORT=$(kubectl get service ovenmediaengine-nodeport -n $NAMESPACE -o jsonpath='{.spec.ports[?(@.name=="llhls")].nodePort}' 2>/dev/null || echo "38088")
    
    echo "• RTMP: rtmp://$NODE_IP:$RTMP_PORT/app/{stream_key}"
    echo "• SRT Input: srt://$NODE_IP:$SRT_INPUT_PORT?streamid=input/app/{stream_key}"
    echo "• SRT Output: srt://$NODE_IP:$SRT_OUTPUT_PORT?streamid=app/{stream_key}"
    echo "• WebRTC: ws://$NODE_IP:$WEBRTC_PORT/app/{stream_key}"
    echo "• LLHLS: http://$NODE_IP:$LLHLS_PORT/app/{stream_key}/llhls.m3u8"
    echo ""
    
    echo "🔧 USEFUL COMMANDS:"
    echo "• Check pods: kubectl get pods -n $NAMESPACE"
    echo "• Check services: kubectl get services -n $NAMESPACE"
    echo "• View logs: kubectl logs -f deployment/backend -n $NAMESPACE"
    echo "• Port forward backend: kubectl port-forward service/backend-service 5000:5000 -n $NAMESPACE"
    echo "• Port forward OME: kubectl port-forward service/ovenmediaengine-service 8080:8080 -n $NAMESPACE"
    echo "• Scale services: kubectl scale deployment/backend --replicas=3 -n $NAMESPACE"
    echo ""
    
    echo "📞 SUPPORT:"
    echo "• Health checks: kubectl get pods -n $NAMESPACE"
    echo "• Troubleshooting: kubectl describe pod <pod-name> -n $NAMESPACE"
    echo "• Clean up: kubectl delete namespace $NAMESPACE"
    echo ""
    
    log "HEADER" "============================================================================"
}

# Run health checks
run_health_checks() {
    log "INFO" "Running comprehensive health checks..."
    
    # Check if all pods are running
    FAILED_PODS=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    if [[ $FAILED_PODS -gt 0 ]]; then
        log "WARNING" "$FAILED_PODS pods are not in Running state"
        kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running
    else
        log "SUCCESS" "All pods are running successfully"
    fi
    
    # Detailed Redis health check
    log "INFO" "Testing Redis connectivity..."
    if kubectl exec -n $NAMESPACE deployment/redis -- redis-cli ping > /dev/null 2>&1; then
        log "SUCCESS" "Redis is responding to ping"
    else
        log "ERROR" "Redis health check failed"
        kubectl logs -n $NAMESPACE deployment/redis --tail=10
    fi
    
    # PostgreSQL health check
    log "INFO" "Testing PostgreSQL connectivity..."
    if kubectl exec -n $NAMESPACE statefulset/postgres -- pg_isready -U cruvz -d cruvzdb > /dev/null 2>&1; then
        log "SUCCESS" "PostgreSQL is ready"
    else
        log "ERROR" "PostgreSQL health check failed"
        kubectl logs -n $NAMESPACE statefulset/postgres --tail=10
    fi
    
    # Backend health check (if available)
    log "INFO" "Testing backend service health..."
    BACKEND_POD=$(kubectl get pods -n $NAMESPACE -l app=backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$BACKEND_POD" ]]; then
        if kubectl exec -n $NAMESPACE $BACKEND_POD -- curl -s http://localhost:5000/health > /dev/null 2>&1; then
            log "SUCCESS" "Backend health endpoint is responding"
        else
            log "WARNING" "Backend health endpoint not ready yet (this is normal during startup)"
        fi
    fi
    
    # OvenMediaEngine health check
    log "INFO" "Testing OvenMediaEngine health..."
    OME_POD=$(kubectl get pods -n $NAMESPACE -l app=ovenmediaengine -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$OME_POD" ]]; then
        if kubectl exec -n $NAMESPACE $OME_POD -- curl -s http://localhost:8090/ > /dev/null 2>&1; then
            log "SUCCESS" "OvenMediaEngine health endpoint is responding"
        else
            log "WARNING" "OvenMediaEngine health endpoint not ready yet (this is normal during startup)"
        fi
    fi
    
    # Check services
    log "INFO" "Service status:"
    kubectl get services -n $NAMESPACE
    
    log "SUCCESS" "Health checks completed"
}

# Main execution
main() {
    log "HEADER" "🚀 CRUVZ-SRT KUBERNETES DEPLOYMENT STARTING"
    log "HEADER" "============================================================================"
    
    check_prerequisites
    build_images
    deploy_kubernetes
    wait_for_services
    run_health_checks
    show_service_info
    
    log "SUCCESS" "Deployment completed successfully!"
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up on exit..."
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"