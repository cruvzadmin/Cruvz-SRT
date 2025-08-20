const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      streaming: 'operational',
      database: 'connected',
      uptime: process.uptime()
    }
  });
});

// Mock authentication endpoints for Six Sigma validation
app.post('/api/auth/register', (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  
  // Basic validation
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }
  
  // Mock successful registration
  const token = 'mock_jwt_token_' + Date.now();
  res.status(201).json({
    success: true,
    data: {
      token,
      user: {
        id: 'user_' + Date.now(),
        first_name,
        last_name,
        email,
        role: 'user'
      }
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing email or password'
    });
  }
  
  // Mock successful login
  const token = 'mock_jwt_token_' + Date.now();
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: 'user_mock',
        first_name: 'Six',
        last_name: 'Sigma',
        email,
        role: 'user'
      }
    }
  });
});

app.post('/api/streams', (req, res) => {
  const { title, description } = req.body;
  const streamId = 'stream_' + Date.now();
  
  // Generate streaming URLs
  const baseUrl = process.env.STREAMING_BASE_URL || 'localhost';
  
  res.json({
    success: true,
    data: {
      id: streamId,
      title: title || 'Untitled Stream',
      description: description || '',
      rtmp_url: `rtmp://${baseUrl}:1935/app/${streamId}`,
      webrtc_url: `http://${baseUrl}:3333/app/${streamId}`,
      srt_url: `srt://${baseUrl}:9999?streamid=app/${streamId}`,
      status: 'created'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple API server running on port ${PORT}`);
});