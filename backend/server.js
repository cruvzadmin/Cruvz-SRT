require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import utilities and database - PostgreSQL ONLY for production
const db = require('./config/database');
const cache = require('./utils/cache');

// Robust logger fallback if logger utility fails
let logger;
try {
  logger = require('./utils/logger');
} catch (e) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };
}

// Import route modules
const authRoutes = require('./routes/auth');
const streamRoutes = require('./routes/streams');
const streamingRoutes = require('./routes/streaming');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const sixSigmaRoutes = require('./routes/sixSigma');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Dummy dbConfig for dev table creation (prevents ReferenceError if missing)
const dbConfig = (function() {
  try {
    return require('./config/dbConfig');
  } catch (e) {
    return {};
  }
})();

// Log server boot for debug
logger.info(`🟢 Starting server.js (env: ${process.env.NODE_ENV})`);

// Validate configuration - Production-ready requirements for all environments
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  logger.error('💥 CONFIGURATION ERROR: JWT_SECRET must be set and be at least 32 characters long');
  process.exit(1);
}
if (!process.env.POSTGRES_HOST) {
  logger.error('💥 CONFIGURATION ERROR: POSTGRES_HOST must be set');
  process.exit(1);
}
if (!process.env.REDIS_HOST) {
  logger.error('💥 CONFIGURATION ERROR: REDIS_HOST must be set');
  process.exit(1);
}

// Production security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for production
let corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin && corsOrigin.includes(',')) {
  corsOrigin = corsOrigin.split(',').map(o => o.trim());
} else if (!corsOrigin) {
  corsOrigin = ['http://localhost:3000', 'http://localhost:8080'];
}
const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10, // Limit each IP to 10 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database and cache connection status
let dbConnected = false;
let cacheConnected = false;

// Initialize database connection
async function initializeDatabase() {
  try {
    const usePostgres = process.env.USE_POSTGRES === 'true';
    const dbType = usePostgres ? 'PostgreSQL' : 'SQLite';
    logger.info(`🔄 Initializing ${dbType} database connection...`);
    if (usePostgres) {
      logger.info(`Database config: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB} as ${process.env.POSTGRES_USER}`);
    }
    
    // Test database connection with timeout
    const testQuery = db.raw('SELECT 1 as test').timeout(3000);
    const result = await testQuery;
    logger.info(`✅ Database test query successful`);
    
    // Run migrations in production if needed
    if (process.env.AUTO_MIGRATE === 'true') {
      logger.info('🔄 Running database migrations...');
      await db.migrate.latest();
      logger.info('✅ Database migrations completed');
    }
    
    dbConnected = true;
    logger.info(`✅ ${dbType} database connected successfully`);
    return true;
  } catch (error) {
    logger.error(`❌ Database connection failed:`, error.message);
    logger.error(`Database error details:`, error);
    dbConnected = false;
    
    if (process.env.NODE_ENV === 'production') {
      logger.error('💥 FATAL: Database connection required in production');
      throw error;
    }
    
    logger.warn('⚠️  Continuing without database connection (development mode)');
    return false;
  }
}

// Initialize cache connection
async function initializeCache() {
  try {
    const cacheType = 'Redis';
    logger.info(`🔄 Initializing ${cacheType} cache connection...`);
    
    await cache.init();
    if (cache.connect) {
      await cache.connect();
    }
    
    cacheConnected = cache.isConnected;
    logger.info(`✅ ${cacheType} cache connected successfully`);
    
    return true;
  } catch (error) {
    logger.error(`❌ Cache connection failed:`, error.message);
    cacheConnected = false;
    
    if (process.env.NODE_ENV === 'production') {
      logger.error('💥 FATAL: Cache connection required in production');
      throw error;
    }
    
    // For development, always report as connected to avoid health check failures
    cacheConnected = false;
    logger.warn('⚠️  Continuing without cache connection (development mode)');
    return false;
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthData = {
    status: 'healthy',
    service: 'cruvz-streaming-api',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  let overallStatus = 'healthy';

  // Check database connectivity
  try {
    if (dbConnected) {
      await db.raw('SELECT 1');
      healthData.database = { connected: true, type: 'postgresql' };
    } else {
      healthData.database = { connected: false, type: 'postgresql', error: 'No connection' };
      overallStatus = 'degraded';
    }
  } catch (error) {
    healthData.database = { connected: false, type: 'postgresql', error: error.message };
    overallStatus = 'degraded';
  }

  // Check Redis cache connectivity
  try {
    if (cacheConnected && cache.isConnected) {
      const pingResult = await cache.ping();
      healthData.cache = { connected: pingResult, type: 'redis' };
      if (!pingResult) {
        overallStatus = 'degraded';
      }
    } else {
      healthData.cache = { connected: false, type: 'redis', error: 'No connection' };
      overallStatus = 'degraded';
    }
  } catch (error) {
    healthData.cache = { connected: false, type: 'redis', error: error.message };
    overallStatus = 'degraded';
  }

  healthData.status = overallStatus;
  
  // In development, if database is connected, report as healthy even if cache is down
  if (process.env.NODE_ENV !== 'production' && dbConnected && overallStatus === 'degraded') {
    healthData.status = 'healthy';
  }

  // Return 503 if any critical service is down in production
  const statusCode = (overallStatus === 'degraded' && process.env.NODE_ENV === 'production') ? 503 : 200;
  res.status(statusCode).json(healthData);
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    
    // Get real metrics from database
    let activeStreams = 0;
    let totalUsers = 0;
    let activeUsers = 0;
    
    if (dbConnected) {
      try {
        const streamStats = await db('streams').where('status', 'active').count('* as count').first();
        activeStreams = streamStats ? parseInt(streamStats.count) : 0;
        
        const userStats = await db('users').count('* as total').first();
        totalUsers = userStats ? parseInt(userStats.total) : 0;
        
        const activeUserStats = await db('users').where('is_active', true).count('* as active').first();
        activeUsers = activeUserStats ? parseInt(activeUserStats.active) : 0;
      } catch (error) {
        logger.error('Metrics query error:', error);
      }
    }

    const metrics = `# HELP cruvz_up 1 if the API backend is up
# TYPE cruvz_up gauge
cruvz_up 1

# HELP cruvz_active_streams Number of currently active streams
# TYPE cruvz_active_streams gauge
cruvz_active_streams ${activeStreams}

# HELP cruvz_total_users Total number of registered users
# TYPE cruvz_total_users gauge  
cruvz_total_users ${totalUsers}

# HELP cruvz_active_users Number of active users
# TYPE cruvz_active_users gauge
cruvz_active_users ${activeUsers}

# HELP cruvz_database_connected 1 if database is connected
# TYPE cruvz_database_connected gauge
cruvz_database_connected ${dbConnected ? 1 : 0}

# HELP cruvz_cache_connected 1 if cache is connected
# TYPE cruvz_cache_connected gauge
cruvz_cache_connected ${cacheConnected ? 1 : 0}
`;

    res.send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

// Route middleware to ensure database connectivity for protected routes
function checkDatabaseConnection(req, res, next) {
  if (!dbConnected) {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      message: 'Database connection is not available. Please try again later.'
    });
  }
  next();
}

// API Routes - Using modular route files
app.use('/api/auth', authRoutes);
app.use('/api/streams', checkDatabaseConnection, streamRoutes);
app.use('/api/streaming', checkDatabaseConnection, streamingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', checkDatabaseConnection, userRoutes);
app.use('/api/six-sigma', checkDatabaseConnection, sixSigmaRoutes);

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Cruvz Streaming API v2.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user (protected)',
        'POST /api/auth/logout': 'Logout user (protected)'
      },
      streams: {
        'GET /api/streams': 'Get user streams (protected)',
        'POST /api/streams': 'Create new stream (protected)',
        'GET /api/streams/:id': 'Get stream details (protected)',
        'PUT /api/streams/:id': 'Update stream (protected)',
        'DELETE /api/streams/:id': 'Delete stream (protected)',
        'POST /api/streams/:id/start': 'Start stream (protected)',
        'POST /api/streams/:id/stop': 'Stop stream (protected)'
      },
      streaming: {
        'POST /api/streaming/webrtc/start': 'Start WebRTC session (protected)',
        'POST /api/streaming/webrtc/stop': 'Stop WebRTC session (protected)',
        'POST /api/streaming/srt/start': 'Start SRT session (protected)',
        'POST /api/streaming/srt/stop': 'Stop SRT session (protected)',
        'POST /api/streaming/rtmp/start': 'Start RTMP session (protected)',
        'POST /api/streaming/rtmp/stop': 'Stop RTMP session (protected)',
        'GET /api/streaming/status/:stream_id': 'Get streaming status (protected)'
      },
      analytics: {
        'GET /api/analytics/dashboard': 'Get dashboard analytics (protected)',
        'GET /api/analytics/streams/:id': 'Get stream analytics (protected)',
        'GET /api/analytics/system': 'Get system analytics (admin only)',
        'GET /api/analytics/realtime': 'Get real-time analytics (public)'
      },
      users: {
        'GET /api/users/profile': 'Get user profile (protected)',
        'PUT /api/users/profile': 'Update user profile (protected)'
      },
      sixSigma: {
        'GET /api/six-sigma/dashboard': 'Get Six Sigma dashboard (protected)',
        'GET /api/six-sigma/metrics': 'Get Six Sigma metrics (protected)'
      }
    },
    status: {
      database: dbConnected ? 'connected' : 'disconnected',
      cache: cacheConnected ? 'connected' : 'disconnected'
    }
  });
});

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist.`,
    available_endpoints: '/api'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } else {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Server startup function
async function startServer() {
  try {
    // Initialize database connection (required in production)
    try {
      await initializeDatabase();
      logger.info('✅ Database initialization completed');
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('💥 FATAL: Database connection required in production');
        process.exit(1);
      }
      logger.warn('⚠️  Continuing without database (development mode)');
    }

    // Initialize cache connection (required in production)
    try {
      await initializeCache();
      logger.info('✅ Cache initialization completed');
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('💥 FATAL: Cache connection required in production');
        process.exit(1);
      }
      logger.warn('⚠️  Continuing without cache (development mode)');
    }

    // Start the server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Cruvz Streaming API v2.0.0 running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🗄️  Database: ${dbConnected ? 'Connected (PostgreSQL)' : 'Disconnected'}`);
      logger.info(`🔗 Cache: ${cacheConnected ? 'Connected (Redis)' : 'Disconnected'}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`📖 API docs: http://localhost:${PORT}/api`);
      
      if (process.env.NODE_ENV === 'production') {
        logger.info('🔒 Production mode: All security features enabled');
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close database connection
        if (dbConnected && db) {
          try {
            await db.destroy();
            logger.info('Database connection closed');
          } catch (error) {
            logger.error('Error closing database:', error);
          }
        }
        
        // Close cache connection
        if (cacheConnected && cache) {
          try {
            await cache.disconnect();
            logger.info('Cache connection closed');
          } catch (error) {
            logger.error('Error closing cache:', error);
          }
        }
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    logger.error('💥 Server startup failed:', error);
    process.exit(1);
  }
}

// Export app for testing
module.exports = app;

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
