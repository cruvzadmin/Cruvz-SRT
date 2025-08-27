#!/usr/bin/env node
/**
 * Simple Streaming API Server for OvenMediaEngine Integration
 * Bypasses complex database setup to focus on streaming functionality
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 5000;

// OvenMediaEngine Configuration
const OME_API_URL = 'http://localhost:8080';
const OME_API_TOKEN = 'cruvz-production-api-token-2025';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for streams (for testing)
let streams = [];
let streamIdCounter = 1;

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'cruvz-streaming-api',
    version: '2.0.0'
  });
});

// Get OvenMediaEngine Stats
app.get('/api/ome/stats', async (req, res) => {
  try {
    const response = await axios.get(`${OME_API_URL}/v1/stats/current`, {
      headers: { Authorization: OME_API_TOKEN },
      timeout: 5000
    });
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch OvenMediaEngine stats',
      details: error.message
    });
  }
});

// Get VHosts
app.get('/api/ome/vhosts', async (req, res) => {
  try {
    const response = await axios.get(`${OME_API_URL}/v1/vhosts`, {
      headers: { Authorization: OME_API_TOKEN },
      timeout: 5000
    });
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VHosts',
      details: error.message
    });
  }
});

// Get Applications
app.get('/api/ome/vhosts/:vhost/apps', async (req, res) => {
  try {
    const { vhost } = req.params;
    const response = await axios.get(`${OME_API_URL}/v1/vhosts/${vhost}/apps`, {
      headers: { Authorization: OME_API_TOKEN },
      timeout: 5000
    });
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch applications',
      details: error.message
    });
  }
});

// Get Streams
app.get('/api/ome/vhosts/:vhost/apps/:app/streams', async (req, res) => {
  try {
    const { vhost, app } = req.params;
    const response = await axios.get(`${OME_API_URL}/v1/vhosts/${vhost}/apps/${app}/streams`, {
      headers: { Authorization: OME_API_TOKEN },
      timeout: 5000
    });
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch streams',
      details: error.message
    });
  }
});

// Create Stream (push to OME)
app.post('/api/streams', async (req, res) => {
  try {
    const { name, protocol, inputUrl, outputProfiles } = req.body;
    
    // For now, store in memory - later integrate with OME push API
    const stream = {
      id: streamIdCounter++,
      name,
      protocol,
      inputUrl,
      outputProfiles,
      status: 'created',
      createdAt: new Date().toISOString(),
      urls: {
        rtmp: `rtmp://localhost:1935/app/${name}`,
        srt_input: `srt://localhost:9999?streamid=input/app/${name}`,
        srt_output: `srt://localhost:9998?streamid=app/${name}`,
        webrtc: `ws://localhost:3333/app/${name}`,
        llhls: `http://localhost:8088/app/${name}/llhls.m3u8`,
        hls: `http://localhost:8088/app/${name}/playlist.m3u8`
      }
    };
    
    streams.push(stream);
    
    res.json({
      success: true,
      data: stream,
      message: 'Stream created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create stream',
      details: error.message
    });
  }
});

// Get All Streams
app.get('/api/streams', (req, res) => {
  res.json({
    success: true,
    data: streams,
    count: streams.length
  });
});

// Get Stream by ID
app.get('/api/streams/:id', (req, res) => {
  const { id } = req.params;
  const stream = streams.find(s => s.id === parseInt(id));
  
  if (!stream) {
    return res.status(404).json({
      success: false,
      error: 'Stream not found'
    });
  }
  
  res.json({
    success: true,
    data: stream
  });
});

// Update Stream
app.put('/api/streams/:id', (req, res) => {
  const { id } = req.params;
  const streamIndex = streams.findIndex(s => s.id === parseInt(id));
  
  if (streamIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Stream not found'
    });
  }
  
  streams[streamIndex] = {
    ...streams[streamIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: streams[streamIndex],
    message: 'Stream updated successfully'
  });
});

// Delete Stream
app.delete('/api/streams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const streamIndex = streams.findIndex(s => s.id === parseInt(id));
    
    if (streamIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }
    
    const stream = streams[streamIndex];
    
    // TODO: Add OME API call to stop/delete stream
    streams.splice(streamIndex, 1);
    
    res.json({
      success: true,
      message: 'Stream deleted successfully',
      data: { id: parseInt(id) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete stream',
      details: error.message
    });
  }
});

// Get Streaming Protocols
app.get('/api/streaming/protocols', (req, res) => {
  res.json({
    success: true,
    data: {
      protocols: [
        {
          name: 'RTMP',
          type: 'ingest',
          port: 1935,
          url: 'rtmp://localhost:1935/app/{stream_name}',
          description: 'Real-Time Messaging Protocol for stream ingest'
        },
        {
          name: 'SRT',
          type: 'ingest',
          port: 9999,
          url: 'srt://localhost:9999?streamid=input/app/{stream_name}',
          description: 'Secure Reliable Transport for low-latency streaming'
        },
        {
          name: 'SRT',
          type: 'output',
          port: 9998,
          url: 'srt://localhost:9998?streamid=app/{stream_name}',
          description: 'SRT output for low-latency distribution'
        },
        {
          name: 'WebRTC',
          type: 'both',
          port: 3333,
          url: 'ws://localhost:3333/app/{stream_name}',
          description: 'Web Real-Time Communication for browser streaming'
        },
        {
          name: 'LLHLS',
          type: 'output',
          port: 8088,
          url: 'http://localhost:8088/app/{stream_name}/llhls.m3u8',
          description: 'Low-Latency HTTP Live Streaming'
        },
        {
          name: 'HLS',
          type: 'output',
          port: 8088,
          url: 'http://localhost:8088/app/{stream_name}/playlist.m3u8',
          description: 'HTTP Live Streaming with DVR support'
        }
      ]
    }
  });
});

// Analytics endpoints (simplified)
app.get('/api/analytics/performance', (req, res) => {
  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      metrics: {
        activeStreams: streams.filter(s => s.status === 'active').length,
        totalStreams: streams.length,
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        bandwidth: Math.floor(Math.random() * 1000),
        viewers: Math.floor(Math.random() * 500)
      }
    }
  });
});

app.get('/api/analytics/errors', (req, res) => {
  res.json({
    success: true,
    data: {
      errors: [],
      errorCount: 0,
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple Streaming API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎥 OvenMediaEngine Stats: http://localhost:${PORT}/api/ome/stats`);
  console.log(`🌐 Streaming Protocols: http://localhost:${PORT}/api/streaming/protocols`);
});

module.exports = app;