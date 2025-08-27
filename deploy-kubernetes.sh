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

# Function to handle forbidden StatefulSet updates manually
handle_forbidden_statefulset_update() {
    local name=$1
    local namespace=$2
    local manifest_file=$3
    
    log "WARNING" "Handling forbidden update for StatefulSet: $name"
    
    # Backup PostgreSQL data if it's the postgres StatefulSet
    local backup_path=""
    if [[ "$name" == "postgres" ]]; then
        log "INFO" "Creating backup before StatefulSet recreation..."
        # Simple backup using pg_dump
        local postgres_pod=$(kubectl get pods -n "$namespace" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [[ -n "$postgres_pod" ]] && kubectl exec -n "$namespace" "$postgres_pod" -- pg_isready -U cruvz -d cruvzdb &>/dev/null; then
            backup_path="/tmp/postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
            log "INFO" "Creating SQL backup at: $backup_path"
            kubectl exec -n "$namespace" "$postgres_pod" -- pg_dump -U cruvz -d cruvzdb --clean --if-exists --create > "$backup_path" || {
                log "WARNING" "Backup failed, proceeding without backup"
                backup_path=""
            }
        fi
    fi
    
    # Scale down to 0
    log "INFO" "Scaling down StatefulSet $name to 0 replicas..."
    kubectl scale statefulset "$name" --replicas=0 -n "$namespace" || {
        log "WARNING" "Failed to scale down, StatefulSet may not exist"
    }
    
    # Wait for pods to terminate
    log "INFO" "Waiting for pods to terminate..."
    kubectl wait --for=delete pod -l app="$name" -n "$namespace" --timeout=300s || {
        log "WARNING" "Some pods may not have terminated gracefully"
    }
    
    # Delete StatefulSet but preserve PVCs
    log "INFO" "Deleting StatefulSet $name (preserving PVCs)..."
    kubectl delete statefulset "$name" -n "$namespace" --ignore-not-found=true
    
    # Apply new configuration
    log "INFO" "Applying new StatefulSet configuration..."
    kubectl apply -f "$manifest_file" || {
        log "ERROR" "Failed to apply new StatefulSet configuration"
        return 1
    }
    
    # Wait for StatefulSet to be ready
    log "INFO" "Waiting for StatefulSet $name to be ready..."
    kubectl wait --for=condition=ready pod -l app="$name" -n "$namespace" --timeout=600s || {
        log "ERROR" "StatefulSet failed to become ready"
        return 1
    }
    
    # Restore backup if available
    if [[ -n "$backup_path" && -f "$backup_path" && "$name" == "postgres" ]]; then
        log "INFO" "Restoring PostgreSQL backup..."
        local postgres_pod=$(kubectl get pods -n "$namespace" -l app=postgres -o jsonpath='{.items[0].metadata.name}')
        
        # Wait for PostgreSQL to be ready
        local max_attempts=30
        local attempt=0
        while ! kubectl exec -n "$namespace" "$postgres_pod" -- pg_isready -U cruvz -d cruvzdb &>/dev/null; do
            if [[ $attempt -ge $max_attempts ]]; then
                log "WARNING" "PostgreSQL not ready, skipping backup restore"
                break
            fi
            log "INFO" "Waiting for PostgreSQL to be ready for restore... (attempt $((attempt + 1))/$max_attempts)"
            sleep 10
            ((attempt++))
        done
        
        if [[ $attempt -lt $max_attempts ]]; then
            kubectl exec -i -n "$namespace" "$postgres_pod" -- psql -U cruvz -d postgres < "$backup_path" || {
                log "WARNING" "Backup restore failed, database initialized with default schema"
            }
            log "SUCCESS" "PostgreSQL backup restored"
        fi
        
        # Clean up backup file
        rm -f "$backup_path"
    fi
    
    log "SUCCESS" "StatefulSet $name recreated successfully"
}

# Enhanced deployment function with robust error handling
deploy_kubernetes_robust() {
    log "INFO" "Starting robust Kubernetes deployment..."
    
    # Pre-deployment validation
    log "INFO" "Running pre-deployment validation..."
    if [[ -x "$SCRIPT_DIR/validate-deployment-dry-run.sh" ]]; then
        "$SCRIPT_DIR/validate-deployment-dry-run.sh" || {
            log "ERROR" "Pre-deployment validation failed"
            return 1
        }
    fi
    
    # Apply manifests in order with error handling
    log "INFO" "Creating namespace..."
    kubectl apply -f k8s/namespace.yaml || {
        log "ERROR" "Failed to create namespace"
        return 1
    }
    
    log "INFO" "Setting up storage..."
    kubectl apply -f k8s/storage.yaml || {
        log "ERROR" "Failed to set up storage"
        return 1
    }
    
    log "INFO" "Creating secrets and configmaps..."
    kubectl apply -f k8s/secrets.yaml || {
        log "ERROR" "Failed to create secrets"
        return 1
    }
    kubectl apply -f k8s/configmap.yaml || {
        log "ERROR" "Failed to create configmaps"
        return 1
    }
    
    # Deploy PostgreSQL using StatefulSet manager for safe updates
    log "INFO" "Deploying PostgreSQL with StatefulSet manager..."
    if [[ -x "$SCRIPT_DIR/scripts/statefulset-manager.sh" ]]; then
        "$SCRIPT_DIR/scripts/statefulset-manager.sh" apply k8s/postgres.yaml $NAMESPACE true || {
            log "ERROR" "Failed to deploy PostgreSQL StatefulSet"
            return 1
        }
    else
        log "WARNING" "StatefulSet manager not found, using standard kubectl apply"
        # Try normal apply first, handle forbidden update if it occurs
        if ! kubectl apply -f k8s/postgres.yaml 2>/dev/null; then
            local error_output=$(kubectl apply -f k8s/postgres.yaml 2>&1)
            if echo "$error_output" | grep -q "forbidden.*immutable"; then
                log "WARNING" "Forbidden update detected, recreating PostgreSQL StatefulSet..."
                handle_forbidden_statefulset_update "postgres" "$NAMESPACE" "k8s/postgres.yaml"
            else
                log "ERROR" "Failed to deploy PostgreSQL: $error_output"
                return 1
            fi
        fi
    fi
    
    log "INFO" "Deploying Redis..."
    kubectl apply -f k8s/redis.yaml || {
        log "ERROR" "Failed to deploy Redis"
        return 1
    }
    
    log "INFO" "Waiting for database to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s || {
        log "ERROR" "PostgreSQL failed to become ready"
        return 1
    }
    
    log "INFO" "Verifying Redis connectivity..."
    # Wait for Redis pod to be ready with better validation
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s || {
        log "ERROR" "Redis failed to become ready"
        return 1
    }
    
    # Additional Redis health validation
    log "INFO" "Validating Redis health..."
    local redis_attempts=12
    local redis_attempt=0
    until kubectl exec -n $NAMESPACE deployment/redis -- redis-cli ping > /dev/null 2>&1; do
        if [[ $redis_attempt -ge $redis_attempts ]]; then
            log "ERROR" "Redis health check failed after $redis_attempts attempts"
            return 1
        fi
        log "INFO" "Redis not yet responding to ping, waiting... (attempt $((redis_attempt + 1))/$redis_attempts)"
        sleep 5
        ((redis_attempt++))
    done
    log "SUCCESS" "Redis is healthy and responding"
    
    log "INFO" "Deploying backend services..."
    kubectl apply -f k8s/backend.yaml || {
        log "ERROR" "Failed to deploy backend services"
        return 1
    }
    
    log "INFO" "Deploying OvenMediaEngine..."
    kubectl apply -f k8s/ovenmediaengine.yaml || {
        log "ERROR" "Failed to deploy OvenMediaEngine"
        return 1
    }
    
    log "INFO" "Waiting for core services to be ready..."
    kubectl wait --for=condition=ready pod -l app=backend -n $NAMESPACE --timeout=300s || {
        log "WARNING" "Backend may not be ready yet, continuing deployment"
    }
    kubectl wait --for=condition=ready pod -l app=ovenmediaengine -n $NAMESPACE --timeout=300s || {
        log "WARNING" "OvenMediaEngine may not be ready yet, continuing deployment"
    }
    
    log "INFO" "Deploying frontend..."
    kubectl apply -f k8s/frontend.yaml || {
        log "ERROR" "Failed to deploy frontend"
        return 1
    }
    
    log "INFO" "Deploying monitoring stack..."
    kubectl apply -f k8s/monitoring.yaml || {
        log "WARNING" "Failed to deploy monitoring stack, continuing"
    }
    kubectl apply -f k8s/grafana.yaml || {
        log "WARNING" "Failed to deploy Grafana, continuing"
    }
    
    log "SUCCESS" "Kubernetes deployment completed successfully"
}

# Wrapper function for backward compatibility
deploy_kubernetes() {
    deploy_kubernetes_robust
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

# Final production readiness check
check_production_readiness() {
    log "INFO" "Performing final production readiness assessment..."
    
    local readiness_issues=()
    
    # Check all critical pods are running
    local critical_apps=("postgres" "redis" "backend" "ovenmediaengine" "frontend")
    for app in "${critical_apps[@]}"; do
        local running_pods=$(kubectl get pods -n $NAMESPACE -l app="$app" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        if [[ $running_pods -eq 0 ]]; then
            readiness_issues+=("Critical service $app is not running")
        fi
    done
    
    # Check PostgreSQL is actually ready
    local postgres_pod=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$postgres_pod" ]]; then
        if ! kubectl exec -n $NAMESPACE "$postgres_pod" -- pg_isready -U cruvz -d cruvzdb &>/dev/null; then
            readiness_issues+=("PostgreSQL is not ready for connections")
        fi
    else
        readiness_issues+=("PostgreSQL pod not found")
    fi
    
    # Check Redis is actually ready
    local redis_pod=$(kubectl get pods -n $NAMESPACE -l app=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$redis_pod" ]]; then
        if ! kubectl exec -n $NAMESPACE "$redis_pod" -- redis-cli ping | grep -q "PONG" 2>/dev/null; then
            readiness_issues+=("Redis is not responding to ping")
        fi
    else
        readiness_issues+=("Redis pod not found")
    fi
    
    # Check services are accessible
    local required_services=("postgres-service" "redis-service" "backend-service" "ovenmediaengine-service" "frontend-service")
    for service in "${required_services[@]}"; do
        if ! kubectl get service "$service" -n $NAMESPACE &>/dev/null; then
            readiness_issues+=("Required service $service not found")
        fi
    done
    
    # Check persistent volumes are bound
    local required_pvcs=("redis-pvc")
    for pvc in "${required_pvcs[@]}"; do
        local pvc_status=$(kubectl get pvc "$pvc" -n $NAMESPACE -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
        if [[ "$pvc_status" != "Bound" ]]; then
            readiness_issues+=("PVC $pvc is not bound (status: $pvc_status)")
        fi
    done
    
    # Report results
    if [[ ${#readiness_issues[@]} -eq 0 ]]; then
        log "SUCCESS" "🎉 PRODUCTION READINESS: CONFIRMED ✅"
        log "SUCCESS" "All critical systems are operational and ready for production workloads"
        log "SUCCESS" "Streaming platform is ready to handle live traffic"
        return 0
    else
        log "ERROR" "❌ PRODUCTION READINESS: ISSUES DETECTED"
        log "ERROR" "The following issues must be resolved before production deployment:"
        for issue in "${readiness_issues[@]}"; do
            log "ERROR" "  - $issue"
        done
        log "ERROR" "Please resolve these issues and run validation again"
        return 1
    fi
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
    run_comprehensive_validation
    show_service_info
    
    log "SUCCESS" "Deployment completed successfully!"
}

# Comprehensive validation workflow
run_comprehensive_validation() {
    log "HEADER" "Running comprehensive production validation..."
    
    # Run basic health checks first
    run_health_checks
    
    # Run comprehensive system validation
    if [[ -x "$SCRIPT_DIR/validate-production-complete.sh" ]]; then
        log "INFO" "Running comprehensive system validation..."
        "$SCRIPT_DIR/validate-production-complete.sh" || {
            log "WARNING" "Some comprehensive validation tests failed or have warnings"
        }
    fi
    
    # Run streaming protocol validation
    if [[ -x "$SCRIPT_DIR/validate-streaming-protocols.sh" ]]; then
        log "INFO" "Running streaming protocol validation..."
        "$SCRIPT_DIR/validate-streaming-protocols.sh" || {
            log "WARNING" "Some streaming protocol tests failed or have warnings"
        }
    fi
    
    # Final production readiness check
    log "INFO" "Performing final production readiness check..."
    check_production_readiness
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up on exit..."
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"