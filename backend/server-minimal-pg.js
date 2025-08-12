// Minimal working backend with PostgreSQL
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'production-jwt-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL client setup
let pgClient = null;

async function connectDatabase() {
  try {
    pgClient = new Client({
      host: 'localhost',
      user: 'cruvz', 
      password: 'CHANGE_THIS_STRONG_PASSWORD_FOR_PRODUCTION',
      database: 'cruvzdb',
      port: 5432,
    });
    
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');

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

      CREATE TABLE IF NOT EXISTS streams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        stream_key VARCHAR(100) NOT NULL UNIQUE,
        protocol VARCHAR(20) DEFAULT 'rtmp',
        status VARCHAR(20) DEFAULT 'inactive',
        max_viewers INTEGER DEFAULT 1000,
        current_viewers INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Database tables created/verified');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Helper function to execute queries
async function query(text, params = []) {
  try {
    const result = await pgClient.query(text, params);
    return result;
  } catch (error) {
    console.error('Query error:', error);
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

    // Remove password hash from response
    const { password_hash: _, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      data: { token, user: userWithoutPassword }
    });

    console.log(`✅ User registered: ${email}`);
  } catch (error) {
    console.error('Registration error:', error);
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

    // Remove password hash from response
    const { password_hash: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: { token, user: userWithoutPassword }
    });

    console.log(`✅ User logged in: ${email}`);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create stream endpoint
app.post('/api/streams', authenticate, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    // Generate unique stream key
    const streamKey = crypto.randomBytes(16).toString('hex');

    // Create stream
    const result = await query(
      'INSERT INTO streams (user_id, title, description, stream_key) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, title, description || '', streamKey]
    );

    const stream = result.rows[0];

    res.status(201).json({
      success: true,
      data: { stream }
    });

    console.log(`✅ Stream created: ${title} by ${req.user.email}`);
  } catch (error) {
    console.error('Stream creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user streams
app.get('/api/streams', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM streams WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      success: true,
      data: { streams: result.rows }
    });
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start stream
app.post('/api/streams/:id/start', authenticate, async (req, res) => {
  try {
    const streamId = req.params.id;

    // Check if stream exists and belongs to user
    const streamResult = await query(
      'SELECT * FROM streams WHERE id = $1 AND user_id = $2',
      [streamId, req.user.id]
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }

    // Update stream status
    const result = await query(
      'UPDATE streams SET status = $1, started_at = $2 WHERE id = $3 RETURNING *',
      ['active', new Date(), streamId]
    );

    const updatedStream = result.rows[0];

    res.json({
      success: true,
      data: {
        stream: updatedStream,
        rtmp_url: `rtmp://localhost:1935/app/${updatedStream.stream_key}`,
        webrtc_url: `http://localhost:3333/app/${updatedStream.stream_key}`,
        srt_url: `srt://localhost:9999?streamid=app/${updatedStream.stream_key}`
      }
    });

    console.log(`✅ Stream started: ${updatedStream.title}`);
  } catch (error) {
    console.error('Start stream error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start server
async function startServer() {
  const connected = await connectDatabase();
  if (!connected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Cruvz Streaming API running on port ${PORT}`);
    console.log('🗄️  Connected to PostgreSQL database');
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
}

startServer();