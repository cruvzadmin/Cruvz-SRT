require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import utilities and database - with fallback for development
const knex = require('knex');
const knexConfig = require('./knexfile');
let db;

// Try to initialize database with fallback
try {
  db = knex(knexConfig[process.env.NODE_ENV || 'production']); // Always use production for deployment
} catch (error) {
  console.error('❌ Database configuration failed:', error);
  process.exit(1); // No mock fallback
}

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
const protocolsRoutes = require('./routes/protocols');
const transcodingRoutes = require('./routes/transcoding');
const recordingsRoutes = require('./routes/recordings');
const publishingRoutes = require('./routes/publishing');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const sixSigmaRoutes = require('./routes/sixSigma');
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Fix Express trust proxy configuration for correct client IP in rate limiting
app.set('trust proxy', true);

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

// Validate configuration - Production-ready requirements
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  logger.error('💥 CONFIGURATION ERROR: JWT_SECRET must be set and be at least 32 characters long');
  process.exit(1);
}

// Database and Redis are required for production deployment - no fallback
if (isProduction && !process.env.POSTGRES_HOST) {
  logger.error('💥 CONFIGURATION ERROR: POSTGRES_HOST must be set for production deployment');
  process.exit(1);
}
if (isProduction && !process.env.REDIS_HOST) {
  logger.error('💥 CONFIGURATION ERROR: REDIS_HOST must be set for production deployment');
  process.exit(1);
}

// Production security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https:'],
      scriptSrc: ['\'self\'', '\'unsafe-inline\''],
      imgSrc: ['\'self\'', 'data:', 'https:'],
      connectSrc: ['\'self\'', 'ws:', 'wss:'],
      fontSrc: ['\'self\''],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'self\''],
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
    logger.info('🔄 Initializing database connection...');
    logger.info(`Database config: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB} as ${process.env.POSTGRES_USER}`);

    // Test database connection with timeout
    const testQuery = db.raw('SELECT 1 as test').timeout(5000);
    const result = await testQuery;
    logger.info('✅ Database test query successful');

    // Run migrations in production if needed
    if (process.env.AUTO_MIGRATE === 'true') {
      logger.info('🔄 Running database migrations...');
      await db.migrate.latest();
      logger.info('✅ Database migrations completed');
    }

    dbConnected = true;
    logger.info('✅ PostgreSQL database connected successfully');
    return true;
  } catch (error) {
    logger.error('❌ PostgreSQL database connection failed:', error.message);
    logger.error('Database error details:', error);

    // PostgreSQL is mandatory for production deployment
    logger.error('💥 FATAL: PostgreSQL database connection required for production deployment');
    throw error;
  }
}

// Initialize cache connection
async function initializeCache() {
  try {
    logger.info('🔄 Initializing cache connection...');
    
    await cache.init();
    if (cache.connect) {
      await cache.connect();
    }
    
    cacheConnected = cache.isConnected;
    logger.info('✅ Redis cache connected successfully');
    
    return true;
  } catch (error) {
    logger.error('❌ Redis cache connection failed:', error.message);
    cacheConnected = false;
    
    // Cache is important but not mandatory - use fallback
    logger.warn('⚠️  Redis cache not available - running without cache in production (performance may be affected)');
    return false;
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthData = {
    success: true,
    status: 'healthy',
    service: 'cruvz-streaming-api',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'production'
  };

  let overallStatus = 'healthy';

  // Check database connectivity
  try {
    if (dbConnected) {
      await db.raw('SELECT 1');
      healthData.database = { connected: true, type: 'postgresql' };
    } else {
      healthData.database = { connected: false, type: 'postgresql', error: 'No connection' };
      overallStatus = 'down';
    }
  } catch (error) {
    healthData.database = { connected: false, type: 'postgresql', error: error.message };
    overallStatus = 'down';
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
      overallStatus = (overallStatus === 'healthy') ? 'degraded' : overallStatus;
    }
  } catch (error) {
    healthData.cache = { connected: false, type: 'redis', error: error.message };
    overallStatus = (overallStatus === 'healthy') ? 'degraded' : overallStatus;
  }

  healthData.status = overallStatus;

  // Corrected logic: Only return 503 if database is "down", otherwise 200
  const statusCode = (overallStatus === 'down') ? 503 : 200;
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
  if (!dbConnected && isProduction) {
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
app.use('/api/streaming', checkDatabaseConnection, protocolsRoutes);
app.use('/api/transcoding', checkDatabaseConnection, transcodingRoutes);
app.use('/api/recordings', checkDatabaseConnection, recordingsRoutes);
app.use('/api/publishing', checkDatabaseConnection, publishingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', checkDatabaseConnection, userRoutes);
app.use('/api/six-sigma', checkDatabaseConnection, sixSigmaRoutes);
app.use('/api/keys', checkDatabaseConnection, apiRoutes);
app.use('/api/health', healthRoutes);

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Cruvz Streaming API v2.0.0',
    environment: process.env.NODE_ENV || 'production',
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
        'POST /api/streaming/llhls/start': 'Start Low Latency HLS session (protected)',
        'POST /api/streaming/ovt/start': 'Start OVT session (protected)',
        'POST /api/streaming/recording/start': 'Start recording (protected)',
        'POST /api/streaming/recording/stop': 'Stop recording (protected)',
        'POST /api/streaming/transcode/configure': 'Configure transcoding (protected)',
        'POST /api/streaming/push/configure': 'Configure push publishing (protected)',
        'GET /api/streaming/status/:stream_id': 'Get streaming status (protected)',
        'GET /api/streaming/protocols/status': 'Get all protocols status (protected)',
        'GET /api/streaming/protocols/:protocol/status': 'Get protocol status (protected)',
        'POST /api/streaming/protocols/:protocol/test': 'Test protocol connection (protected)',
        'GET /api/streaming/protocols/:protocol/config': 'Get protocol config (protected)',
        'PUT /api/streaming/protocols/:protocol/config': 'Update protocol config (protected)',
        'GET /api/streaming/ome/stats': 'Get OvenMediaEngine stats (protected)',
        'GET /api/streaming/ome/applications': 'Get OME applications (protected)',
        'GET /api/streaming/ome/streams': 'Get OME streams (protected)'
      },
      transcoding: {
        'GET /api/transcoding/profiles': 'Get transcoding profiles (protected)',
        'POST /api/transcoding/profiles': 'Create transcoding profile (protected)',
        'PUT /api/transcoding/profiles/:id': 'Update transcoding profile (protected)',
        'DELETE /api/transcoding/profiles/:id': 'Delete transcoding profile (protected)',
        'GET /api/transcoding/jobs': 'Get transcoding jobs (protected)',
        'POST /api/transcoding/jobs': 'Start transcoding job (protected)',
        'GET /api/transcoding/jobs/:id': 'Get transcoding job details (protected)',
        'POST /api/transcoding/jobs/:id/cancel': 'Cancel transcoding job (protected)',
        'GET /api/transcoding/stats': 'Get transcoding statistics (protected)'
      },
      recordings: {
        'GET /api/recordings': 'Get user recordings (protected)',
        'GET /api/recordings/:id': 'Get recording details (protected)',
        'POST /api/recordings/:id/download': 'Generate download link (protected)',
        'GET /api/recordings/download/:token': 'Download recording file (public with token)',
        'DELETE /api/recordings/:id': 'Delete recording (protected)',
        'POST /api/recordings/:id/share': 'Generate share link (protected)',
        'POST /api/recordings/upload': 'Upload recording file (protected)',
        'GET /api/recordings/stats': 'Get recording statistics (protected)'
      },
      publishing: {
        'GET /api/publishing/targets': 'Get publishing targets (protected)',
        'POST /api/publishing/targets': 'Create publishing target (protected)',
        'PUT /api/publishing/targets/:id': 'Update publishing target (protected)',
        'DELETE /api/publishing/targets/:id': 'Delete publishing target (protected)',
        'POST /api/publishing/targets/:id/connect': 'Connect to target (protected)',
        'POST /api/publishing/targets/:id/disconnect': 'Disconnect from target (protected)',
        'GET /api/publishing/targets/:id/status': 'Get target status (protected)',
        'GET /api/publishing/analytics': 'Get publishing analytics (protected)'
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
      keys: {
        'GET /api/keys': 'Get user API keys (protected)',
        'POST /api/keys': 'Create new API key (protected)',
        'PUT /api/keys/:id': 'Update API key (protected)',
        'DELETE /api/keys/:id': 'Delete API key (protected)',
        'POST /api/keys/:id/regenerate': 'Regenerate API key (protected)',
        'GET /api/keys/:id/usage': 'Get API key usage statistics (protected)'
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
    // Initialize database connection (required for production deployment)
    try {
      await initializeDatabase();
      logger.info('✅ Database initialization completed');
    } catch (error) {
      logger.error('💥 FATAL: PostgreSQL database connection required for production deployment');
      process.exit(1);
    }

    // Initialize cache connection (important for production deployment)
    try {
      await initializeCache();
      logger.info('✅ Cache initialization completed');
    } catch (error) {
      logger.warn('⚠️  Redis cache connection failed - continuing without cache in production (performance may be affected)');
    }

    // Start the server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Cruvz Streaming API v2.0.0 running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
      logger.info(`🗄️  Database: ${dbConnected ? 'Connected (PostgreSQL)' : 'Disconnected'}`);
      logger.info(`🔗 Cache: ${cacheConnected ? 'Connected (Redis)' : 'Disconnected'}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`📖 API docs: http://localhost:${PORT}/api`);
      
      if (process.env.NODE_ENV === 'production') {
        logger.info('🔒 Production mode: All security features enabled');
      }
    });

    // Setup Socket.IO for real-time analytics
    const io = setupSocketIO(server);
    logger.info('🔌 Socket.IO enabled for real-time analytics');

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

// Export app, database, and io for testing and route modules
module.exports = { app, db };

// Setup Socket.IO for real-time analytics
function setupSocketIO(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Middleware for Socket.IO authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userEmail = decoded.email;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    } else {
      next(new Error('Authentication error'));
    }
  });

  // Handle connections
  io.on('connection', (socket) => {
    logger.info(`User ${socket.userEmail} connected to real-time analytics`);
    
    // Join user to their personal analytics room
    socket.join(`user_${socket.userId}`);
    
    // Handle analytics subscription
    socket.on('subscribe_analytics', (data) => {
      logger.info(`User ${socket.userEmail} subscribed to analytics: ${data.type}`);
      
      // Send initial data
      socket.emit('analytics_data', {
        type: data.type,
        timestamp: new Date(),
        data: generateRealtimeAnalytics(socket.userId, data.type)
      });
    });
    
    socket.on('disconnect', () => {
      logger.info(`User ${socket.userEmail} disconnected from real-time analytics`);
    });
  });

  // Broadcast real-time analytics every 5 seconds
  setInterval(() => {
    io.emit('analytics_update', {
      timestamp: new Date(),
      data: generateRealtimeAnalytics(null, 'global')
    });
  }, 5000);

  return io;
}

// Generate real-time analytics data from actual database
async function generateRealtimeAnalytics(userId, type) {
  try {
    // Get real data from database
    const streamCount = await db('streams').where('status', 'active').count('* as count');
    const viewerCount = await db('stream_sessions').where('status', 'active').count('* as count');
    
    const baseData = {
      active_streams: parseInt(streamCount[0]?.count) || 0,
      total_viewers: parseInt(viewerCount[0]?.count) || 0,
      avg_latency: 85, // Would come from OvenMediaEngine
      bandwidth_usage: '0.00', // Would come from actual monitoring
      cpu_usage: '0.0', // Would come from system monitoring
      memory_usage: '0.0' // Would come from system monitoring
    };

    if (type === 'user' && userId) {
      // User-specific real data
      const userStreams = await db('streams').where({ user_id: userId, status: 'active' }).count('* as count');
      const userViewers = await db('stream_sessions')
        .join('streams', 'stream_sessions.stream_id', 'streams.id')
        .where({ 'streams.user_id': userId, 'stream_sessions.status': 'active' })
        .count('* as count');
      
      return {
        ...baseData,
        user_streams: parseInt(userStreams[0]?.count) || 0,
        user_viewers: parseInt(userViewers[0]?.count) || 0
      };
    }

    return baseData;
  } catch (error) {
    // Return empty data if database not available
    console.log('Database not available for analytics, returning empty data');
    const baseData = {
      active_streams: 0,
      total_viewers: 0,
      avg_latency: 0,
      bandwidth_usage: '0.00',
      cpu_usage: '0.0',
      memory_usage: '0.0'
    };

    if (type === 'user' && userId) {
      return {
        ...baseData,
        user_streams: 0,
        user_viewers: 0
      };
    }

    return baseData;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
