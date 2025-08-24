const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Development database configuration using SQLite for easy setup
const isProduction = process.env.NODE_ENV === 'production';

// Ensure directories exist (for SQLite file)
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Development configuration - SQLite for easy setup
const config = {
  client: 'sqlite3',
  connection: {
    filename: path.join(dataDir, 'cruvz-dev.sqlite')
  },
  useNullAsDefault: true,
  pool: {
    min: 1,
    max: 5
  },
  migrations: {
    directory: path.join(__dirname, '../scripts/migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../scripts/seeds')
  }
};

const db = knex(config);

// Initialize basic tables for development
async function initDevTables() {
  try {
    // Create users table
    const hasUsers = await db.schema.hasTable('users');
    if (!hasUsers) {
      await db.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('email').unique().notNullable();
        table.string('password_hash').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
    }

    // Create streams table
    const hasStreams = await db.schema.hasTable('streams');
    if (!hasStreams) {
      await db.schema.createTable('streams', (table) => {
        table.increments('id').primary();
        table.integer('user_id').references('id').inTable('users');
        table.string('title').notNullable();
        table.string('description');
        table.string('stream_key').unique().notNullable();
        table.string('status').defaultTo('idle'); // idle, live, ended
        table.string('protocol').defaultTo('rtmp'); // rtmp, webrtc, srt
        table.integer('current_viewers').defaultTo(0);
        table.integer('peak_viewers').defaultTo(0);
        table.timestamp('started_at');
        table.timestamp('ended_at');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
    }

    // Create stream_analytics table
    const hasAnalytics = await db.schema.hasTable('stream_analytics');
    if (!hasAnalytics) {
      await db.schema.createTable('stream_analytics', (table) => {
        table.increments('id').primary();
        table.integer('stream_id').references('id').inTable('streams');
        table.integer('current_viewers').defaultTo(0);
        table.integer('peak_viewers').defaultTo(0);
        table.integer('total_viewers').defaultTo(0);
        table.integer('duration_seconds').defaultTo(0);
        table.float('average_bitrate').defaultTo(0);
        table.integer('data_transferred_mb').defaultTo(0);
        table.timestamp('recorded_at').defaultTo(db.fn.now());
      });
    }

    // Create six_sigma_metrics table
    const hasMetrics = await db.schema.hasTable('six_sigma_metrics');
    if (!hasMetrics) {
      await db.schema.createTable('six_sigma_metrics', (table) => {
        table.increments('id').primary();
        table.string('metric_type').notNullable(); // latency, cpu, memory, etc
        table.float('value').notNullable();
        table.string('unit').notNullable(); // ms, %, MB, etc
        table.timestamp('measured_at').defaultTo(db.fn.now());
      });
    }

    // Insert some sample data for testing
    const userCount = await db('users').count('id as count').first();
    if (userCount.count === 0) {
      // Insert test user
      const [userId] = await db('users').insert({
        name: 'Test User',
        email: 'test@cruvz.com',
        password_hash: '$2b$12$dummyhash' // Dummy hash for testing
      }).returning('id');

      // Insert test streams
      const streamData = [
        {
          user_id: userId,
          title: 'Live Gaming Stream',
          description: 'Playing the latest games',
          stream_key: 'test-stream-key-1',
          status: 'live',
          protocol: 'rtmp',
          current_viewers: 45,
          peak_viewers: 78,
          started_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // Started 2 hours ago
        },
        {
          user_id: userId,
          title: 'Music Performance',
          description: 'Live acoustic performance',
          stream_key: 'test-stream-key-2',
          status: 'live',
          protocol: 'webrtc',
          current_viewers: 23,
          peak_viewers: 34,
          started_at: new Date(Date.now() - 1 * 60 * 60 * 1000) // Started 1 hour ago
        },
        {
          user_id: userId,
          title: 'Tech Talk',
          description: 'Discussion about latest tech trends',
          stream_key: 'test-stream-key-3',
          status: 'ended',
          protocol: 'srt',
          current_viewers: 0,
          peak_viewers: 156,
          started_at: new Date(Date.now() - 5 * 60 * 60 * 1000), // Started 5 hours ago
          ended_at: new Date(Date.now() - 1 * 60 * 60 * 1000) // Ended 1 hour ago
        }
      ];

      await db('streams').insert(streamData);

      // Insert sample analytics data
      const streams = await db('streams').select('id');
      for (const stream of streams) {
        // Insert multiple analytics records to simulate real-time data
        for (let i = 0; i < 10; i++) {
          await db('stream_analytics').insert({
            stream_id: stream.id,
            current_viewers: Math.floor(Math.random() * 100) + 10,
            peak_viewers: Math.floor(Math.random() * 150) + 50,
            total_viewers: Math.floor(Math.random() * 500) + 100,
            duration_seconds: i * 300, // Every 5 minutes
            average_bitrate: Math.random() * 5000 + 1000,
            data_transferred_mb: Math.floor(Math.random() * 1000) + 100,
            recorded_at: new Date(Date.now() - (10 - i) * 5 * 60 * 1000) // 5 minute intervals
          });
        }
      }

      // Insert sample metrics data
      const metricTypes = ['latency', 'cpu_usage', 'memory_usage', 'disk_usage'];
      for (let i = 0; i < 50; i++) {
        for (const metricType of metricTypes) {
          let value, unit;
          switch (metricType) {
            case 'latency':
              value = Math.random() * 50 + 50; // 50-100ms
              unit = 'ms';
              break;
            case 'cpu_usage':
              value = Math.random() * 80 + 10; // 10-90%
              unit = '%';
              break;
            case 'memory_usage':
              value = Math.random() * 70 + 20; // 20-90%
              unit = '%';
              break;
            case 'disk_usage':
              value = Math.random() * 50 + 30; // 30-80%
              unit = '%';
              break;
          }

          await db('six_sigma_metrics').insert({
            metric_type: metricType,
            value: value,
            unit: unit,
            measured_at: new Date(Date.now() - i * 2 * 60 * 1000) // Every 2 minutes
          });
        }
      }

      console.log('✅ Development database initialized with sample data');
    }

  } catch (error) {
    console.error('❌ Failed to initialize dev tables:', error);
    throw error;
  }
}

module.exports = { db, initDevTables };