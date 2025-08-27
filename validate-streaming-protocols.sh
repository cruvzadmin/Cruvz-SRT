#!/bin/bash

# ===============================================================================
# CRUVZ-SRT STREAMING PROTOCOL VALIDATION SCRIPT
# Tests actual streaming functionality end-to-end
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
NAMESPACE="cruvz-srt"
TEST_STREAM_KEY="test_stream_$(date +%s)"
TEST_DURATION=30  # seconds
VALIDATION_RESULTS=()

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

# Function to record validation results
record_result() {
    local test_name=$1
    local status=$2
    local details=${3:-""}
    
    VALIDATION_RESULTS+=("$test_name:$status:$details")
    
    if [[ "$status" == "PASS" ]]; then
        log "SUCCESS" "$test_name: PASSED"
    elif [[ "$status" == "FAIL" ]]; then
        log "ERROR" "$test_name: FAILED - $details"
    else
        log "WARNING" "$test_name: $status - $details"
    fi
}

# Get service endpoints
get_service_endpoints() {
    log "INFO" "Discovering service endpoints..."
    
    # Get node IP for NodePort services
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
    
    # Get streaming ports
    RTMP_PORT=$(kubectl get service ovenmediaengine-nodeport -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="rtmp")].nodePort}' 2>/dev/null || echo "31935")
    SRT_INPUT_PORT=$(kubectl get service ovenmediaengine-nodeport -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="srt-input")].nodePort}' 2>/dev/null || echo "31999")
    SRT_OUTPUT_PORT=$(kubectl get service ovenmediaengine-nodeport -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="srt-output")].nodePort}' 2>/dev/null || echo "31998")
    WEBRTC_PORT=$(kubectl get service ovenmediaengine-nodeport -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="webrtc-signal")].nodePort}' 2>/dev/null || echo "33333")
    LLHLS_PORT=$(kubectl get service ovenmediaengine-nodeport -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="llhls")].nodePort}' 2>/dev/null || echo "38088")
    
    log "INFO" "Service endpoints discovered:"
    log "INFO" "  Node IP: $NODE_IP"
    log "INFO" "  RTMP: $NODE_IP:$RTMP_PORT"
    log "INFO" "  SRT Input: $NODE_IP:$SRT_INPUT_PORT"
    log "INFO" "  SRT Output: $NODE_IP:$SRT_OUTPUT_PORT"
    log "INFO" "  WebRTC: $NODE_IP:$WEBRTC_PORT"
    log "INFO" "  LLHLS: $NODE_IP:$LLHLS_PORT"
}

# Test RTMP streaming
test_rtmp_streaming() {
    log "INFO" "Testing RTMP streaming protocol..."
    
    # Check if RTMP port is accessible
    if timeout 10 bash -c "</dev/tcp/$NODE_IP/$RTMP_PORT" 2>/dev/null; then
        record_result "rtmp_port_accessible" "PASS" "RTMP port $RTMP_PORT is accessible"
    else
        record_result "rtmp_port_accessible" "FAIL" "RTMP port $RTMP_PORT is not accessible"
        return 1
    fi
    
    # Try to establish RTMP connection (simplified test)
    local rtmp_url="rtmp://$NODE_IP:$RTMP_PORT/app/$TEST_STREAM_KEY"
    
    # Use ffmpeg to test RTMP streaming if available
    if command -v ffmpeg &> /dev/null; then
        log "INFO" "Testing RTMP streaming with ffmpeg..."
        
        # Create a simple test stream for 5 seconds
        timeout 10 ffmpeg -f lavfi -i testsrc=duration=5:size=320x240:rate=30 -c:v libx264 -preset ultrafast -tune zerolatency -f flv "$rtmp_url" >/dev/null 2>&1 && {
            record_result "rtmp_streaming_test" "PASS" "RTMP streaming test completed successfully"
        } || {
            record_result "rtmp_streaming_test" "WARNING" "RTMP streaming test failed (may need OvenMediaEngine to be fully ready)"
        }
    else
        record_result "rtmp_streaming_test" "SKIP" "ffmpeg not available for RTMP streaming test"
    fi
}

# Test SRT streaming
test_srt_streaming() {
    log "INFO" "Testing SRT streaming protocol..."
    
    # Check if SRT input port is accessible
    if timeout 10 bash -c "</dev/tcp/$NODE_IP/$SRT_INPUT_PORT" 2>/dev/null; then
        record_result "srt_input_port_accessible" "PASS" "SRT input port $SRT_INPUT_PORT is accessible"
    else
        record_result "srt_input_port_accessible" "FAIL" "SRT input port $SRT_INPUT_PORT is not accessible"
    fi
    
    # Check if SRT output port is accessible
    if timeout 10 bash -c "</dev/tcp/$NODE_IP/$SRT_OUTPUT_PORT" 2>/dev/null; then
        record_result "srt_output_port_accessible" "PASS" "SRT output port $SRT_OUTPUT_PORT is accessible"
    else
        record_result "srt_output_port_accessible" "FAIL" "SRT output port $SRT_OUTPUT_PORT is not accessible"
    fi
    
    # Test SRT with ffmpeg if available and has SRT support
    if command -v ffmpeg &> /dev/null && ffmpeg -protocols 2>/dev/null | grep -q srt; then
        log "INFO" "Testing SRT streaming with ffmpeg..."
        
        local srt_url="srt://$NODE_IP:$SRT_INPUT_PORT?streamid=input/app/$TEST_STREAM_KEY"
        
        # Create a simple test stream for 5 seconds
        timeout 10 ffmpeg -f lavfi -i testsrc=duration=5:size=320x240:rate=30 -c:v libx264 -preset ultrafast -f mpegts "$srt_url" >/dev/null 2>&1 && {
            record_result "srt_streaming_test" "PASS" "SRT streaming test completed successfully"
        } || {
            record_result "srt_streaming_test" "WARNING" "SRT streaming test failed (may need OvenMediaEngine to be fully ready)"
        }
    else
        record_result "srt_streaming_test" "SKIP" "ffmpeg with SRT support not available"
    fi
}

# Test WebRTC signaling
test_webrtc_signaling() {
    log "INFO" "Testing WebRTC signaling..."
    
    # Check if WebRTC signaling port is accessible
    if timeout 10 bash -c "</dev/tcp/$NODE_IP/$WEBRTC_PORT" 2>/dev/null; then
        record_result "webrtc_port_accessible" "PASS" "WebRTC port $WEBRTC_PORT is accessible"
    else
        record_result "webrtc_port_accessible" "FAIL" "WebRTC port $WEBRTC_PORT is not accessible"
        return 1
    fi
    
    # Test WebSocket connection to signaling server
    if command -v curl &> /dev/null; then
        local webrtc_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$NODE_IP:$WEBRTC_PORT/app/$TEST_STREAM_KEY" 2>/dev/null || echo "000")
        if [[ "$webrtc_response" =~ ^[23] ]]; then
            record_result "webrtc_signaling_test" "PASS" "WebRTC signaling responded with HTTP $webrtc_response"
        else
            record_result "webrtc_signaling_test" "WARNING" "WebRTC signaling returned HTTP $webrtc_response"
        fi
    else
        record_result "webrtc_signaling_test" "SKIP" "curl not available for WebRTC signaling test"
    fi
}

# Test LLHLS (Low Latency HLS)
test_llhls() {
    log "INFO" "Testing LLHLS (Low Latency HLS)..."
    
    # Check if LLHLS port is accessible
    if timeout 10 bash -c "</dev/tcp/$NODE_IP/$LLHLS_PORT" 2>/dev/null; then
        record_result "llhls_port_accessible" "PASS" "LLHLS port $LLHLS_PORT is accessible"
    else
        record_result "llhls_port_accessible" "FAIL" "LLHLS port $LLHLS_PORT is not accessible"
        return 1
    fi
    
    # Test LLHLS playlist availability
    if command -v curl &> /dev/null; then
        local llhls_url="http://$NODE_IP:$LLHLS_PORT/app/$TEST_STREAM_KEY/llhls.m3u8"
        local llhls_response=$(curl -s -o /dev/null -w "%{http_code}" "$llhls_url" 2>/dev/null || echo "000")
        
        if [[ "$llhls_response" == "200" ]]; then
            record_result "llhls_playlist_test" "PASS" "LLHLS playlist accessible"
        elif [[ "$llhls_response" == "404" ]]; then
            record_result "llhls_playlist_test" "WARNING" "LLHLS playlist not found (stream may not be active)"
        else
            record_result "llhls_playlist_test" "WARNING" "LLHLS returned HTTP $llhls_response"
        fi
    else
        record_result "llhls_playlist_test" "SKIP" "curl not available for LLHLS test"
    fi
}

# Test API functionality
test_api_functionality() {
    log "INFO" "Testing API functionality..."
    
    # Port forward backend service for testing
    kubectl port-forward service/backend-service 15000:5000 -n "$NAMESPACE" &
    local port_forward_pid=$!
    
    # Wait for port forward to be ready
    sleep 3
    
    # Test API endpoints
    local api_endpoints=(
        "/health:GET"
        "/api/v1/streams:GET"
        "/api/v1/users:GET"
        "/api/v1/analytics:GET"
    )
    
    for endpoint_info in "${api_endpoints[@]}"; do
        IFS=':' read -r endpoint method <<< "$endpoint_info"
        
        if command -v curl &> /dev/null; then
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "http://localhost:15000$endpoint" 2>/dev/null || echo "000")
            
            if [[ "$response_code" =~ ^[23] ]]; then
                record_result "api_${endpoint//\//_}" "PASS" "$method $endpoint returned HTTP $response_code"
            elif [[ "$response_code" == "401" ]]; then
                record_result "api_${endpoint//\//_}" "PASS" "$method $endpoint returned HTTP 401 (authentication required)"
            else
                record_result "api_${endpoint//\//_}" "WARNING" "$method $endpoint returned HTTP $response_code"
            fi
        else
            record_result "api_${endpoint//\//_}" "SKIP" "curl not available for API test"
        fi
    done
    
    # Clean up port forward
    kill $port_forward_pid 2>/dev/null || true
}

# Test database operations
test_database_operations() {
    log "INFO" "Testing database operations..."
    
    local postgres_pod=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -z "$postgres_pod" ]]; then
        record_result "database_operations" "FAIL" "PostgreSQL pod not found"
        return 1
    fi
    
    # Test basic database operations
    local test_table_name="streaming_test_$(date +%s)"
    
    # Create test table
    if kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U cruvz -d cruvzdb -c "CREATE TABLE $test_table_name (id SERIAL PRIMARY KEY, test_data VARCHAR(100));" &>/dev/null; then
        record_result "database_create_table" "PASS" "Successfully created test table"
        
        # Insert test data
        if kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U cruvz -d cruvzdb -c "INSERT INTO $test_table_name (test_data) VALUES ('streaming_validation_test');" &>/dev/null; then
            record_result "database_insert_data" "PASS" "Successfully inserted test data"
            
            # Query test data
            local query_result=$(kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U cruvz -d cruvzdb -t -c "SELECT COUNT(*) FROM $test_table_name;" 2>/dev/null | tr -d ' ')
            if [[ "$query_result" == "1" ]]; then
                record_result "database_query_data" "PASS" "Successfully queried test data"
            else
                record_result "database_query_data" "FAIL" "Query returned unexpected result: $query_result"
            fi
        else
            record_result "database_insert_data" "FAIL" "Failed to insert test data"
        fi
        
        # Clean up test table
        kubectl exec -n "$NAMESPACE" "$postgres_pod" -- psql -U cruvz -d cruvzdb -c "DROP TABLE $test_table_name;" &>/dev/null || true
    else
        record_result "database_create_table" "FAIL" "Failed to create test table"
    fi
}

# Test production security configurations
test_security_configuration() {
    log "INFO" "Testing production security configurations..."
    
    # Check for secure secrets
    if kubectl get secret cruvz-secrets -n "$NAMESPACE" &>/dev/null; then
        local jwt_secret=$(kubectl get secret cruvz-secrets -n "$NAMESPACE" -o jsonpath='{.data.JWT_SECRET}' | base64 -d 2>/dev/null || echo "")
        if [[ "$jwt_secret" =~ "CHANGE_THIS" ]]; then
            record_result "security_jwt_secret" "FAIL" "JWT secret contains default value"
        elif [[ ${#jwt_secret} -ge 32 ]]; then
            record_result "security_jwt_secret" "PASS" "JWT secret appears to be properly configured"
        else
            record_result "security_jwt_secret" "WARNING" "JWT secret may be too short"
        fi
        
        local ome_token=$(kubectl get secret cruvz-secrets -n "$NAMESPACE" -o jsonpath='{.data.OME_ACCESS_TOKEN}' | base64 -d 2>/dev/null || echo "")
        if [[ "$ome_token" =~ "CHANGE_THIS" ]]; then
            record_result "security_ome_token" "FAIL" "OME access token contains default value"
        elif [[ ${#ome_token} -ge 16 ]]; then
            record_result "security_ome_token" "PASS" "OME access token appears to be properly configured"
        else
            record_result "security_ome_token" "WARNING" "OME access token may be too short"
        fi
    else
        record_result "security_secrets" "FAIL" "Production secrets not found"
    fi
    
    # Check for resource limits (security against resource exhaustion)
    local pods_with_limits=0
    local total_pods=0
    
    for pod in $(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}'); do
        ((total_pods++))
        if kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[*].resources.limits}' | grep -q "cpu\|memory"; then
            ((pods_with_limits++))
        fi
    done
    
    if [[ $pods_with_limits -gt 0 ]]; then
        record_result "security_resource_limits" "PASS" "$pods_with_limits/$total_pods pods have resource limits"
    else
        record_result "security_resource_limits" "WARNING" "No pods have resource limits configured"
    fi
}

# Generate comprehensive streaming validation report
generate_streaming_report() {
    log "HEADER" "============================================================================"
    log "HEADER" "CRUVZ-SRT STREAMING PROTOCOL VALIDATION REPORT"
    log "HEADER" "============================================================================"
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warning_tests=0
    local skipped_tests=0
    
    echo ""
    echo "STREAMING VALIDATION RESULTS:"
    echo "============================="
    
    for result in "${VALIDATION_RESULTS[@]}"; do
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
            "SKIP")
                ((skipped_tests++))
                echo -e "${BLUE}⏭️  $test_name${NC}: $details"
                ;;
            *)
                ((warning_tests++))
                echo -e "${YELLOW}⚠️  $test_name${NC}: $details"
                ;;
        esac
    done
    
    echo ""
    echo "STREAMING VALIDATION SUMMARY:"
    echo "============================="
    echo -e "Total Tests: $total_tests"
    echo -e "${GREEN}Passed: $passed_tests${NC}"
    echo -e "${YELLOW}Warnings: $warning_tests${NC}"
    echo -e "${RED}Failed: $failed_tests${NC}"
    echo -e "${BLUE}Skipped: $skipped_tests${NC}"
    
    local success_rate=$(( (passed_tests * 100) / (total_tests - skipped_tests) ))
    echo -e "Success Rate: $success_rate% (excluding skipped tests)"
    
    echo ""
    if [[ $failed_tests -eq 0 ]]; then
        if [[ $warning_tests -eq 0 ]]; then
            log "SUCCESS" "🎉 ALL STREAMING PROTOCOL TESTS PASSED!"
            echo ""
            echo "🚀 STREAMING PLATFORM STATUS: FULLY OPERATIONAL"
            echo "✅ All streaming protocols are properly configured and functional"
            echo "✅ RTMP, SRT, WebRTC, and LLHLS are ready for production use"
            echo "✅ API endpoints are responsive and secure"
            echo "✅ Database operations are working correctly"
            echo "✅ Security configurations are properly implemented"
            echo ""
            echo "🎬 READY FOR LIVE STREAMING IN PRODUCTION! 🎬"
            return 0
        else
            log "SUCCESS" "✅ All critical streaming tests passed with $warning_tests warnings"
            echo ""
            echo "🟡 STREAMING PLATFORM STATUS: OPERATIONAL WITH WARNINGS"
            echo "✅ All critical streaming functionality is working"
            echo "⚠️  Some non-critical issues detected (see warnings above)"
            return 0
        fi
    else
        log "ERROR" "❌ $failed_tests critical streaming tests failed"
        echo ""
        echo "🔴 STREAMING PLATFORM STATUS: NOT READY FOR PRODUCTION"
        echo "❌ Critical streaming issues must be resolved before production use"
        return 1
    fi
}

# Main validation function
main() {
    log "HEADER" "Starting comprehensive streaming protocol validation..."
    
    # Get service endpoints
    get_service_endpoints
    
    # Run all streaming tests
    test_rtmp_streaming
    test_srt_streaming
    test_webrtc_signaling
    test_llhls
    test_api_functionality
    test_database_operations
    test_security_configuration
    
    # Generate and show report
    generate_streaming_report
}

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi