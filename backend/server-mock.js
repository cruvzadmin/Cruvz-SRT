const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🚀 Starting Cruvz Streaming Backend...');

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Cruvz Streaming Backend',
    version: '1.0.0'
  });
});

// Basic API endpoints for testing
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running',
    streaming_ports: {
      rtmp: 1935,
      webrtc: 3333,
      srt: 9999,
      origin: 9000
    }
  });
});

// Minimal auth endpoints for testing
app.post('/api/auth/register', (req, res) => {
  res.json({ 
    success: true, 
    message: 'User registration endpoint working',
    data: { id: 'test-user-id', email: req.body.email }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ 
    success: true, 
    message: 'User login endpoint working',
    token: 'test-jwt-token'
  });
});

// Minimal streams endpoints for testing
app.get('/api/streams', (req, res) => {
  res.json({ 
    success: true, 
    data: [],
    message: 'Streams endpoint working'
  });
});

app.post('/api/streams', (req, res) => {
  const streamId = 'test-stream-' + Date.now();
  res.json({ 
    success: true, 
    message: 'Stream created successfully',
    data: {
      id: streamId,
      title: req.body.title || 'Test Stream',
      description: req.body.description || 'Test Description',
      status: 'created',
      streaming_urls: {
        rtmp: `rtmp://localhost:1935/app/${streamId}`,
        webrtc: `http://localhost:3333/app/${streamId}`,
        srt: `srt://localhost:9999?streamid=app/${streamId}`
      }
    }
  });
});

app.post('/api/streams/:id/start', (req, res) => {
  const streamId = req.params.id;
  res.json({ 
    success: true, 
    message: 'Stream started successfully',
    data: {
      id: streamId,
      status: 'running',
      streaming_urls: {
        rtmp: `rtmp://localhost:1935/app/${streamId}`,
        webrtc: `http://localhost:3333/app/${streamId}`,
        srt: `srt://localhost:9999?streamid=app/${streamId}`
      }
    }
  });
});

app.post('/api/streams/:id/stop', (req, res) => {
  const streamId = req.params.id;
  res.json({ 
    success: true, 
    message: 'Stream stopped successfully',
    data: {
      id: streamId,
      status: 'stopped'
    }
  });
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      total_streams: 0,
      active_streams: 0,
      total_viewers: 0,
      system_status: 'healthy'
    }
  });
});

// Error handling
app.use((error, req, res, _next) => {
  console.error('API Error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Cruvz Backend running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API Status: http://localhost:${PORT}/api/status`);
});