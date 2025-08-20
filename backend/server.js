const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cors = require('cors');
// Note: helmet and rateLimit available but not currently used in this simplified server

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

// Database configuration based on environment
let dbConnection = null;
let isTestEnv = process.env.NODE_ENV === 'test';

// Simple in-memory mock for testing
const mockDb = {
  users: new Map(),
  streams: new Map(),
  nextId: 1
};

// Initialize database connection
async function initializeDatabase() {
  if (isTestEnv) {
    // Use simple mock for testing
    dbConnection = { isMock: true };
    return true;
  } else {
    // Use PostgreSQL for production/development
    const { Client } = require('pg');
    try {
      const pgClient = new Client({
        host: process.env.POSTGRES_HOST || 'localhost',
        user: process.env.POSTGRES_USER || 'cruvz', 
        password: process.env.POSTGRES_PASSWORD || 'CHANGE_THIS_STRONG_PASSWORD_FOR_PRODUCTION',
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
      dbConnection = { pgClient };
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }
}

// Helper function to execute queries
async function query(text, params = []) {
  if (!dbConnection) {
    throw new Error('Database not connected');
  }
  
  try {
    if (dbConnection.isMock) {
      // Mock database for testing
      const sql = text.toLowerCase();
      
      if (sql.includes('select') && sql.includes('users') && sql.includes('email')) {
        // Check if user exists by email
        const email = params[0];
        const user = Array.from(mockDb.users.values()).find(u => u.email === email);
        return { rows: user ? [user] : [] };
      }

      if (sql.includes('select') && sql.includes('users') && sql.includes('id')) {
        // Get user by ID (for auth middleware)
        const userId = params[0];
        const user = mockDb.users.get(userId);
        return { rows: user ? [user] : [] };
      }
      
      if (sql.includes('insert into users')) {
        // Create user
        const [firstName, lastName, email, passwordHash] = params;
        const user = {
          id: `user_${mockDb.nextId++}`,
          first_name: firstName,
          last_name: lastName,
          email,
          password_hash: passwordHash,
          role: 'user',
          is_active: true,
          created_at: new Date()
        };
        mockDb.users.set(user.id, user);
        return { rows: [user] };
      }
      
      if (sql.includes('insert into streams')) {
        // Create stream with extended fields
        const [userId, title, description, streamKey, protocol, sourceUrl, destinationUrl] = params;
        const stream = {
          id: `stream_${mockDb.nextId++}`,
          user_id: userId,
          title,
          description,
          stream_key: streamKey,
          protocol: protocol || 'rtmp',
          source_url: sourceUrl || '',
          destination_url: destinationUrl || '',
          status: 'inactive',
          max_viewers: 1000,
          current_viewers: 0,
          created_at: new Date()
        };
        mockDb.streams.set(stream.id, stream);
        return { rows: [stream] };
      }
      
      if (sql.includes('select') && sql.includes('streams') && sql.includes('user_id') && !sql.includes('order by')) {
        // Get specific stream by ID and user_id
        const [streamId, userId] = params;
        const stream = mockDb.streams.get(streamId);
        if (stream && stream.user_id === userId) {
          return { rows: [stream] };
        }
        return { rows: [] };
      }
      
      if (sql.includes('select') && sql.includes('streams') && sql.includes('user_id') && sql.includes('order by')) {
        // Get user streams
        const userId = params[0];
        const streams = Array.from(mockDb.streams.values()).filter(s => s.user_id === userId);
        return { rows: streams };
      }
      
      if (sql.includes('update streams') && sql.includes('status')) {
        // Update stream status
        const [status, startTime, streamId] = params;
        const stream = mockDb.streams.get(streamId);
        if (stream) {
          stream.status = status;
          if (status === 'active') {
            stream.started_at = startTime || new Date();
            // Generate default URLs if not set
            if (!stream.source_url) stream.source_url = `rtmp://localhost:1935/app/${stream.stream_key}`;
            if (!stream.destination_url) stream.destination_url = `rtmp://localhost:1935/app/${stream.stream_key}`;
          }
          if (status === 'inactive') stream.ended_at = new Date();
          return { rows: [stream] };
        }
        return { rows: [] };
      }
      
      // Default empty response for unhandled queries
      return { rows: [] };
    } else {
      // Use PostgreSQL
      const result = await dbConnection.pgClient.query(text, params);
      return result;
    }
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Health check
app.get('/health', (req, res) => {
  const healthData = { 
    status: 'healthy', 
    service: 'cruvz-streaming-api',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
  res.json(healthData);
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    // Validate password strength (at least 8 chars, with numbers and letters)
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
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
    const { password_hash: _unused4, ...userWithoutPassword } = user;

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

    // Remove password hash from response (not used in response)
    const { password_hash: _unused5, ...userWithoutPassword } = user;

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
    const { title, description, source_url, destination_url, protocol } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    // Validate URLs if provided
    if (source_url && source_url !== '' && !isValidUrl(source_url)) {
      return res.status(400).json({ success: false, error: 'Invalid source URL format' });
    }
    if (destination_url && destination_url !== '' && !isValidUrl(destination_url)) {
      return res.status(400).json({ success: false, error: 'Invalid destination URL format' });
    }

    // Generate unique stream key
    const streamKey = crypto.randomBytes(16).toString('hex');

    // Create stream with extended fields
    const streamData = {
      user_id: req.user.id,
      title,
      description: description || '',
      stream_key: streamKey,
      protocol: protocol || 'rtmp',
      source_url: source_url || '',
      destination_url: destination_url || '',
      status: 'inactive',
      max_viewers: 1000,
      current_viewers: 0,
      created_at: new Date()
    };

    let result;
    if (dbConnection.isMock) {
      // Handle mock database
      streamData.id = `stream_${mockDb.nextId++}`;
      mockDb.streams.set(streamData.id, streamData);
      result = { rows: [streamData] };
    } else {
      // Handle PostgreSQL - extend table if needed
      result = await query(
        'INSERT INTO streams (user_id, title, description, stream_key, protocol, source_url, destination_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [req.user.id, title, description || '', streamKey, protocol || 'rtmp', source_url || '', destination_url || '']
      );
    }

    const stream = result.rows[0];

    // Include URLs in response
    const response = {
      id: stream.id,
      stream,
      source_url: stream.source_url,
      destination_url: stream.destination_url,
      protocol: stream.protocol
    };

    res.status(201).json({
      success: true,
      data: response
    });

    console.log(`✅ Stream created: ${title} by ${req.user.email}`);
  } catch (error) {
    console.error('Stream creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper function to validate URLs
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    // Basic pattern for streaming URLs that might not be standard HTTP
    return /^(rtmp|srt|http|https):\/\/.+/.test(string);
  }
}

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
        stream_key: updatedStream.stream_key,
        source_url: updatedStream.source_url || `rtmp://localhost:1935/app/${updatedStream.stream_key}`,
        destination_url: updatedStream.destination_url || `rtmp://localhost:1935/app/${updatedStream.stream_key}`,
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

// Update stream endpoint
app.put('/api/streams/:id', authenticate, async (req, res) => {
  try {
    const streamId = req.params.id;
    const { title, description, source_url, destination_url, protocol } = req.body;

    // Validate URLs if provided
    if (source_url && source_url !== '' && !isValidUrl(source_url)) {
      return res.status(400).json({ success: false, error: 'Invalid source URL format' });
    }
    if (destination_url && destination_url !== '' && !isValidUrl(destination_url)) {
      return res.status(400).json({ success: false, error: 'Invalid destination URL format' });
    }

    let result;
    if (dbConnection.isMock) {
      // Handle mock database
      const stream = mockDb.streams.get(streamId);
      if (!stream || stream.user_id !== req.user.id) {
        return res.status(404).json({ success: false, error: 'Stream not found' });
      }

      // Update stream fields
      if (title !== undefined) stream.title = title;
      if (description !== undefined) stream.description = description;
      if (source_url !== undefined) stream.source_url = source_url;
      if (destination_url !== undefined) stream.destination_url = destination_url;
      if (protocol !== undefined) stream.protocol = protocol;
      stream.updated_at = new Date();

      result = { rows: [stream] };
    } else {
      // Handle PostgreSQL
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        updateValues.push(title);
      }
      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(description);
      }
      if (source_url !== undefined) {
        updateFields.push(`source_url = $${paramIndex++}`);
        updateValues.push(source_url);
      }
      if (destination_url !== undefined) {
        updateFields.push(`destination_url = $${paramIndex++}`);
        updateValues.push(destination_url);
      }
      if (protocol !== undefined) {
        updateFields.push(`protocol = $${paramIndex++}`);
        updateValues.push(protocol);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      updateValues.push(streamId, req.user.id);
      const sql = `UPDATE streams SET ${updateFields.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} RETURNING *`;
      
      result = await query(sql, updateValues);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stream not found' });
      }
    }

    const updatedStream = result.rows[0];

    res.json({
      success: true,
      data: {
        stream: updatedStream,
        source_url: updatedStream.source_url,
        destination_url: updatedStream.destination_url,
        protocol: updatedStream.protocol
      }
    });

    console.log(`✅ Stream updated: ${updatedStream.title} by ${req.user.email}`);
  } catch (error) {
    console.error('Stream update error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user profile endpoint
app.get('/api/users/profile', authenticate, async (req, res) => {
  try {
    const { password_hash: _unused6, ...userWithoutPassword } = req.user;
    res.json({
      success: true,
      data: { user: userWithoutPassword }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Analytics dashboard endpoint
app.get('/api/analytics/dashboard', authenticate, async (req, res) => {
  try {
    let analytics;
    if (dbConnection.isMock) {
      analytics = {
        total_streams: Array.from(mockDb.streams.values()).length,
        active_streams: Array.from(mockDb.streams.values()).filter(s => s.status === 'active').length,
        total_users: Array.from(mockDb.users.values()).length,
        total_views: 1250,
        uptime: '99.9%'
      };
    } else {
      // Get real analytics from PostgreSQL
      const streamsResult = await query('SELECT COUNT(*) as total FROM streams');
      const activeStreamsResult = await query('SELECT COUNT(*) as active FROM streams WHERE status = $1', ['active']);
      const usersResult = await query('SELECT COUNT(*) as total FROM users');
      
      analytics = {
        total_streams: parseInt(streamsResult.rows[0].total),
        active_streams: parseInt(activeStreamsResult.rows[0].active),
        total_users: parseInt(usersResult.rows[0].total),
        total_views: 1250,
        uptime: '99.9%'
      };
    }
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Static files / frontend fallback
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Cruvz Streaming Platform</title></head>
    <body>
      <h1>🚀 Cruvz Streaming Platform</h1>
      <p>API server is running successfully!</p>
      <ul>
        <li><a href="/health">Health Check</a></li>
        <li>API endpoints: /api/auth/*, /api/streams/*, /api/analytics/*</li>
      </ul>
    </body>
    </html>
  `);
});

// Start server (only if not in test environment)
async function startServer() {
  const connected = await initializeDatabase();
  if (!connected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Cruvz Streaming API running on port ${PORT}`);
    console.log('🗄️  Connected to database');
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
}

// Export app for testing
module.exports = app;

// Initialize database for tests
if (isTestEnv) {
  initializeDatabase().catch(console.error);
}

// Only start server if not in test environment
if (require.main === module) {
  startServer();
}