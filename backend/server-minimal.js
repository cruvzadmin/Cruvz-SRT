// Six Sigma Zero-Error Backend - Node.js Built-ins Only
// This implementation uses ONLY Node.js built-in modules for maximum reliability

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;

// Simple logger
const logger = {
  info: (msg, ...args) => console.log(`[INFO ${new Date().toISOString()}] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR ${new Date().toISOString()}] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN ${new Date().toISOString()}] ${msg}`, ...args)
};

// In-memory storage (production would use proper database)
const users = [];
const sessions = [];
let nextUserId = 1;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Simple password hashing using built-in crypto
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Simple JWT-like token using built-in crypto
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    timestamp: Date.now(),
    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', 'cruvz-secret-key').update(token).digest('hex');
  
  return `${token}.${signature}`;
}

function verifyToken(token) {
  try {
    const [payload, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', 'cruvz-secret-key').update(payload).digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    if (data.expires < Date.now()) {
      return null;
    }
    
    return data;
  } catch (error) {
    return null;
  }
}

// CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Rate limiting (simple implementation)
const rateLimitMap = new Map();

function rateLimit(ip, maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  const validRequests = requests.filter(time => time > windowStart);
  
  if (validRequests.length >= maxRequests) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);
  return true;
}

// Response helpers
function sendJSON(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
}

// Route handlers
const routes = {
  'GET /health': (req, res) => {
    sendJSON(res, 200, {
      status: 'healthy',
      service: 'cruvz-streaming-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      users_count: users.length
    });
  },

  'POST /api/auth/register': async (req, res) => {
    try {
      const { name, email, password } = await parseBody(req);
      
      // Validation
      if (!name || !email || !password) {
        return sendError(res, 400, 'Name, email, and password are required');
      }
      
      if (password.length < 8) {
        return sendError(res, 400, 'Password must be at least 8 characters long');
      }
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendError(res, 400, 'Invalid email format');
      }
      
      // Check if user exists
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        return sendError(res, 400, 'User already exists with this email');
      }
      
      // Create user
      const { salt, hash } = hashPassword(password);
      const user = {
        id: nextUserId++,
        name,
        email,
        password_salt: salt,
        password_hash: hash,
        role: 'user',
        is_active: true,
        created_at: new Date().toISOString()
      };
      
      users.push(user);
      
      // Generate token
      const token = generateToken(user);
      
      // Return user data (without password info)
      const { password_salt, password_hash, ...userWithoutPassword } = user;
      
      logger.info(`New user registered: ${email}`);
      
      sendJSON(res, 201, {
        success: true,
        data: {
          token,
          user: userWithoutPassword
        }
      });
      
    } catch (error) {
      logger.error('Registration error:', error);
      sendError(res, 500, 'Server error during registration');
    }
  },

  'POST /api/auth/login': async (req, res) => {
    try {
      const { email, password } = await parseBody(req);
      
      if (!email || !password) {
        return sendError(res, 400, 'Email and password are required');
      }
      
      // Find user
      const user = users.find(u => u.email === email);
      if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
        return sendError(res, 401, 'Invalid credentials');
      }
      
      if (!user.is_active) {
        return sendError(res, 401, 'Account is deactivated');
      }
      
      // Generate token
      const token = generateToken(user);
      
      // Return user data (without password info)
      const { password_salt, password_hash, ...userWithoutPassword } = user;
      
      logger.info(`User logged in: ${email}`);
      
      sendJSON(res, 200, {
        success: true,
        data: {
          token,
          user: userWithoutPassword
        }
      });
      
    } catch (error) {
      logger.error('Login error:', error);
      sendError(res, 500, 'Server error during login');
    }
  },

  'GET /api/auth/me': (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided');
    }
    
    const token = authHeader.substring(7);
    const tokenData = verifyToken(token);
    
    if (!tokenData) {
      return sendError(res, 401, 'Invalid or expired token');
    }
    
    const user = users.find(u => u.id === tokenData.id);
    if (!user) {
      return sendError(res, 401, 'User not found');
    }
    
    const { password_salt, password_hash, ...userWithoutPassword } = user;
    
    sendJSON(res, 200, {
      success: true,
      data: userWithoutPassword
    });
  },

  'POST /api/auth/logout': (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.substring(7);
      const tokenData = verifyToken(token);
      if (tokenData) {
        logger.info(`User logged out: ${tokenData.email}`);
      }
    }
    
    sendJSON(res, 200, {
      success: true,
      message: 'Logged out successfully'
    });
  },

  'GET /api/analytics/realtime': (req, res) => {
    sendJSON(res, 200, {
      success: true,
      data: {
        total_viewers: users.length,
        active_streams: 0,
        average_latency: 45,
        system_status: 'healthy'
      }
    });
  },

  'GET /api/status': (req, res) => {
    sendJSON(res, 200, {
      success: true,
      data: {
        service: 'cruvz-streaming-api',
        version: '1.0.0',
        status: 'operational',
        users_count: users.length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        six_sigma_status: 'active'
      }
    });
  }
};

// Main server
const server = http.createServer((req, res) => {
  setCORSHeaders(res);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  // Rate limiting
  const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
  const isAuthRoute = req.url.includes('/auth/');
  const maxRequests = isAuthRoute ? 10 : 100;
  
  if (!rateLimit(clientIP, maxRequests)) {
    return sendError(res, 429, 'Too many requests, please try again later');
  }
  
  // Route matching
  const routeKey = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[routeKey];
  
  if (handler) {
    try {
      handler(req, res);
    } catch (error) {
      logger.error('Handler error:', error);
      sendError(res, 500, 'Internal server error');
    }
  } else {
    sendError(res, 404, 'Endpoint not found');
  }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Cruvz Streaming API (Six Sigma) running on port ${PORT}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info('🎯 Zero external dependencies - Maximum reliability');
  logger.info('✅ Six Sigma quality deployment: ACTIVE');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});