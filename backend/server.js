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

// TRUST PROXY: Required for rate limiting and X-Forwarded-For headers (NGINX/Proxy)
app.set('trust proxy', 1); // <-- Added this line

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for development
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Auth rate limiting (more restrictive)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Health check endpoint (always returns 200)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/keys', apiRoutes);
app.use('/api/six-sigma', sixSigmaRoutes);

// Serve static files from web-app directory
const staticDir = path.join(__dirname, '../web-app');
app.use(express.static(staticDir));

// Catch-all handler for frontend routes
app.get('*', (req, res, next) => {
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

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Cruvz Streaming API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

module.exports = app;
