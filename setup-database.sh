#!/bin/bash

# Setup basic database schema for the streaming platform
echo "🗄️  Setting up basic database schema..."

# Create basic schema
docker exec -i cruvz-postgres-prod psql -U cruvz -d cruvzdb << 'EOF'
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create streams table
CREATE TABLE IF NOT EXISTS streams (
    id SERIAL PRIMARY KEY,
    stream_key VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'inactive',
    protocol VARCHAR(20) DEFAULT 'rtmp',
    viewer_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    stream_id INTEGER REFERENCES streams(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo users
INSERT INTO users (username, email, password_hash, role) VALUES 
    ('admin', 'admin@cruvzstreaming.com', '$2b$10$demo_hash_admin', 'admin'),
    ('demo_streamer', 'demo.streamer@cruvz.com', '$2b$10$demo_hash_streamer', 'streamer'),
    ('demo_viewer', 'demo.viewer@cruvz.com', '$2b$10$demo_hash_viewer', 'viewer')
ON CONFLICT (username) DO NOTHING;

-- Insert demo streams
INSERT INTO streams (stream_key, title, description, user_id, status) VALUES 
    ('demo_stream_001', 'Demo Live Stream', 'A demonstration live stream', 2, 'inactive'),
    ('test_stream', 'Test Stream', 'Testing streaming functionality', 2, 'inactive')
ON CONFLICT (stream_key) DO NOTHING;

-- Show results
SELECT 'Users created:' as info;
SELECT id, username, email, role FROM users;

SELECT 'Streams created:' as info;
SELECT id, stream_key, title, status FROM streams;
EOF

echo "✅ Database schema setup completed!"