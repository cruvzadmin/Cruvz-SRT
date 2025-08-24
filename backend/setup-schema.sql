-- Create all tables for Cruvz streaming platform
-- This will be run directly in PostgreSQL

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'streamer')),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  avatar_url VARCHAR(500),
  max_streams INTEGER DEFAULT 5,
  max_viewers_per_stream INTEGER DEFAULT 1000,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  permissions TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  stream_key VARCHAR(100) NOT NULL UNIQUE,
  protocol VARCHAR(50) DEFAULT 'rtmp' CHECK (protocol IN ('rtmp', 'srt', 'webrtc')),
  source_url VARCHAR(500),
  destination_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'ended', 'error')),
  settings TEXT,
  max_viewers INTEGER DEFAULT 1000,
  current_viewers INTEGER DEFAULT 0,
  is_recording BOOLEAN DEFAULT false,
  recording_url VARCHAR(500),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  total_view_time BIGINT DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream sessions table
CREATE TABLE IF NOT EXISTS stream_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  viewer_ip VARCHAR(45),
  user_agent VARCHAR(500),
  location VARCHAR(100),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  watch_duration INTEGER DEFAULT 0,
  quality_metrics TEXT
);

-- Stream analytics table
CREATE TABLE IF NOT EXISTS stream_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  unique_viewers INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  peak_concurrent_viewers INTEGER DEFAULT 0,
  total_watch_time BIGINT DEFAULT 0,
  avg_watch_duration DECIMAL(10,2) DEFAULT 0,
  geographic_data TEXT,
  device_data TEXT,
  quality_metrics TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stream_id, date)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  metadata TEXT,
  is_read BOOLEAN DEFAULT false,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Six Sigma metrics table
CREATE TABLE IF NOT EXISTS six_sigma_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  value DECIMAL(15,6) NOT NULL,
  target DECIMAL(15,6) NOT NULL,
  sigma_level DECIMAL(10,6),
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(5,2),
  disk_usage DECIMAL(5,2),
  active_connections INTEGER DEFAULT 0,
  active_streams INTEGER DEFAULT 0,
  network_io DECIMAL(15,2),
  response_time DECIMAL(10,3),
  is_healthy BOOLEAN DEFAULT true,
  alerts TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  refresh_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_stream_key ON streams(stream_key);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_user_status ON streams(user_id, status);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_stream_id ON stream_sessions(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_date ON stream_analytics(date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_six_sigma_metrics_name ON six_sigma_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_six_sigma_metrics_date ON six_sigma_metrics(date);
CREATE INDEX IF NOT EXISTS idx_system_health_created_at ON system_health(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);

-- Insert initial admin user (password: Admin123!)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, email_verified)
VALUES 
  (uuid_generate_v4(), 'admin@cruvz.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewbmh.LuVzx/VJua', 'Admin', 'User', 'admin', true, true),
  (uuid_generate_v4(), 'demo@cruvz.com', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo', 'User', 'user', true, true)
ON CONFLICT (email) DO NOTHING;

-- Insert sample streaming data
INSERT INTO system_health (cpu_usage, memory_usage, disk_usage, active_connections, active_streams, network_io, response_time, is_healthy)
VALUES 
  (25.5, 60.2, 45.8, 150, 5, 1024.5, 25.3, true),
  (30.1, 55.8, 50.2, 200, 8, 2048.7, 30.1, true)
ON CONFLICT DO NOTHING;

-- Insert sample Six Sigma metrics
INSERT INTO six_sigma_metrics (metric_name, metric_type, value, target, sigma_level, date)
VALUES 
  ('Stream Uptime', 'performance', 99.95, 99.90, 4.5, CURRENT_DATE),
  ('Connection Success Rate', 'quality', 99.8, 99.5, 4.2, CURRENT_DATE),
  ('Error Rate', 'defect', 0.02, 0.05, 5.1, CURRENT_DATE)
ON CONFLICT DO NOTHING;

SELECT 'Database schema created successfully!' as result;