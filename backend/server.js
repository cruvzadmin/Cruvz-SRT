const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('express-async-errors');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const streamRoutes = require('./routes/streams');
const analyticsRoutes = require('./routes/analytics');
const apiRoutes = require('./routes/api');
const sixSigmaRoutes = require('./routes/sixSigma');

const app = express();
const PORT = process.env.PORT || 5000;

// Production environment setup
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for production (behind reverse proxy/nginx)
app.set('trust proxy', 1);

// Advanced security middleware for production
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Production CORS configuration
app.use(cors({
  origin: isProduction ? ['http://localhost', 'https://localhost'] : ['http://localhost', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}));

// Production rate limiting - stricter limits
const generalLimiter = rateLimit({
  windowMs: isProduction ? 15 * 60 * 1000 : 60 * 1000, // 15 min in production, 1 min in dev
  max: isProduction ? 100 : 1000,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// Authentication rate limiting (more restrictive but reasonable)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 10 : 20, // 10 attempts in production, 20 in dev
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Allow for different IPs to have their own limits
  keyGenerator: (req) => {
    return req.ip;
  },
  // Skip rate limiting for successful requests
  skipSuccessfulRequests: true
});

// Streaming API rate limiting (higher limits for active streams)
const streamingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isProduction ? 200 : 500, // Higher limits for streaming operations
  message: {
    success: false,
    error: 'Streaming rate limit exceeded, please wait before retrying.',
    retryAfter: '5 minutes'
  }
});

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: isProduction ? '10mb' : '50mb',
  verify: (req, res, buf) => {
    // Validate JSON structure in production
    if (isProduction && req.get('content-type') === 'application/json') {
      try {
        JSON.parse(buf);
      } catch (e) {
        throw new Error('Invalid JSON');
      }
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Production logging
app.use(morgan(isProduction ? 'combined' : 'dev', {
  stream: {
    write: (message) => logger.info(message.trim())
  },
  skip: (req, res) => {
    // Skip health check logs in production to reduce noise
    return isProduction && req.url === '/health';
  }
}));

// Security middleware - Additional headers
app.use((req, res, next) => {
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Health check endpoint with detailed status
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version
  };
  
  if (isProduction) {
    // In production, include basic system info
    healthData.production = true;
    healthData.pid = process.pid;
  }
  
  res.status(200).json(healthData);
});

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      version: process.version
    },
    system: {
      loadavg: require('os').loadavg(),
      freemem: require('os').freemem(),
      totalmem: require('os').totalmem()
    }
  };
  res.status(200).json(metrics);
});

// API routes with appropriate rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/streams', streamingLimiter, streamRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/keys', apiRoutes);
app.use('/api/six-sigma', sixSigmaRoutes);

// Serve static files from web-app directory
const staticDir = path.join(__dirname, '../web-app');
app.use(express.static(staticDir));

// Catch-all handler for frontend routes
app.get('*', (req, res, _next) => {
  const indexPath = path.join(staticDir, 'index.html');
  // Only serve if file exists, otherwise respond with a simple message
  fs.access(indexPath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn('index.html not found, returning fallback');
      return res.status(200).send('<html><body><h1>Cruvz Streaming Backend Running</h1></body></html>');
    }
    res.sendFile(indexPath);
  });
});

// Error handling middleware
app.use(errorHandler);

// Database initialization and migration function
async function initializeDatabase() {
  try {
    logger.info('Initializing database...');
    
    // Run database migration
    const migrate = require('./scripts/migrate');
    await migrate();
    
    logger.info('Database initialization completed successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    return false;
  }
}

// Start server with database initialization
async function startServer() {
  try {
    // Initialize database first
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      logger.error('Failed to initialize database, exiting...');
      process.exit(1);
    }
    
    // Start the server after database is ready
    const server = app.listen(PORT, () => {
      logger.info(`Cruvz Streaming API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost'}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = app;
