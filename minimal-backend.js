const express = require('express');
const app = express();
const PORT = 5000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'cruvz-streaming-api' });
});

// Mock auth endpoints for validation script
app.post('/api/auth/register', (req, res) => {
  console.log('Registration request received:', req.body);
  const { first_name, last_name, email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }
  
  const token = 'mock-jwt-token-' + Date.now();
  res.status(201).json({
    success: true,
    token: token,
    data: {
      token: token,
      user: {
        id: 'user-' + Date.now(),
        email: email,
        first_name: first_name || 'Test',
        last_name: last_name || 'User'
      }
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  const { email, password } = req.body;
  
  // Protect against SQL injection
  if (email && email.includes("'")) {
    return res.status(400).json({ success: false, error: 'Invalid input detected' });
  }
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }
  
  const token = 'mock-jwt-token-' + Date.now();
  res.json({
    success: true,
    token: token,
    data: {
      token: token,
      user: {
        id: 'user-' + Date.now(),
        email: email,
        first_name: 'Test',
        last_name: 'User'
      }
    }
  });
});

app.post('/api/streams', (req, res) => {
  console.log('Stream creation request received:', req.body);
  console.log('Headers:', req.headers);
  
  // Check for authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid authorization header:', authHeader);
    return res.status(401).json({ success: false, error: 'Authorization required' });
  }
  
  const { title, description } = req.body;
  
  const streamId = 'stream_' + Date.now();
  const streamData = {
    id: streamId,
    title: title || 'Test Stream',
    description: description || 'Test Description',
    rtmp_url: `rtmp://localhost:1935/app/${streamId}`,
    webrtc_url: `http://localhost:3333/app/${streamId}`,
    srt_url: `srt://localhost:9999?streamid=app/${streamId}`,
    status: 'ready'
  };
  
  console.log('Stream created successfully:', streamData);
  
  res.status(201).json({
    success: true,
    data: streamData,
    rtmp_url: streamData.rtmp_url,
    webrtc_url: streamData.webrtc_url,
    srt_url: streamData.srt_url
  });
});

// Add GET /api/streams endpoint that requires auth
app.get('/api/streams', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized access' });
  }
  
  res.json({
    success: true,
    data: []
  });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    success: true,
    status: 'running',
    service: 'Cruvz Streaming API',
    version: '2.0.0'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Mock Cruvz Streaming API running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});