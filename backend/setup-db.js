// Simple database setup script for production deployment
const { Client } = require('pg');

async function setupDatabase() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Create the uuid extension first
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ Created uuid-ossp extension');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'streamer')),
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        avatar_url VARCHAR(500),
        max_streams INTEGER DEFAULT 5,
        max_viewers_per_stream INTEGER DEFAULT 1000,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created users table');

    // Create streams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS streams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        stream_key VARCHAR(100) NOT NULL UNIQUE,
        protocol VARCHAR(20) DEFAULT 'rtmp' CHECK (protocol IN ('rtmp', 'srt', 'webrtc')),
        source_url VARCHAR(500),
        destination_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'ended', 'error')),
        settings JSON,
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
      )
    `);
    console.log('✅ Created streams table');

    // Create stream_analytics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stream_analytics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        unique_viewers INTEGER DEFAULT 0,
        total_views INTEGER DEFAULT 0,
        peak_concurrent_viewers INTEGER DEFAULT 0,
        total_watch_time BIGINT DEFAULT 0,
        avg_watch_duration DECIMAL(10, 2) DEFAULT 0,
        geographic_data JSON,
        device_data JSON,
        quality_metrics JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stream_id, date)
      )
    `);
    console.log('✅ Created stream_analytics table');

    // Create six_sigma_metrics table for production metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS six_sigma_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        metric_name VARCHAR(100) NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        value DECIMAL(15, 6) NOT NULL,
        target DECIMAL(15, 6) NOT NULL,
        sigma_level DECIMAL(10, 6),
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created six_sigma_metrics table');

    // Create indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_streams_stream_key ON streams(stream_key)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_six_sigma_metrics_name ON six_sigma_metrics(metric_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_six_sigma_metrics_date ON six_sigma_metrics(date)');
    console.log('✅ Created database indexes');

    console.log('🎉 Production database setup complete!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
