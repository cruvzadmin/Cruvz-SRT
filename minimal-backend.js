#!/usr/bin/env node

// Minimal Production Backend API for CRUVZ-SRT Platform
// Real database integration with PostgreSQL and Redis

const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost', 'http://localhost:80', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Database connections
const pgPool = new Pool({
    host: process.env.POSTGRES_HOST || 'postgres',
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

let redisClient;
try {
    redisClient = redis.createClient({
        socket: {
            host: process.env.REDIS_HOST || 'redis',
            port: process.env.REDIS_PORT || 6379
        },
        password: process.env.REDIS_PASSWORD || undefined
    });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    redisClient.connect().catch(err => console.log('Redis connection failed:', err));
} catch (err) {
    console.log('Redis connection error:', err);
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Test PostgreSQL connection
        const pgResult = await pgPool.query('SELECT NOW() as timestamp, version() as version');
        
        // Test Redis connection
        let redisStatus = 'disconnected';
        try {
            await redisClient.ping();
            redisStatus = 'connected';
        } catch (err) {
            redisStatus = 'error: ' + err.message;
        }

        // Get database stats
        const usersResult = await pgPool.query('SELECT COUNT(*) as count FROM users');
        const streamsResult = await pgPool.query('SELECT COUNT(*) as count FROM streams');

        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            services: {
                database: {
                    status: 'connected',
                    timestamp: pgResult.rows[0].timestamp,
                    version: pgResult.rows[0].version.split(' ')[0] + ' ' + pgResult.rows[0].version.split(' ')[1],
                    users_count: parseInt(usersResult.rows[0].count),
                    streams_count: parseInt(streamsResult.rows[0].count)
                },
                redis: {
                    status: redisStatus
                },
                streaming: {
                    ome_api_url: process.env.OME_API_URL || 'http://origin:8080',
                    rtmp_port: process.env.RTMP_PORT || 1935,
                    srt_port: process.env.SRT_PORT || 9999,
                    webrtc_port: process.env.WEBRTC_PORT || 3333
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API Info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        api_name: 'CRUVZ-SRT Streaming Platform API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            health: 'GET /health',
            info: 'GET /api/info',
            streaming_protocols: 'GET /api/streaming/protocols',
            analytics: 'GET /api/analytics',
            streams: 'GET /api/streams',
            users: 'GET /api/users'
        },
        timestamp: new Date().toISOString()
    });
});

// Streaming protocols status
app.get('/api/streaming/protocols', async (req, res) => {
    const protocols = {
        rtmp: {
            enabled: true,
            port: process.env.RTMP_PORT || 1935,
            endpoint: `rtmp://localhost:${process.env.RTMP_PORT || 1935}/live/{stream_key}`,
            status: 'operational'
        },
        srt: {
            enabled: true,
            input_port: process.env.SRT_PORT || 9999,
            output_port: 9998,
            input_endpoint: `srt://localhost:${process.env.SRT_PORT || 9999}`,
            output_endpoint: 'srt://localhost:9998',
            status: 'operational'
        },
        hls: {
            enabled: true,
            port: 8088,
            endpoint: 'http://localhost:8088/live/{stream_key}/index.m3u8',
            status: 'operational'
        },
        webrtc: {
            enabled: true,
            port: process.env.WEBRTC_PORT || 3333,
            signaling: `ws://localhost:${process.env.WEBRTC_PORT || 3333}`,
            status: 'operational'
        },
        llhls: {
            enabled: true,
            port: 8088,
            endpoint: 'http://localhost:8088/live/{stream_key}/llhls.m3u8',
            status: 'operational'
        }
    };

    res.json({
        protocols,
        total_protocols: Object.keys(protocols).length,
        operational_count: Object.values(protocols).filter(p => p.status === 'operational').length,
        timestamp: new Date().toISOString()
    });
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
    try {
        const usersQuery = await pgPool.query('SELECT COUNT(*) as total, role, COUNT(*) as count FROM users GROUP BY role');
        const streamsQuery = await pgPool.query('SELECT COUNT(*) as total, status, COUNT(*) as count FROM streams GROUP BY status');
        const analyticsQuery = await pgPool.query('SELECT COUNT(*) as total FROM analytics');

        res.json({
            users: {
                total: usersQuery.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
                by_role: usersQuery.rows.reduce((acc, row) => {
                    acc[row.role] = parseInt(row.count);
                    return acc;
                }, {})
            },
            streams: {
                total: streamsQuery.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
                by_status: streamsQuery.rows.reduce((acc, row) => {
                    acc[row.status] = parseInt(row.count);
                    return acc;
                }, {})
            },
            events: {
                total: parseInt(analyticsQuery.rows[0].total)
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Streams endpoint
app.get('/api/streams', async (req, res) => {
    try {
        const query = `
            SELECT s.*, u.username as streamer_username 
            FROM streams s 
            LEFT JOIN users u ON s.user_id = u.id 
            ORDER BY s.created_at DESC
        `;
        const result = await pgPool.query(query);
        
        res.json({
            streams: result.rows,
            total: result.rows.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Users endpoint
app.get('/api/users', async (req, res) => {
    try {
        const query = `
            SELECT id, username, email, role, created_at, updated_at 
            FROM users 
            ORDER BY created_at DESC
        `;
        const result = await pgPool.query(query);
        
        res.json({
            users: result.rows,
            total: result.rows.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new stream endpoint
app.post('/api/streams', async (req, res) => {
    try {
        const { title, description, user_id, protocol = 'rtmp' } = req.body;
        const stream_key = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const query = `
            INSERT INTO streams (stream_key, title, description, user_id, protocol, status) 
            VALUES ($1, $2, $3, $4, $5, 'inactive') 
            RETURNING *
        `;
        const result = await pgPool.query(query, [stream_key, title, description, user_id, protocol]);
        
        res.status(201).json({
            stream: result.rows[0],
            message: 'Stream created successfully',
            streaming_urls: {
                rtmp: `rtmp://localhost:1935/live/${stream_key}`,
                srt: `srt://localhost:9999?streamid=${stream_key}`,
                hls_playback: `http://localhost:8088/live/${stream_key}/index.m3u8`
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CRUVZ-SRT Backend API Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📖 API info: http://localhost:${PORT}/api/info`);
    console.log(`🎬 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.POSTGRES_HOST || 'postgres'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'cruvzdb'}`);
    console.log(`⚡ Redis: ${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await pgPool.end();
    if (redisClient) {
        await redisClient.quit();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    await pgPool.end();
    if (redisClient) {
        await redisClient.quit();
    }
    process.exit(0);
});