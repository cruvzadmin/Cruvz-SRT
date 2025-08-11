const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('express-async-errors');
require('dotenv').config();

const logger = require('./utils/logger');
const cache = require('./utils/cache');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const streamRoutes = require('./routes/streams');
const analyticsRoutes = require('./routes/analytics');
const apiRoutes = require('./routes/api');
const sixSigmaRoutes = require('./routes/sixSigma');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Production environment setup for 1000+ users
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for production (behind reverse proxy/nginx)
app.set('trust proxy', 1);

// Advanced security middleware for production
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      scriptSrc: ['\'self\''],
      imgSrc: ['\'self\'', 'data:', 'https:'],
      connectSrc: ['\'self\'', 'ws:', 'wss:'],
      fontSrc: ['\'self\''],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'none\''],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Enhanced CORS for production streaming
app.use(cors({
  origin: isProduction 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://streaming.cruvz.com']
    : true,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key']
}));

// Production-optimized rate limiting for 1000+ users
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({ error: message });
  }
});

// Different rate limits for different endpoints
app.use('/api/auth', createRateLimiter(15 * 60 * 1000, 10, 'Too many authentication attempts'));
app.use('/api/streams', createRateLimiter(60 * 1000, 100, 'Too many streaming requests'));
app.use('/api', createRateLimiter(15 * 60 * 1000, 1000, 'API rate limit exceeded'));

// Enhanced logging for production
if (isProduction) {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
} else {
  app.use(morgan('dev'));
}

// Body parsing with size limits for streaming data
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Health check endpoint with production metrics
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      production: isProduction,
      uptime: process.uptime(),
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      services: {}
    };

    // Check database connection
    try {
      await db.raw('SELECT 1');
      health.services.database = 'connected';
    } catch (error) {
      health.services.database = 'disconnected';
      health.status = 'degraded';
      logger.error('Database health check failed:', error);
    }

    // Check Redis cache
    try {
      const redisHealth = await cache.ping();
      health.services.cache = redisHealth ? 'connected' : 'disconnected';
      if (!redisHealth) health.status = 'degraded';
    } catch (error) {
      health.services.cache = 'disconnected';
      health.status = 'degraded';
      logger.error('Redis health check failed:', error);
    }

    // Additional production metrics
    if (isProduction) {
      try {
        const dbStats = await db.raw('SELECT * FROM get_db_stats()');
        health.database_stats = dbStats.rows[0];
      } catch (error) {
        logger.error('Database stats error:', error);
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Production metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    };

    if (isProduction) {
      // Add streaming-specific metrics
      try {
        const activeStreams = await db('streams').where('status', 'active').count('* as count');
        const totalUsers = await db('users').where('is_active', true).count('* as count');
        const totalViewers = await db('stream_sessions')
          .whereNull('left_at')
          .count('* as count');

        metrics.streaming = {
          active_streams: parseInt(activeStreams[0].count),
          total_users: parseInt(totalUsers[0].count),
          current_viewers: parseInt(totalViewers[0].count)
        };
      } catch (error) {
        logger.error('Metrics collection error:', error);
      }
    }

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/keys', apiRoutes);
app.use('/api/six-sigma', sixSigmaRoutes);

// Serve static files in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../web-app')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../web-app/index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// Database initialization and security check
async function initializeDatabase() {
  try {
    logger.info('Initializing database connection...');
    
    // Test database connection
    await db.raw('SELECT 1');
    logger.info('✅ Database connection established');

    // Run migrations in production
    if (isProduction) {
      logger.info('Running database migrations...');
      await db.migrate.latest();
      logger.info('✅ Database migrations completed');

      // Run seeds only if no users exist
      const userCount = await db('users').count('* as count');
      if (parseInt(userCount[0].count) === 0) {
        logger.info('Running database seeds...');
        await db.seed.run();
        logger.info('✅ Database seeds completed');
      }
    }

    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

// Security validation for production
function performSecurityCheck() {
  const issues = [];
  
  if (isProduction) {
    // Check JWT secret
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('CHANGE_THIS')) {
      issues.push('JWT_SECRET contains default value - MUST be changed for production');
    }
    
    // Check admin password
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.includes('CHANGE_THIS')) {
      issues.push('ADMIN_PASSWORD contains default value - MUST be changed for production');
    }
    
    // Check PostgreSQL password
    if (!process.env.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD.includes('CHANGE_THIS')) {
      issues.push('POSTGRES_PASSWORD contains default value - MUST be changed for production');
    }
    
    // Check Redis password
    if (!process.env.REDIS_PASSWORD || process.env.REDIS_PASSWORD.includes('CHANGE_THIS')) {
      issues.push('REDIS_PASSWORD contains default value - MUST be changed for production');
    }
  }
  
  if (issues.length > 0) {
    logger.error('Security validation failed:');
    issues.forEach(issue => logger.error(`- ${issue}`));
    return false;
  }
  
  logger.info('✅ Security validation passed');
  return true;
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  try {
    await db.destroy();
    logger.info('Database connections closed');
    
    await cache.disconnect();
    logger.info('Redis cache disconnected');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server with proper initialization
async function startServer() {
  try {
    // Security check
    if (!performSecurityCheck()) {
      logger.error('Security validation failed - stopping server startup');
      process.exit(1);
    }
    
    // Initialize database
    await initializeDatabase();
    
    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Cruvz Streaming Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🎯 Production optimized for 1000+ users: ${isProduction}`);
      logger.info('💾 Database: PostgreSQL with connection pooling');
      logger.info('⚡ Cache: Redis for session management');
      logger.info('🔒 Security: Enhanced production safeguards');
      
      if (!isProduction) {
        logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
        logger.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
      }
    });

    // Increase server timeout for streaming operations
    server.timeout = 120000; // 2 minutes
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server only if this is the main module
if (require.main === module) {
  startServer();
}

module.exports = app;