// Simple debug server to identify issues
require('dotenv').config();

console.log('Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST);
console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');

try {
  console.log('Testing database import...');
  const _db = require('./config/database');
  console.log('✅ Database module loaded');
  
  console.log('Testing logger import...');
  const _logger = require('./utils/logger');
  console.log('✅ Logger module loaded');
  
  console.log('Testing cache import...');
  const _cache = require('./utils/cache');
  console.log('✅ Cache module loaded');
  
  console.log('Testing route imports...');
  const _authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded');
  
  const _streamRoutes = require('./routes/streams');
  console.log('✅ Stream routes loaded');
  
  console.log('All modules loaded successfully. Starting simplified server...');
  
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'cruvz-streaming-api',
      timestamp: new Date().toISOString()
    });
  });
  
  app.listen(5000, '0.0.0.0', () => {
    console.log('🚀 Debug server running on port 5000');
  });
  
} catch (error) {
  console.error('❌ Error during module loading:', error.message);
  console.error(error.stack);
  process.exit(1);
}