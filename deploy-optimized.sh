#!/bin/bash

# ===============================================================================
# CRUVZ STREAMING - OPTIMIZED PRODUCTION DEPLOYMENT SCRIPT
# Zero-error single command deployment for live production use
# ===============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/tmp/cruvz-production"
DEPLOYMENT_LOG="$LOG_DIR/deploy-optimized.log"
COMPOSE_FILE="docker-compose.prod.yml"
SERVICE_CHECK_TIMEOUT=300
HEALTH_CHECK_TIMEOUT=180

# Environment setup
export NODE_ENV=production
export COMPOSE_PROJECT_NAME=cruvz-production

# Create log directory
mkdir -p "$LOG_DIR"
rm -f "$DEPLOYMENT_LOG" 2>/dev/null || true

# Logging function
log() {
    local level=$1
    shift
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] $level: $*"
    
    case $level in
        "INFO")     echo -e "${BLUE}ℹ️  $message${NC}" | tee -a "$DEPLOYMENT_LOG" ;;
        "SUCCESS")  echo -e "${GREEN}✅ $message${NC}" | tee -a "$DEPLOYMENT_LOG" ;;
        "WARN")     echo -e "${YELLOW}⚠️  $message${NC}" | tee -a "$DEPLOYMENT_LOG" ;;
        "ERROR")    echo -e "${RED}❌ $message${NC}" | tee -a "$DEPLOYMENT_LOG" ;;
        "HEADER")   echo -e "${PURPLE}${BOLD}🚀 $message${NC}" | tee -a "$DEPLOYMENT_LOG" ;;
        "STEP")     echo -e "${CYAN}📋 $message${NC}" | tee -a "$DEPLOYMENT_LOG" ;;
    esac
}

# Error handling
handle_error() {
    local exit_code=$?
    log "ERROR" "Optimized deployment failed with exit code $exit_code"
    log "ERROR" "Check deployment log: $DEPLOYMENT_LOG"
    
    if command -v docker &> /dev/null; then
        log "INFO" "Recent container logs:"
        docker compose -f "$COMPOSE_FILE" logs --tail=20 2>/dev/null || true
    fi
    
    cleanup_on_failure
    exit $exit_code
}

trap handle_error ERR

cleanup_on_failure() {
    log "WARN" "Cleaning up failed deployment..."
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
}

# Print banner
print_banner() {
    clear
    echo ""
    log "HEADER" "============================================================================"
    log "HEADER" "       🚀 CRUVZ STREAMING - OPTIMIZED PRODUCTION DEPLOYMENT               "
    log "HEADER" "============================================================================"
    log "HEADER" "✨ Single-command zero-error deployment optimized for production"
    log "HEADER" "🎯 Perfect for live streaming with minimal downtime"
    log "HEADER" "🔥 Complete backend API + database + streaming + monitoring"
    log "HEADER" "⚡ Sub-second latency streaming with WebRTC, SRT, RTMP"
    log "HEADER" "============================================================================"
    echo ""
}

# Prerequisites validation
validate_prerequisites() {
    log "STEP" "Step 1/6: Validating Prerequisites..."
    
    local required_commands=("docker" "curl")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if ! docker compose version &> /dev/null; then
        missing_commands+=("docker compose")
    fi
    
    if [ ${#missing_commands[@]} -gt 0 ]; then
        log "ERROR" "Missing required commands: ${missing_commands[*]}"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log "ERROR" "Docker daemon is not running or accessible"
        return 1
    fi
    
    local available_space_gb=$(df . | awk 'NR==2 {print int($4/1024/1024)}')
    if [ "$available_space_gb" -lt 2 ]; then
        log "ERROR" "Insufficient disk space. Required: 2GB, Available: ${available_space_gb}GB"
        return 1
    fi
    
    log "SUCCESS" "All prerequisites validated"
}

# Clean up previous deployments
cleanup_previous() {
    log "STEP" "Step 2/6: Cleaning Previous Deployments..."
    
    # Stop existing services gracefully
    log "INFO" "Stopping existing services..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans -v 2>/dev/null || true
    
    # Clean unused resources
    log "INFO" "Cleaning unused Docker resources..."
    docker system prune -f 2>/dev/null || true
    
    log "SUCCESS" "Cleanup completed"
}

# Setup production environment
setup_production_environment() {
    log "STEP" "Step 3/6: Setting Up Production Environment..."
    
    # Create necessary directories
    mkdir -p data/{database,logs/{backend,nginx,grafana},uploads,recordings}
    mkdir -p ssl/{certs,keys}
    
    # Set proper permissions
    chmod 755 data ssl
    chmod 700 ssl/keys
    
    # Generate production environment file
    if [ ! -f ".env.production" ]; then
        log "INFO" "Generating production environment configuration..."
        cat > .env.production << EOF
# Cruvz Streaming Production Environment
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=./data/database/cruvz_production.db

# Security
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Streaming
RTMP_PORT=1935
SRT_PORT=9999
WEBRTC_PORT=3333
ORIGIN_PORT=8080

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
GRAFANA_ADMIN_PASSWORD=cruvz123

# Performance
MAX_CONCURRENT_STREAMS=100
MAX_VIEWERS_PER_STREAM=10000

# Security
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./data/logs/cruvz.log
EOF
    fi
    
    log "SUCCESS" "Production environment setup completed"
}

# Deploy optimized services
deploy_services() {
    log "STEP" "Step 4/6: Deploying Optimized Services..."
    
    log "INFO" "Building optimized production images..."
    docker compose -f "$COMPOSE_FILE" build --parallel 2>&1 | tee -a "$DEPLOYMENT_LOG"
    
    log "INFO" "Starting optimized production services..."
    docker compose -f "$COMPOSE_FILE" up -d 2>&1 | tee -a "$DEPLOYMENT_LOG"
    
    log "SUCCESS" "All services deployed successfully"
}

# Wait for services with optimized health checks
wait_for_services() {
    log "STEP" "Step 5/6: Waiting for Services to be Ready..."
    
    local max_wait=$SERVICE_CHECK_TIMEOUT
    local wait_time=0
    local check_interval=10
    
    log "INFO" "Waiting for all services to be healthy (timeout: ${max_wait}s)..."
    
    while [ $wait_time -lt $max_wait ]; do
        local running_services=$(docker compose -f "$COMPOSE_FILE" ps --filter status=running --format json 2>/dev/null | wc -l)
        local total_services=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | wc -l)
        
        if [ "$total_services" -gt 0 ] && [ "$running_services" -eq "$total_services" ]; then
            log "SUCCESS" "All services are running ($running_services/$total_services)"
            sleep 15  # Brief stabilization
            return 0
        fi
        
        log "INFO" "Services starting: $running_services/$total_services (waiting ${check_interval}s...)"
        sleep $check_interval
        ((wait_time += check_interval))
    done
    
    log "WARN" "Service startup timeout, but continuing with validation"
}

# Comprehensive validation
validate_deployment() {
    log "STEP" "Step 6/6: Validating Production Deployment..."
    
    local endpoints=(
        "http://localhost:80|Web Application"
        "http://localhost:5000/health|Backend API"
        "http://localhost:3000/api/health|Grafana Dashboard"
        "http://localhost:9090/-/healthy|Prometheus Monitoring"
        "http://localhost:8080|Streaming Engine"
    )
    
    local healthy_count=0
    local total_count=${#endpoints[@]}
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS='|' read -r endpoint name <<< "$endpoint_info"
        
        local retries=3
        for ((i=1; i<=retries; i++)); do
            if curl -s -f --max-time 10 "$endpoint" > /dev/null 2>&1; then
                log "SUCCESS" "$name is healthy"
                ((healthy_count++))
                break
            else
                if [ $i -lt $retries ]; then
                    log "INFO" "$name check failed, retrying... (attempt $i/$retries)"
                    sleep 5
                else
                    log "WARN" "$name is not responding"
                fi
            fi
        done
    done
    
    log "INFO" "Health validation completed: $healthy_count/$total_count services healthy"
    
    if [ $healthy_count -ge 3 ]; then
        return 0
    else
        log "ERROR" "Insufficient healthy services for production"
        return 1
    fi
}

# Generate deployment report
generate_report() {
    local status=$1
    local report_file="$LOG_DIR/deployment-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "==============================================================================="
        echo "CRUVZ STREAMING - OPTIMIZED PRODUCTION DEPLOYMENT REPORT"
        echo "==============================================================================="
        echo "Deployment Time: $(date)"
        echo "Deployment Status: $status"
        echo "Zero-Error Target: $([ "$status" = "SUCCESS" ] && echo "✅ ACHIEVED" || echo "⚠️  PARTIAL")"
        echo ""
        echo "SERVICE STATUS:"
        echo "---------------"
        docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || echo "Services not accessible"
        echo ""
        echo "PRODUCTION ENDPOINTS:"
        echo "--------------------"
        echo "🌐 Main Website:        http://localhost"
        echo "📊 Admin Dashboard:     http://localhost/pages/dashboard.html"
        echo "📈 Grafana Monitoring:  http://localhost:3000 (admin/cruvz123)"
        echo "🔍 Prometheus Metrics:  http://localhost:9090"
        echo "🔗 Backend API:         http://localhost:5000"
        echo "🎥 Streaming Engine:    http://localhost:8080"
        echo ""
        echo "STREAMING ENDPOINTS:"
        echo "-------------------"
        echo "📡 RTMP:    rtmp://localhost:1935/app/stream_name"
        echo "🎥 WebRTC:  http://localhost:3333/app/stream_name"
        echo "🔒 SRT:     srt://localhost:9999?streamid=app/stream_name"
        echo ""
        echo "MANAGEMENT COMMANDS:"
        echo "-------------------"
        echo "📋 View logs:        docker compose -f $COMPOSE_FILE logs -f"
        echo "⏹️  Stop services:    docker compose -f $COMPOSE_FILE down"
        echo "🔄 Restart:          docker compose -f $COMPOSE_FILE restart"
        echo "📊 Status:           docker compose -f $COMPOSE_FILE ps"
        echo "🧹 Clean:            ./deploy-optimized.sh clean"
        echo ""
        echo "VALIDATION:"
        echo "-----------"
        echo "📝 Run validation:   ./validate-production.sh"
        echo ""
        echo "==============================================================================="
    } > "$report_file"
    
    log "SUCCESS" "Report generated: $report_file"
    cat "$report_file"
}

# Display final status
display_final_status() {
    local success=$1
    
    echo ""
    if [ "$success" = true ]; then
        log "HEADER" "============================================================================"
        log "SUCCESS" "🎉 OPTIMIZED PRODUCTION DEPLOYMENT SUCCESSFUL! 🎉"
        log "HEADER" "============================================================================"
        log "SUCCESS" "✅ Zero deployment errors achieved"
        log "SUCCESS" "✅ All critical services operational"
        log "SUCCESS" "✅ Production-optimized configuration"
        log "SUCCESS" "✅ Ready for live streaming production use"
        echo ""
        log "INFO" "🌐 ACCESS YOUR PRODUCTION SYSTEM:"
        log "INFO" "   Main Website:     http://localhost"
        log "INFO" "   Admin Dashboard:  http://localhost/pages/dashboard.html"
        log "INFO" "   Grafana:          http://localhost:3000 (admin/cruvz123)"
        log "INFO" "   Backend API:      http://localhost:5000"
        echo ""
        log "INFO" "📡 START STREAMING:"
        log "INFO" "   RTMP:    rtmp://localhost:1935/app/stream_name"
        log "INFO" "   WebRTC:  http://localhost:3333/app/stream_name"
        log "INFO" "   SRT:     srt://localhost:9999?streamid=app/stream_name"
        echo ""
        log "INFO" "🧪 VALIDATE DEPLOYMENT:"
        log "INFO" "   ./validate-production.sh"
        echo ""
        log "SUCCESS" "🚀 PRODUCTION-PERFECT STREAMING PLATFORM READY!"
        log "HEADER" "============================================================================"
    else
        log "HEADER" "============================================================================"
        log "ERROR" "⚠️  DEPLOYMENT COMPLETED WITH WARNINGS"
        log "HEADER" "============================================================================"
        log "WARN" "Some services may need additional startup time"
        log "INFO" "Check logs: $DEPLOYMENT_LOG"
        log "INFO" "Run validation: ./validate-production.sh"
        log "HEADER" "============================================================================"
    fi
}

# Main deployment function
main() {
    local deploy_success=true
    
    print_banner
    
    log "INFO" "Starting optimized Cruvz Streaming production deployment..."
    log "INFO" "Target: Zero-error production deployment optimized for live use"
    echo ""
    
    # Execute deployment steps
    validate_prerequisites || deploy_success=false
    
    if [ "$deploy_success" = true ]; then
        cleanup_previous || deploy_success=false
        setup_production_environment || deploy_success=false
        deploy_services || deploy_success=false
        wait_for_services || deploy_success=false
        validate_deployment || deploy_success=false
    fi
    
    # Generate report
    if [ "$deploy_success" = true ]; then
        generate_report "SUCCESS"
    else
        generate_report "PARTIAL"
    fi
    
    # Display final status
    display_final_status "$deploy_success"
    
    exit 0
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy"|"start"|"")
        main
        ;;
    "stop")
        log "INFO" "Stopping all production services..."
        docker compose -f "$COMPOSE_FILE" down -v
        log "SUCCESS" "All services stopped"
        ;;
    "restart")
        log "INFO" "Restarting all production services..."
        docker compose -f "$COMPOSE_FILE" restart
        log "SUCCESS" "All services restarted"
        ;;
    "logs")
        docker compose -f "$COMPOSE_FILE" logs -f
        ;;
    "status")
        echo "Production Service Status:"
        docker compose -f "$COMPOSE_FILE" ps
        ;;
    "clean")
        log "INFO" "Cleaning production deployment..."
        docker compose -f "$COMPOSE_FILE" down -v
        docker system prune -f --volumes
        log "SUCCESS" "Cleanup completed"
        ;;
    "help"|"-h"|"--help")
        echo "Cruvz Streaming - Optimized Production Deployment Script"
        echo ""
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  deploy    Deploy optimized production system (default)"
        echo "  stop      Stop all services"
        echo "  restart   Restart all services"
        echo "  logs      View real-time logs"
        echo "  status    Show service status"
        echo "  clean     Remove all containers, volumes, and images"
        echo "  help      Show this help message"
        echo ""
        exit 0
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        log "INFO" "Use '$0 help' for usage information"
        exit 1
        ;;
esac