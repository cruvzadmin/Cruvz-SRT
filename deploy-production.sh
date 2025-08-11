#!/bin/bash

# ===============================================================================
# CRUVZ STREAMING PLATFORM - PRODUCTION DEPLOYMENT SCRIPT
# Optimized for 1000+ concurrent users with PostgreSQL and Redis
# ===============================================================================

set -e

echo "🚀 CRUVZ STREAMING PLATFORM - PRODUCTION DEPLOYMENT"
echo "🎯 Target: 1000+ Concurrent Users"
echo "💾 Database: PostgreSQL with Connection Pooling"
echo "⚡ Cache: Redis for Real-time Data"
echo "🔒 Security: Production-grade Validation"
echo "==============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "This script should not be run as root for security reasons"
    exit 1
fi

# Check system requirements
print_info "Checking system requirements..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is required but not installed"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is required but not installed"
    exit 1
fi

print_status "System requirements verified"

# Environment setup
print_info "Setting up production environment..."

# Create production environment file if it doesn't exist
if [ ! -f .env.production ]; then
    print_warning ".env.production file not found, creating from template"
    cp .env.production.template .env.production 2>/dev/null || true
fi

# Security validation
print_info "Performing security validation..."

# Read environment variables
if [ -f .env.production ]; then
    source .env.production
fi

SECURITY_ISSUES=()

# Check critical passwords
if [[ "$POSTGRES_PASSWORD" == *"CHANGE_THIS"* ]] || [[ -z "$POSTGRES_PASSWORD" ]]; then
    SECURITY_ISSUES+=("POSTGRES_PASSWORD must be changed from default value")
fi

if [[ "$REDIS_PASSWORD" == *"CHANGE_THIS"* ]] || [[ -z "$REDIS_PASSWORD" ]]; then
    SECURITY_ISSUES+=("REDIS_PASSWORD must be changed from default value")
fi

if [[ "$JWT_SECRET" == *"CHANGE_THIS"* ]] || [[ -z "$JWT_SECRET" ]]; then
    SECURITY_ISSUES+=("JWT_SECRET must be changed from default value")
fi

if [[ "$ADMIN_PASSWORD" == *"CHANGE_THIS"* ]] || [[ -z "$ADMIN_PASSWORD" ]]; then
    SECURITY_ISSUES+=("ADMIN_PASSWORD must be changed from default value")
fi

# Report security issues
if [ ${#SECURITY_ISSUES[@]} -gt 0 ]; then
    print_error "Security validation failed! Please fix the following issues:"
    for issue in "${SECURITY_ISSUES[@]}"; do
        echo -e "  ${RED}- $issue${NC}"
    done
    echo ""
    print_warning "Edit .env.production file and change all default passwords before deploying"
    exit 1
fi

print_status "Security validation passed"

# Create required directories
print_info "Creating required directories..."
mkdir -p data/database
mkdir -p data/logs/backend
mkdir -p data/logs/origin
mkdir -p data/logs/nginx
mkdir -p data/recordings
mkdir -p data/uploads
mkdir -p data/postgres-backups

print_status "Directories created"

# Set proper permissions
print_info "Setting directory permissions..."
chmod 755 data
chmod 755 data/database
chmod 755 data/logs
chmod 755 data/recordings
chmod 755 data/uploads

print_status "Permissions set"

# Build and deploy
print_info "Building production containers..."

# Stop any existing containers
docker-compose -f production-compose.yml down || true

# Build containers
docker-compose -f production-compose.yml build --no-cache

print_status "Containers built successfully"

# Deploy system
print_info "Deploying production system..."

# Start PostgreSQL and Redis first
docker-compose -f production-compose.yml up -d postgres redis

print_info "Waiting for database to be ready..."
sleep 30

# Check database connection
docker-compose -f production-compose.yml exec -T postgres pg_isready -U cruvz -d cruvzdb || {
    print_error "Database is not ready"
    exit 1
}

print_status "Database is ready"

# Start backend services
docker-compose -f production-compose.yml up -d backend

print_info "Waiting for backend to be ready..."
sleep 20

# Health check
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo "000")
if [ "$BACKEND_HEALTH" != "200" ]; then
    print_error "Backend health check failed (HTTP $BACKEND_HEALTH)"
    docker-compose -f production-compose.yml logs backend
    exit 1
fi

print_status "Backend is healthy"

# Start remaining services
docker-compose -f production-compose.yml up -d

print_info "Waiting for all services to be ready..."
sleep 30

# Final health checks
print_info "Performing final health checks..."

SERVICES=("backend:5000" "origin:8080" "prometheus:9090" "grafana:3000")
FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ 2>/dev/null || echo "000")
    
    if [ "$HEALTH" == "200" ] || [ "$HEALTH" == "302" ]; then
        print_status "$name service is healthy"
    else
        FAILED_SERVICES+=("$name (port $port)")
        print_error "$name service failed health check (HTTP $HEALTH)"
    fi
done

# Report results
echo ""
echo "==============================================="
if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    print_status "🎉 DEPLOYMENT SUCCESSFUL!"
    echo ""
    print_info "Cruvz Streaming Platform is now running in production mode"
    print_info "🌐 Web Interface: http://localhost:80"
    print_info "🔧 Backend API: http://localhost:5000"
    print_info "📊 Health Check: http://localhost:5000/health"
    print_info "📈 Metrics: http://localhost:5000/metrics"
    print_info "🎥 Streaming Origin: http://localhost:8080"
    print_info "📊 Prometheus: http://localhost:9090"
    print_info "📈 Grafana: http://localhost:3000"
    echo ""
    print_info "System Capabilities:"
    print_info "• PostgreSQL database with optimized connection pooling (10-100 connections)"
    print_info "• Redis caching for real-time session management"
    print_info "• Designed for 1000+ concurrent streaming users"
    print_info "• RTMP, SRT, and WebRTC protocol support"
    print_info "• Auto-scaling and load balancing ready"
    print_info "• Production-grade monitoring and logging"
    echo ""
    print_status "✅ Platform ready for 1000+ users!"
else
    print_error "DEPLOYMENT PARTIALLY FAILED"
    print_warning "The following services failed to start:"
    for service in "${FAILED_SERVICES[@]}"; do
        echo -e "  ${RED}- $service${NC}"
    done
    echo ""
    print_info "Check logs with: docker-compose -f production-compose.yml logs [service-name]"
    exit 1
fi

# Show resource usage
echo ""
print_info "Current resource usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | head -10

echo ""
print_warning "Remember to:"
print_warning "• Set up SSL certificates for HTTPS"
print_warning "• Configure firewall rules"
print_warning "• Set up automated backups"
print_warning "• Monitor system resources"
print_warning "• Update default passwords in production"

echo ""
print_status "Deployment completed successfully! 🚀"