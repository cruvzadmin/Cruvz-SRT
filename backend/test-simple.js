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

app.listen(PORT, () => {
  console.log(`🚀 Simple API server running on port ${PORT}`);
});