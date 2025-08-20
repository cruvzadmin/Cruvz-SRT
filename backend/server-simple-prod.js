// Simple Production-Ready Cruvz Streaming Backend API
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'production-jwt-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json());

// Simple logger
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args)
};

// PostgreSQL client
let pgClient = null;

async function connectDatabase() {
  try {
    pgClient = new Client({
      host: process.env.POSTGRES_HOST || 'localhost',
      user: process.env.POSTGRES_USER || 'cruvz', 
      password: process.env.POSTGRES_PASSWORD || 'cruvzpass',
      database: process.env.POSTGRES_DB || 'cruvzdb',
      port: process.env.POSTGRES_PORT || 5432,
    });
    
    await pgClient.connect();
    logger.info('✅ Connected to PostgreSQL database');

    // Create tables if they don't exist
    await pgClient.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    logger.info('✅ Database tables created/verified');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Helper function to execute queries
async function query(text, params = []) {
  try {
    const result = await pgClient.query(text, params);
    return result;
  } catch (error) {
    logger.error('Query error:', error);
    throw error;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'cruvz-streaming-api' });
});

// Auth middleware  
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Split name
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user
    const result = await query(
      'INSERT INTO users (first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [firstName, lastName, email, hashedPassword]
    );

    const user = result.rows[0];
    
    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    // Remove password hash from response (not used in response)
    const { password_hash: _unused1, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      data: { token, user: userWithoutPassword }
    });

    logger.info(`✅ User registered: ${email}`);
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Find user
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    // Remove password hash from response (not used in response)
    const { password_hash: _unused2, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: { token, user: userWithoutPassword }
    });

    logger.info(`✅ User logged in: ${email}`);
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user profile
app.get('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { password_hash: _unused3, ...userWithoutPassword } = req.user;
    res.json({
      success: true,
      data: { user: userWithoutPassword }
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Basic API status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    success: true,
    status: 'running',
    service: 'Cruvz Streaming API',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((error, req, res, _next) => {
  logger.error('API Error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// Start server
async function startServer() {
  try {
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Cruvz Streaming API running on port ${PORT}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📊 API Status: http://localhost:${PORT}/api/status`);
      logger.info('🔐 Auth endpoints: /api/auth/register, /api/auth/login');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (pgClient) pgClient.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (pgClient) pgClient.end();
  process.exit(0);
});

startServer();