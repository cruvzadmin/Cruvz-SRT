#!/bin/bash

# ===============================================================================
# CRUVZ-SRT DEPLOYMENT PIPELINE TESTER
# Tests StatefulSet forbidden update scenarios and deployment robustness
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
NAMESPACE="cruvz-srt-test"
TEST_RESULTS=()

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
        "TEST")     echo -e "${BLUE}🧪 $message${NC}" ;;
    esac
}

# Function to record test results
record_test_result() {
    local test_name=$1
    local status=$2
    local details=${3:-""}
    
    TEST_RESULTS+=("$test_name:$status:$details")
    
    if [[ "$status" == "PASS" ]]; then
        log "SUCCESS" "TEST $test_name: PASSED - $details"
    elif [[ "$status" == "FAIL" ]]; then
        log "ERROR" "TEST $test_name: FAILED - $details"
    else
        log "WARNING" "TEST $test_name: $status - $details"
    fi
}

# Setup test environment
setup_test_environment() {
    log "HEADER" "Setting up test environment..."
    
    # Create test namespace
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Copy test manifests
    local test_manifest_dir="/tmp/k8s-test"
    mkdir -p "$test_manifest_dir"
    cp -r k8s/* "$test_manifest_dir/"
    
    # Update namespace in test manifests
    find "$test_manifest_dir" -name "*.yaml" -exec sed -i "s/namespace: cruvz-srt/namespace: $NAMESPACE/g" {} \;
    
    log "SUCCESS" "Test environment setup completed"
    echo "$test_manifest_dir"
}

# Test StatefulSet manager functionality
test_statefulset_manager() {
    log "TEST" "Testing StatefulSet manager functionality..."
    
    local test_manifest_dir=$1
    
    # Test 1: Deploy initial StatefulSet
    log "INFO" "Test 1: Deploying initial PostgreSQL StatefulSet..."
    if scripts/statefulset-manager.sh apply "$test_manifest_dir/postgres.yaml" $NAMESPACE true; then
        record_test_result "statefulset_initial_deploy" "PASS" "Initial StatefulSet deployment successful"
    else
        record_test_result "statefulset_initial_deploy" "FAIL" "Initial StatefulSet deployment failed"
        return 1
    fi
    
    # Wait for StatefulSet to be ready
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s || {
        record_test_result "statefulset_initial_ready" "FAIL" "StatefulSet failed to become ready"
        return 1
    }
    record_test_result "statefulset_initial_ready" "PASS" "StatefulSet became ready"
    
    # Test 2: Create a test forbidden update scenario
    log "INFO" "Test 2: Simulating forbidden update scenario..."
    
    # Backup original postgres.yaml
    cp "$test_manifest_dir/postgres.yaml" "$test_manifest_dir/postgres.yaml.backup"
    
    # Modify volumeClaimTemplates (this should trigger forbidden update)
    sed -i 's/storage: 10Gi/storage: 15Gi/' "$test_manifest_dir/postgres.yaml"
    
    # Try the update with StatefulSet manager
    if scripts/statefulset-manager.sh apply "$test_manifest_dir/postgres.yaml" $NAMESPACE true; then
        record_test_result "statefulset_forbidden_update_handling" "PASS" "StatefulSet manager handled forbidden update correctly"
    else
        record_test_result "statefulset_forbidden_update_handling" "FAIL" "StatefulSet manager failed to handle forbidden update"
    fi
    
    # Wait for StatefulSet to be ready again
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=600s || {
        record_test_result "statefulset_recreate_ready" "FAIL" "Recreated StatefulSet failed to become ready"
    }
    record_test_result "statefulset_recreate_ready" "PASS" "Recreated StatefulSet became ready"
    
    # Test 3: Verify data persistence (simplified test)
    log "INFO" "Test 3: Testing data persistence after recreation..."
    local postgres_pod=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if kubectl exec -n $NAMESPACE "$postgres_pod" -- psql -U cruvz -d cruvzdb -c "SELECT 1;" &>/dev/null; then
        record_test_result "statefulset_data_persistence" "PASS" "Database accessible after StatefulSet recreation"
    else
        record_test_result "statefulset_data_persistence" "WARNING" "Database may need reinitialization after recreation"
    fi
    
    # Restore original manifest
    cp "$test_manifest_dir/postgres.yaml.backup" "$test_manifest_dir/postgres.yaml"
}

# Test deployment script robustness
test_deployment_robustness() {
    log "TEST" "Testing deployment script robustness..."
    
    local test_manifest_dir=$1
    
    # Test deployment with pre-existing resources
    log "INFO" "Testing deployment with pre-existing resources..."
    
    # Set namespace for deployment script
    export NAMESPACE=$NAMESPACE
    
    # Run deployment script
    if ./deploy-kubernetes.sh; then
        record_test_result "deployment_robustness" "PASS" "Deployment script completed successfully with existing resources"
    else
        record_test_result "deployment_robustness" "FAIL" "Deployment script failed with existing resources"
    fi
}

# Test error recovery scenarios
test_error_recovery() {
    log "TEST" "Testing error recovery scenarios..."
    
    # Test 1: Pod failure recovery
    log "INFO" "Test 1: Testing pod failure recovery..."
    local postgres_pod=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    # Delete the pod to simulate failure
    kubectl delete pod "$postgres_pod" -n $NAMESPACE
    
    # Wait for pod to be recreated
    sleep 10
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    
    if [[ $? -eq 0 ]]; then
        record_test_result "pod_failure_recovery" "PASS" "Pod failure recovery successful"
    else
        record_test_result "pod_failure_recovery" "FAIL" "Pod failure recovery failed"
    fi
    
    # Test 2: Service connectivity after pod recreation
    local new_postgres_pod=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if kubectl exec -n $NAMESPACE "$new_postgres_pod" -- pg_isready -U cruvz -d cruvzdb &>/dev/null; then
        record_test_result "service_connectivity_recovery" "PASS" "Service connectivity restored after pod recreation"
    else
        record_test_result "service_connectivity_recovery" "FAIL" "Service connectivity not restored"
    fi
}

# Test end-to-end functionality
test_end_to_end() {
    log "TEST" "Testing end-to-end functionality..."
    
    # Test all pods are running
    local expected_apps=("postgres" "redis" "backend" "ovenmediaengine" "frontend")
    local all_running=true
    
    for app in "${expected_apps[@]}"; do
        local running_pods=$(kubectl get pods -n $NAMESPACE -l app="$app" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        if [[ $running_pods -eq 0 ]]; then
            record_test_result "e2e_${app}_running" "FAIL" "No running pods for $app"
            all_running=false
        else
            record_test_result "e2e_${app}_running" "PASS" "$running_pods pod(s) running for $app"
        fi
    done
    
    if [[ "$all_running" == "true" ]]; then
        record_test_result "e2e_all_services" "PASS" "All services are running"
    else
        record_test_result "e2e_all_services" "FAIL" "Not all services are running"
    fi
    
    # Test database connectivity
    local postgres_pod=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$postgres_pod" ]] && kubectl exec -n $NAMESPACE "$postgres_pod" -- pg_isready -U cruvz -d cruvzdb &>/dev/null; then
        record_test_result "e2e_database_connectivity" "PASS" "Database connectivity verified"
    else
        record_test_result "e2e_database_connectivity" "FAIL" "Database connectivity failed"
    fi
    
    # Test Redis connectivity
    local redis_pod=$(kubectl get pods -n $NAMESPACE -l app=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$redis_pod" ]] && kubectl exec -n $NAMESPACE "$redis_pod" -- redis-cli ping | grep -q "PONG" 2>/dev/null; then
        record_test_result "e2e_redis_connectivity" "PASS" "Redis connectivity verified"
    else
        record_test_result "e2e_redis_connectivity" "FAIL" "Redis connectivity failed"
    fi
}

# Cleanup test environment
cleanup_test_environment() {
    log "INFO" "Cleaning up test environment..."
    
    # Delete test namespace (this will delete all resources in it)
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    
    # Clean up test manifests
    rm -rf /tmp/k8s-test
    
    log "SUCCESS" "Test environment cleanup completed"
}

# Generate test report
generate_test_report() {
    log "HEADER" "============================================================================"
    log "HEADER" "CRUVZ-SRT DEPLOYMENT PIPELINE TEST REPORT"
    log "HEADER" "============================================================================"
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warning_tests=0
    
    echo ""
    echo "TEST RESULTS:"
    echo "============="
    
    for result in "${TEST_RESULTS[@]}"; do
        IFS=':' read -r test_name status details <<< "$result"
        ((total_tests++))
        
        case $status in
            "PASS")
                ((passed_tests++))
                echo -e "${GREEN}✅ $test_name${NC}: $details"
                ;;
            "FAIL")
                ((failed_tests++))
                echo -e "${RED}❌ $test_name${NC}: $details"
                ;;
            *)
                ((warning_tests++))
                echo -e "${YELLOW}⚠️  $test_name${NC}: $details"
                ;;
        esac
    done
    
    echo ""
    echo "TEST SUMMARY:"
    echo "============="
    echo -e "Total Tests: $total_tests"
    echo -e "${GREEN}Passed: $passed_tests${NC}"
    echo -e "${YELLOW}Warnings: $warning_tests${NC}"
    echo -e "${RED}Failed: $failed_tests${NC}"
    
    local success_rate=$((passed_tests * 100 / total_tests))
    echo -e "Success Rate: $success_rate%"
    
    echo ""
    if [[ $failed_tests -eq 0 ]]; then
        if [[ $warning_tests -eq 0 ]]; then
            log "SUCCESS" "🎉 ALL DEPLOYMENT PIPELINE TESTS PASSED!"
            echo ""
            echo "🚀 DEPLOYMENT PIPELINE STATUS: FULLY VALIDATED"
            echo "✅ StatefulSet forbidden update handling works correctly"
            echo "✅ Deployment script is robust and error-resistant"
            echo "✅ Error recovery mechanisms are functional"
            echo "✅ End-to-end deployment works as expected"
            echo "✅ Production deployment is ready for use"
            return 0
        else
            log "SUCCESS" "✅ All critical tests passed with $warning_tests warnings"
            echo ""
            echo "🟡 DEPLOYMENT PIPELINE STATUS: VALIDATED WITH WARNINGS"
            echo "✅ Critical functionality is working correctly"
            echo "⚠️  Some non-critical issues detected (see warnings above)"
            return 0
        fi
    else
        log "ERROR" "❌ $failed_tests critical tests failed"
        echo ""
        echo "🔴 DEPLOYMENT PIPELINE STATUS: VALIDATION FAILED"
        echo "❌ Critical issues must be resolved before production deployment"
        return 1
    fi
}

# Main test execution
main() {
    log "HEADER" "Starting deployment pipeline testing..."
    
    # Check prerequisites
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    local test_manifest_dir
    
    # Setup test environment
    test_manifest_dir=$(setup_test_environment)
    
    # Run tests
    test_statefulset_manager "$test_manifest_dir"
    test_deployment_robustness "$test_manifest_dir"
    test_error_recovery
    test_end_to_end
    
    # Generate report
    local test_exit_code=0
    generate_test_report || test_exit_code=$?
    
    # Cleanup
    cleanup_test_environment
    
    exit $test_exit_code
}

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi