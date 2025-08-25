#!/usr/bin/env node
/**
 * Development database setup script
 * Creates SQLite database with all required tables
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Import database configuration
require('dotenv').config({ path: '../.env' });
const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

async function setupDatabase() {
  console.log('🚀 Setting up development database...');
  
  try {
    // Remove existing database file if it exists
    const dbPath = path.join(__dirname, 'dev-database.sqlite');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✨ Removed existing database');
    }

    // Create all tables manually
    console.log('📋 Creating database tables...');
    
    // Users table
    await knex.schema.createTable('users', (table) => {
      table.string('id', 36).primary();
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('first_name', 100);
      table.string('last_name', 100);
      table.string('role').defaultTo('user');
      table.boolean('is_active').defaultTo(true);
      table.boolean('email_verified').defaultTo(false);
      table.string('avatar_url', 500);
      table.integer('max_streams').defaultTo(5);
      table.integer('max_viewers_per_stream').defaultTo(1000);
      table.timestamp('last_login_at');
      table.timestamps(true, true);
      
      table.index(['email']);
      table.index(['role']);
      table.index(['is_active']);
    });

    // API Keys table
    await knex.schema.createTable('api_keys', (table) => {
      table.string('id', 36).primary();
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      table.string('key_hash', 255).notNullable().unique();
      table.string('name', 100).notNullable();
      table.text('permissions');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('expires_at');
      table.timestamp('last_used_at');
      table.timestamps(true, true);
      
      table.index(['key_hash']);
      table.index(['user_id']);
    });

    // Streams table
    await knex.schema.createTable('streams', (table) => {
      table.string('id', 36).primary();
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      table.string('title', 200).notNullable();
      table.text('description');
      table.string('stream_key', 100).notNullable().unique();
      table.string('protocol').defaultTo('rtmp');
      table.string('source_url', 500);
      table.string('destination_url', 500);
      table.string('status').defaultTo('inactive');
      table.text('settings');
      table.integer('max_viewers').defaultTo(1000);
      table.integer('current_viewers').defaultTo(0);
      table.boolean('is_recording').defaultTo(false);
      table.string('recording_url', 500);
      table.timestamp('started_at');
      table.timestamp('ended_at');
      table.bigInteger('total_view_time').defaultTo(0);
      table.integer('peak_viewers').defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['stream_key']);
      table.index(['status']);
    });

    // Stream Sessions table
    await knex.schema.createTable('stream_sessions', (table) => {
      table.string('id', 36).primary();
      table.string('stream_id', 36).references('id').inTable('streams').onDelete('CASCADE');
      table.string('viewer_ip', 45);
      table.string('user_agent', 500);
      table.string('location', 100);
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.timestamp('left_at');
      table.integer('watch_duration').defaultTo(0);
      table.text('quality_metrics');
      
      table.index(['stream_id']);
      table.index(['joined_at']);
    });

    // Stream Analytics table
    await knex.schema.createTable('stream_analytics', (table) => {
      table.string('id', 36).primary();
      table.string('stream_id', 36).references('id').inTable('streams').onDelete('CASCADE');
      table.date('date').notNullable();
      table.integer('unique_viewers').defaultTo(0);
      table.integer('total_views').defaultTo(0);
      table.integer('peak_concurrent_viewers').defaultTo(0);
      table.bigInteger('total_watch_time').defaultTo(0);
      table.decimal('avg_watch_duration', 10, 2).defaultTo(0);
      table.text('geographic_data');
      table.text('device_data');
      table.text('quality_metrics');
      table.timestamps(true, true);
      
      table.unique(['stream_id', 'date']);
      table.index(['stream_id']);
      table.index(['date']);
    });

    // Notifications table
    await knex.schema.createTable('notifications', (table) => {
      table.string('id', 36).primary();
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      table.string('type', 50).notNullable();
      table.string('title', 200).notNullable();
      table.text('message');
      table.text('metadata');
      table.boolean('is_read').defaultTo(false);
      table.timestamp('expires_at');
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['is_read']);
    });

    // Six Sigma Metrics table
    await knex.schema.createTable('six_sigma_metrics', (table) => {
      table.string('id', 36).primary();
      table.string('metric_name', 100).notNullable();
      table.string('metric_type', 50).notNullable();
      table.decimal('value', 15, 6).notNullable();
      table.decimal('target', 15, 6).notNullable();
      table.decimal('sigma_level', 10, 6);
      table.date('date').notNullable();
      table.timestamp('measured_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      
      table.index(['metric_name']);
      table.index(['date']);
    });

    // System Health table
    await knex.schema.createTable('system_health', (table) => {
      table.string('id', 36).primary();
      table.decimal('cpu_usage', 5, 2);
      table.decimal('memory_usage', 5, 2);
      table.decimal('disk_usage', 5, 2);
      table.integer('active_connections').defaultTo(0);
      table.integer('active_streams').defaultTo(0);
      table.decimal('network_in_mbps', 15, 2);
      table.decimal('network_out_mbps', 15, 2);
      table.decimal('response_time', 10, 3);
      table.boolean('is_healthy').defaultTo(true);
      table.text('alerts');
      table.timestamp('recorded_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      
      table.index(['recorded_at']);
      table.index(['is_healthy']);
    });

    // User Sessions table
    await knex.schema.createTable('user_sessions', (table) => {
      table.string('id', 36).primary();
      table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      table.string('session_token', 255).notNullable().unique();
      table.string('refresh_token', 255).notNullable().unique();
      table.string('ip_address', 45);
      table.string('user_agent', 500);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('expires_at').notNullable();
      table.timestamp('last_activity').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      
      table.index(['user_id']);
      table.index(['session_token']);
    });

    console.log('✅ Database tables created successfully');

    // Insert sample data
    console.log('🌱 Seeding sample data...');
    
    // Create admin user
    const adminId = uuidv4();
    const adminPassword = await bcrypt.hash('Adm1n_Test_2025!_Qx7R$$gL3', 12);
    
    await knex('users').insert({
      id: adminId,
      email: 'admin@cruvzstreaming.com',
      password_hash: adminPassword,
      first_name: 'System',
      last_name: 'Administrator',
      role: 'admin',
      is_active: true,
      email_verified: true,
      max_streams: 1000,
      max_viewers_per_stream: 10000
    });

    // Create demo streamer
    const streamerId = uuidv4();
    const streamerPassword = await bcrypt.hash('Demo123!_Stream', 12);
    
    await knex('users').insert({
      id: streamerId,
      email: 'demo.streamer@cruvz.com',
      password_hash: streamerPassword,
      first_name: 'Demo',
      last_name: 'Streamer',
      role: 'streamer',
      is_active: true,
      email_verified: true,
      max_streams: 10,
      max_viewers_per_stream: 5000
    });

    // Create sample streams
    const stream1Id = uuidv4();
    const stream2Id = uuidv4();
    
    await knex('streams').insert([
      {
        id: stream1Id,
        user_id: streamerId,
        title: 'Gaming Stream - Live Gameplay',
        description: 'Join me for some epic gaming action!',
        stream_key: 'live_' + Math.random().toString(36).substring(7),
        protocol: 'rtmp',
        status: 'active',
        current_viewers: 847,
        peak_viewers: 1203,
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        settings: JSON.stringify({
          quality: '1080p',
          bitrate: 6000,
          fps: 60
        })
      },
      {
        id: stream2Id,
        user_id: streamerId,
        title: 'Music Production Workshop',
        description: 'Learn music production techniques live',
        stream_key: 'music_' + Math.random().toString(36).substring(7),
        protocol: 'webrtc',
        status: 'active',
        current_viewers: 234,
        peak_viewers: 456,
        started_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        settings: JSON.stringify({
          quality: '720p',
          bitrate: 3000,
          fps: 30
        })
      }
    ]);

    // Create sample analytics data for the last 7 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      await knex('stream_analytics').insert([
        {
          id: uuidv4(),
          stream_id: stream1Id,
          date: date.toISOString().split('T')[0],
          unique_viewers: Math.floor(Math.random() * 1000) + 500,
          total_views: Math.floor(Math.random() * 1500) + 800,
          peak_concurrent_viewers: Math.floor(Math.random() * 1200) + 600,
          total_watch_time: Math.floor(Math.random() * 50000) + 20000,
          avg_watch_duration: Math.floor(Math.random() * 1800) + 600,
          geographic_data: JSON.stringify({
            US: 45,
            CA: 20,
            UK: 15,
            DE: 10,
            Others: 10
          }),
          device_data: JSON.stringify({
            Desktop: 60,
            Mobile: 30,
            Tablet: 10
          })
        },
        {
          id: uuidv4(),
          stream_id: stream2Id,
          date: date.toISOString().split('T')[0],
          unique_viewers: Math.floor(Math.random() * 400) + 200,
          total_views: Math.floor(Math.random() * 600) + 300,
          peak_concurrent_viewers: Math.floor(Math.random() * 500) + 250,
          total_watch_time: Math.floor(Math.random() * 20000) + 10000,
          avg_watch_duration: Math.floor(Math.random() * 2400) + 900,
          geographic_data: JSON.stringify({
            US: 40,
            CA: 25,
            UK: 12,
            AU: 13,
            Others: 10
          }),
          device_data: JSON.stringify({
            Desktop: 70,
            Mobile: 20,
            Tablet: 10
          })
        }
      ]);
    }

    // Create Six Sigma metrics
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      await knex('six_sigma_metrics').insert([
        {
          id: uuidv4(),
          metric_name: 'stream_quality',
          metric_type: 'quality',
          value: 99.5 + Math.random() * 0.4,
          target: 99.9,
          sigma_level: 4.2 + Math.random() * 0.8,
          date: date.toISOString().split('T')[0]
        },
        {
          id: uuidv4(),
          metric_name: 'latency',
          metric_type: 'performance',
          value: 150 + Math.random() * 50,
          target: 100,
          sigma_level: 3.8 + Math.random() * 0.6,
          date: date.toISOString().split('T')[0]
        }
      ]);
    }

    console.log('✅ Sample data seeded successfully');
    console.log('\n🎉 Development database setup complete!');
    console.log('\n📝 Sample Users:');
    console.log('   👤 Admin: admin@cruvzstreaming.com / Adm1n_Test_2025!_Qx7R$$gL3');
    console.log('   👤 Streamer: demo.streamer@cruvz.com / Demo123!_Stream');
    console.log('\n📺 Sample Streams: 2 active streams with analytics data');
    console.log('📊 Sample Analytics: 7 days of stream analytics');
    console.log('⚡ Sample Metrics: Six Sigma performance data');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

if (require.main === module) {
  setupDatabase().catch(error => {
    console.error('💥 Setup script failed:', error);
    process.exit(1);
  });
}

module.exports = { setupDatabase };