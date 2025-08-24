# Cruvz-SRT Production Deployment Guide

## 🎯 Overview

This system is now configured for **production-only deployment** using PostgreSQL and Redis. All development fallbacks have been removed to ensure a robust, scalable deployment.

## ⚙️ Prerequisites

### Required Infrastructure

1. **PostgreSQL 14+ Server**
   - Database: `cruvzdb`
   - User: `cruvz` with full permissions
   - Host accessible from application server

2. **Redis 6+ Server**
   - Default configuration
   - Host accessible from application server

3. **Node.js 18+ Runtime**
   - npm or yarn package manager
   - PM2 for process management (recommended)

### Environment Configuration

The system requires these environment variables in `.env`:

```bash
# Database Configuration (PostgreSQL REQUIRED)
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_USER=cruvz
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=cruvzdb
DATABASE_URL=postgresql://cruvz:your-secure-password@your-postgres-host:5432/cruvzdb

# Redis Cache (REQUIRED)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT Configuration (REQUIRED)
JWT_SECRET=your-256-bit-secret-key-here-minimum-32-characters
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Application Settings
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-domain.com

# Admin Account (CHANGE DEFAULTS!)
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=your-secure-admin-password
```

## 🚀 Deployment Steps

### 1. Infrastructure Setup

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE cruvzdb;
CREATE USER cruvz WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE cruvzdb TO cruvz;
ALTER USER cruvz CREATEDB;
\q

# Install Redis
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/cruvzadmin/Cruvz-SRT.git
cd Cruvz-SRT

# Install dependencies
npm install
cd backend && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your production values

# Setup database
cd backend
node setup-db.js           # Create tables and indexes
node run-migrations.js     # Run migrations
node seed-production-data.js  # Create sample data

# Test configuration
node test-production-config.js  # Validate everything works
```

### 3. Production Startup

```bash
# Install PM2 for process management
npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Monitor
pm2 monitor
pm2 logs
```

## 🔧 Configuration Validation

Before going live, run the comprehensive test:

```bash
cd backend
node test-production-config.js
```

This validates:
- ✅ Environment variables
- ✅ PostgreSQL connectivity
- ✅ Redis connectivity
- ✅ Server configuration
- ✅ Sample data integrity

## 📊 Sample Data Included

The production seed creates:

### User Accounts
- **Admin**: `admin@cruvzstreaming.com` / `Adm1n_Test_2025!_Qx7R$$gL3`
- **Demo Streamer**: `demo.streamer@cruvz.com` / `Demo123!_Stream`
- **Test User**: `test.user@cruvz.com` / `TestUser123!`

### Live Streams
- **Gaming Stream**: 847 viewers (RTMP)
- **Music Production**: 234 viewers (WebRTC)
- **Tech Talk**: Recently ended (SRT)

### Analytics Data
- 7 days of historical stream analytics
- Geographic and device distribution data
- Six Sigma performance metrics (100+ data points)

## 🔒 Security Checklist

Before production deployment:

- [ ] Change all default passwords
- [ ] Use strong JWT secret (256-bit minimum)
- [ ] Enable PostgreSQL SSL
- [ ] Configure Redis AUTH
- [ ] Set up firewall rules
- [ ] Enable HTTPS with valid certificates
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting

## 📈 Monitoring & Health Checks

### Health Check Endpoint
```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "cache": "connected",
    "server": "operational"
  },
  "metrics": {
    "uptime": 86400,
    "activeStreams": 2,
    "totalViewers": 1081
  }
}
```

### Key Metrics to Monitor
- Database connection pool status
- Redis memory usage
- Active stream count
- Total concurrent viewers
- API response times
- Error rates

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Test connection manually
   psql -h localhost -U cruvz -d cruvzdb
   ```

2. **Redis Connection Failed**
   ```bash
   # Check Redis status
   sudo systemctl status redis-server
   
   # Test connection
   redis-cli ping
   ```

3. **Missing Environment Variables**
   ```bash
   # Validate .env file
   cd backend && node test-production-config.js
   ```

### Performance Optimization

For 1000+ concurrent users:

1. **Database Tuning**
   ```sql
   -- Optimize PostgreSQL for streaming workloads
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   ALTER SYSTEM SET max_connections = 200;
   ```

2. **Redis Configuration**
   ```bash
   # Optimize Redis for caching
   echo 'maxmemory 512mb' >> /etc/redis/redis.conf
   echo 'maxmemory-policy allkeys-lru' >> /etc/redis/redis.conf
   ```

3. **Application Scaling**
   ```bash
   # Run multiple instances with PM2
   pm2 scale app 4  # Scale to 4 processes
   ```

## 📞 Support

For production deployment support:
- Check logs: `pm2 logs`
- Monitor performance: `pm2 monitor`
- Health checks: `/api/health`

**⚠️ IMPORTANT**: This configuration is production-ready and requires actual PostgreSQL and Redis infrastructure. It will not work with mock data or in-memory alternatives.