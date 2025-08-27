#!/bin/bash

# ===============================================================================
# STATEFULSET MANAGER UTILITY
# Handles forbidden updates by safely recreating StatefulSets with data preservation
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
BACKUP_DIR="/tmp/k8s-statefulset-backup"
NAMESPACE=${NAMESPACE:-"cruvz-srt"}

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

# Function to check if a StatefulSet has immutable field changes
check_immutable_fields() {
    local name=$1
    local namespace=$2
    local manifest_file=$3
    
    log "INFO" "Checking for immutable field changes in StatefulSet: $name"
    
    # Get current StatefulSet if it exists
    if ! kubectl get statefulset "$name" -n "$namespace" &>/dev/null; then
        log "INFO" "StatefulSet $name does not exist yet, no immutable field check needed"
        return 1  # No existing StatefulSet, safe to apply
    fi
    
    # Extract current immutable fields
    local current_service_name=$(kubectl get statefulset "$name" -n "$namespace" -o jsonpath='{.spec.serviceName}')
    local current_selector=$(kubectl get statefulset "$name" -n "$namespace" -o jsonpath='{.spec.selector}' | jq -S .)
    local current_vct=$(kubectl get statefulset "$name" -n "$namespace" -o jsonpath='{.spec.volumeClaimTemplates}' | jq -S .)
    
    # Extract new immutable fields from manifest
    local new_service_name=$(yq eval '.spec.serviceName' "$manifest_file")
    local new_selector=$(yq eval '.spec.selector' "$manifest_file" | yq -o json | jq -S .)
    local new_vct=$(yq eval '.spec.volumeClaimTemplates' "$manifest_file" | yq -o json | jq -S .)
    
    local changes_detected=false
    
    # Check serviceName
    if [[ "$current_service_name" != "$new_service_name" ]]; then
        log "WARNING" "serviceName change detected: $current_service_name -> $new_service_name"
        changes_detected=true
    fi
    
    # Check selector
    if [[ "$current_selector" != "$new_selector" ]]; then
        log "WARNING" "selector change detected"
        changes_detected=true
    fi
    
    # Check volumeClaimTemplates
    if [[ "$current_vct" != "$new_vct" ]]; then
        log "WARNING" "volumeClaimTemplates change detected"
        changes_detected=true
    fi
    
    if [[ "$changes_detected" == "true" ]]; then
        log "ERROR" "Immutable field changes detected in StatefulSet $name"
        return 0  # Changes detected, needs recreation
    else
        log "SUCCESS" "No immutable field changes detected"
        return 1  # No changes, safe to apply
    fi
}

# Function to backup PostgreSQL data
backup_postgres_data() {
    local namespace=$1
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/postgres_$backup_timestamp"
    
    log "INFO" "Creating PostgreSQL backup..."
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Get PostgreSQL pod name
    local postgres_pod=$(kubectl get pods -n "$namespace" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -z "$postgres_pod" ]]; then
        log "WARNING" "No PostgreSQL pod found, skipping data backup"
        return 1
    fi
    
    # Check if PostgreSQL is ready
    if ! kubectl exec -n "$namespace" "$postgres_pod" -- pg_isready -U cruvz -d cruvzdb &>/dev/null; then
        log "WARNING" "PostgreSQL is not ready, attempting backup anyway"
    fi
    
    # Create SQL dump
    log "INFO" "Creating SQL dump backup..."
    kubectl exec -n "$namespace" "$postgres_pod" -- pg_dump -U cruvz -d cruvzdb --clean --if-exists --create > "$backup_path/cruvzdb_dump.sql" 2>/dev/null || {
        log "WARNING" "SQL dump failed, continuing with PVC backup"
    }
    
    # Backup PVC data if possible
    log "INFO" "Backing up PVC data..."
    local pvc_name=$(kubectl get pvc -n "$namespace" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "postgres-storage-postgres-0")
    
    if kubectl get pvc "$pvc_name" -n "$namespace" &>/dev/null; then
        # Create a backup pod to copy PVC data
        cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: postgres-backup-pod
  namespace: $namespace
spec:
  restartPolicy: Never
  containers:
  - name: backup
    image: busybox
    command: ['/bin/sh', '-c', 'tar czf /backup/postgres-pvc-data.tar.gz -C /data . && echo "Backup completed"']
    volumeMounts:
    - name: postgres-data
      mountPath: /data
    - name: backup-volume
      mountPath: /backup
  volumes:
  - name: postgres-data
    persistentVolumeClaim:
      claimName: $pvc_name
  - name: backup-volume
    hostPath:
      path: $backup_path
      type: DirectoryOrCreate
EOF
        
        # Wait for backup to complete
        kubectl wait --for=condition=complete pod/postgres-backup-pod -n "$namespace" --timeout=300s || {
            log "WARNING" "PVC backup pod failed or timed out"
        }
        
        # Clean up backup pod
        kubectl delete pod postgres-backup-pod -n "$namespace" --ignore-not-found=true
    fi
    
    log "SUCCESS" "PostgreSQL backup completed at: $backup_path"
    echo "$backup_path"
}

# Function to restore PostgreSQL data
restore_postgres_data() {
    local namespace=$1
    local backup_path=$2
    
    if [[ ! -d "$backup_path" ]]; then
        log "WARNING" "Backup path $backup_path does not exist, skipping restore"
        return 1
    fi
    
    log "INFO" "Restoring PostgreSQL data from: $backup_path"
    
    # Wait for PostgreSQL to be ready
    log "INFO" "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n "$namespace" --timeout=300s
    
    local postgres_pod=$(kubectl get pods -n "$namespace" -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    # Wait for PostgreSQL to be actually ready
    local max_attempts=30
    local attempt=0
    while ! kubectl exec -n "$namespace" "$postgres_pod" -- pg_isready -U cruvz -d cruvzdb &>/dev/null; do
        if [[ $attempt -ge $max_attempts ]]; then
            log "ERROR" "PostgreSQL failed to become ready within timeout"
            return 1
        fi
        log "INFO" "Waiting for PostgreSQL to be ready... (attempt $((attempt + 1))/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    # Restore from SQL dump if available
    if [[ -f "$backup_path/cruvzdb_dump.sql" ]]; then
        log "INFO" "Restoring from SQL dump..."
        kubectl exec -i -n "$namespace" "$postgres_pod" -- psql -U cruvz -d postgres < "$backup_path/cruvzdb_dump.sql" || {
            log "WARNING" "SQL dump restore failed, database may have been initialized with default schema"
        }
    fi
    
    # Restore PVC data if available
    if [[ -f "$backup_path/postgres-pvc-data.tar.gz" ]]; then
        log "INFO" "Restoring PVC data..."
        local pvc_name=$(kubectl get pvc -n "$namespace" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "postgres-storage-postgres-0")
        
        # Create restore pod
        cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: postgres-restore-pod
  namespace: $namespace
spec:
  restartPolicy: Never
  containers:
  - name: restore
    image: busybox
    command: ['/bin/sh', '-c', 'cd /data && tar xzf /backup/postgres-pvc-data.tar.gz && echo "Restore completed"']
    volumeMounts:
    - name: postgres-data
      mountPath: /data
    - name: backup-volume
      mountPath: /backup
  volumes:
  - name: postgres-data
    persistentVolumeClaim:
      claimName: $pvc_name
  - name: backup-volume
    hostPath:
      path: $backup_path
      type: Directory
EOF
        
        kubectl wait --for=condition=complete pod/postgres-restore-pod -n "$namespace" --timeout=300s || {
            log "WARNING" "PVC restore failed"
        }
        
        # Clean up restore pod
        kubectl delete pod postgres-restore-pod -n "$namespace" --ignore-not-found=true
    fi
    
    log "SUCCESS" "PostgreSQL data restore completed"
}

# Function to safely recreate a StatefulSet
recreate_statefulset() {
    local name=$1
    local namespace=$2
    local manifest_file=$3
    local backup_data=${4:-false}
    
    log "HEADER" "Recreating StatefulSet: $name"
    
    local backup_path=""
    
    # Backup data if requested and it's PostgreSQL
    if [[ "$backup_data" == "true" && "$name" == "postgres" ]]; then
        backup_path=$(backup_postgres_data "$namespace")
    fi
    
    # Scale down StatefulSet to 0
    log "INFO" "Scaling down StatefulSet $name to 0 replicas..."
    kubectl scale statefulset "$name" --replicas=0 -n "$namespace" || {
        log "WARNING" "Failed to scale down StatefulSet, it may not exist"
    }
    
    # Wait for pods to terminate
    log "INFO" "Waiting for pods to terminate..."
    kubectl wait --for=delete pod -l app="$name" -n "$namespace" --timeout=300s || {
        log "WARNING" "Some pods may not have terminated gracefully"
    }
    
    # Delete StatefulSet (but keep PVCs)
    log "INFO" "Deleting StatefulSet $name (preserving PVCs)..."
    kubectl delete statefulset "$name" -n "$namespace" --ignore-not-found=true
    
    # Apply new StatefulSet configuration
    log "INFO" "Applying new StatefulSet configuration..."
    kubectl apply -f "$manifest_file"
    
    # Wait for StatefulSet to be ready
    log "INFO" "Waiting for StatefulSet $name to be ready..."
    kubectl wait --for=condition=ready pod -l app="$name" -n "$namespace" --timeout=600s
    
    # Restore data if backup was created
    if [[ -n "$backup_path" && "$name" == "postgres" ]]; then
        restore_postgres_data "$namespace" "$backup_path"
    fi
    
    log "SUCCESS" "StatefulSet $name recreated successfully"
}

# Function to safely apply StatefulSet with forbidden update handling
safe_apply_statefulset() {
    local manifest_file=$1
    local namespace=${2:-$NAMESPACE}
    local backup_data=${3:-true}
    
    # Extract StatefulSet name from manifest
    local name=$(yq eval '.metadata.name' "$manifest_file")
    
    if [[ -z "$name" || "$name" == "null" ]]; then
        log "ERROR" "Could not extract StatefulSet name from $manifest_file"
        return 1
    fi
    
    log "INFO" "Processing StatefulSet: $name"
    
    # Check for immutable field changes
    if check_immutable_fields "$name" "$namespace" "$manifest_file"; then
        log "WARNING" "Immutable field changes detected, recreation required"
        recreate_statefulset "$name" "$namespace" "$manifest_file" "$backup_data"
    else
        log "INFO" "No immutable field changes, applying normally"
        kubectl apply -f "$manifest_file"
        
        # Wait for rollout to complete
        kubectl rollout status statefulset/"$name" -n "$namespace" --timeout=300s || {
            log "WARNING" "StatefulSet rollout may not have completed successfully"
        }
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check yq
    if ! command -v yq &> /dev/null; then
        log "INFO" "Installing yq..."
        wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
        chmod +x /usr/local/bin/yq
    fi
    
    # Check jq
    if ! command -v jq &> /dev/null; then
        log "ERROR" "jq is not installed. Please install jq."
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    log "SUCCESS" "Prerequisites check completed"
}

# Function to show usage
show_usage() {
    echo "StatefulSet Manager Utility"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  apply <manifest_file> [namespace] [backup]  - Safely apply StatefulSet with forbidden update handling"
    echo "  check <name> <namespace> <manifest_file>    - Check for immutable field changes"
    echo "  recreate <name> <namespace> <manifest_file> - Force recreate StatefulSet"
    echo "  backup <namespace>                          - Backup PostgreSQL data"
    echo "  restore <namespace> <backup_path>           - Restore PostgreSQL data"
    echo ""
    echo "Examples:"
    echo "  $0 apply k8s/postgres.yaml cruvz-srt true"
    echo "  $0 check postgres cruvz-srt k8s/postgres.yaml"
    echo "  $0 recreate postgres cruvz-srt k8s/postgres.yaml"
}

# Main function
main() {
    if [[ $# -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    local command=$1
    shift
    
    check_prerequisites
    
    case $command in
        "apply")
            if [[ $# -lt 1 ]]; then
                log "ERROR" "apply command requires at least a manifest file"
                show_usage
                exit 1
            fi
            safe_apply_statefulset "$@"
            ;;
        "check")
            if [[ $# -lt 3 ]]; then
                log "ERROR" "check command requires name, namespace, and manifest file"
                show_usage
                exit 1
            fi
            check_immutable_fields "$1" "$2" "$3"
            ;;
        "recreate")
            if [[ $# -lt 3 ]]; then
                log "ERROR" "recreate command requires name, namespace, and manifest file"
                show_usage
                exit 1
            fi
            recreate_statefulset "$1" "$2" "$3" "${4:-true}"
            ;;
        "backup")
            if [[ $# -lt 1 ]]; then
                log "ERROR" "backup command requires namespace"
                show_usage
                exit 1
            fi
            backup_postgres_data "$1"
            ;;
        "restore")
            if [[ $# -lt 2 ]]; then
                log "ERROR" "restore command requires namespace and backup path"
                show_usage
                exit 1
            fi
            restore_postgres_data "$1" "$2"
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi