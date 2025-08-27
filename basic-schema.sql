-- Create necessary tables for basic streaming functionality
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    stream_key VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'inactive',
    user_id UUID REFERENCES users(id),
    rtmp_url TEXT,
    srt_url TEXT,
    webrtc_url TEXT,
    hls_url TEXT,
    llhls_url TEXT,
    viewer_count INTEGER DEFAULT 0,
    max_viewers INTEGER DEFAULT 1000,
    recording_enabled BOOLEAN DEFAULT false,
    recording_path TEXT,
    transcoding_enabled BOOLEAN DEFAULT true,
    bitrate_profiles TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stream_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    viewer_count INTEGER DEFAULT 0,
    bitrate BIGINT DEFAULT 0,
    frame_rate FLOAT DEFAULT 0,
    resolution VARCHAR(20),
    bandwidth_usage BIGINT DEFAULT 0,
    cpu_usage FLOAT DEFAULT 0,
    memory_usage FLOAT DEFAULT 0,
    error_count INTEGER DEFAULT 0
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON streams(created_at);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_timestamp ON stream_analytics(timestamp);

-- Insert a test admin user
INSERT INTO users (email, password_hash, first_name, last_name, role) 
VALUES ('admin@cruvzstreaming.com', '$2b$12$dummy.hash.for.testing', 'Admin', 'User', 'admin')
ON CONFLICT (email) DO NOTHING;