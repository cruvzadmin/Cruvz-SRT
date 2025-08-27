const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Test PostgreSQL connection
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  user: 'cruvz',
  password: 'cruvzSRT91',
  database: 'cruvzdb',
  port: 5432,
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Simple streaming endpoints for testing
app.get('/api/streams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streams ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

app.post('/api/streams', async (req, res) => {
  try {
    const { name, protocol } = req.body;
    const streamKey = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await pool.query(`
      INSERT INTO streams (name, protocol, stream_key, status) 
      VALUES ($1, $2, $3, 'created') 
      RETURNING *
    `, [name, protocol, streamKey]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/performance', (req, res) => {
  res.json({
    cpu_usage: Math.random() * 80 + 10,
    memory_usage: Math.random() * 70 + 20,
    network_io: Math.random() * 100,
    active_streams: Math.floor(Math.random() * 10),
    total_viewers: Math.floor(Math.random() * 1000),
    bandwidth_usage: Math.random() * 500 + 100
  });
});

app.get('/api/analytics/errors', (req, res) => {
  res.json({
    error_count: Math.floor(Math.random() * 5),
    warning_count: Math.floor(Math.random() * 20),
    last_error: new Date(Date.now() - Math.random() * 3600000).toISOString()
  });
});

// OvenMediaEngine proxy endpoints
app.get('/api/streaming/protocols', async (req, res) => {
  try {
    // Check if OvenMediaEngine is running
    const response = await axios.get('http://localhost:8080/v1/stats/current', {
      headers: { 'Authorization': 'cruvz-production-api-token-2025' },
      timeout: 5000
    });
    
    res.json({
      rtmp: { port: 1935, status: 'active' },
      srt_input: { port: 9999, status: 'active' },
      srt_output: { port: 9998, status: 'active' },
      webrtc: { port: 3333, status: 'active' },
      llhls: { port: 8088, status: 'active' },
      hls: { port: 8088, status: 'active' }
    });
  } catch (error) {
    res.json({
      rtmp: { port: 1935, status: 'inactive' },
      srt_input: { port: 9999, status: 'inactive' },
      srt_output: { port: 9998, status: 'inactive' },
      webrtc: { port: 3333, status: 'inactive' },
      llhls: { port: 8088, status: 'inactive' },
      hls: { port: 8088, status: 'inactive' }
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Test Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});