/**
 * Direct database schema setup for Cruvz Streaming Platform
 * Bypasses Knex migration issues and creates all tables directly
 */

const db = require('./config/database.js');

async function setupDatabase() {
  console.log('🔄 Setting up Cruvz Streaming Platform database schema...');
  
  try {
    // Create UUID extension for PostgreSQL
    console.log('Creating UUID extension...');
    await db.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ UUID extension ready');
    
    // Drop existing tables if they exist (for clean setup)
    console.log('Dropping existing tables (if any)...');
    await db.schema.dropTableIfExists('user_sessions');
    await db.schema.dropTableIfExists('system_health');
    await db.schema.dropTableIfExists('six_sigma_metrics');
    await db.schema.dropTableIfExists('notifications');
    await db.schema.dropTableIfExists('stream_analytics');
    await db.schema.dropTableIfExists('stream_sessions');
    await db.schema.dropTableIfExists('streams');
    await db.schema.dropTableIfExists('api_keys');
    await db.schema.dropTableIfExists('users');
    console.log('✅ Existing tables dropped');
    
    // USERS TABLE
    console.log('Creating users table...');
    await db.schema.createTable('users', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
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
      table.index(['created_at']);
    });
    console.log('✅ Users table created');

    // API_KEYS TABLE
    console.log('Creating api_keys table...');
    await db.schema.createTable('api_keys', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('key_hash', 255).notNullable().unique();
      table.string('name', 100).notNullable();
      table.text('permissions');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('expires_at');
      table.timestamp('last_used_at');
      table.timestamps(true, true);
      table.index(['key_hash']);
      table.index(['user_id']);
      table.index(['is_active']);
    });
    console.log('✅ API keys table created');

    // STREAMS TABLE
    console.log('Creating streams table...');
    await db.schema.createTable('streams', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
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
      table.index(['protocol']);
      table.index(['started_at']);
      table.index(['created_at']);
      table.index(['user_id', 'status']);
    });
    console.log('✅ Streams table created');

    // STREAM_SESSIONS TABLE
    console.log('Creating stream_sessions table...');
    await db.schema.createTable('stream_sessions', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('stream_id').references('id').inTable('streams').onDelete('CASCADE');
      table.string('viewer_ip', 45);
      table.string('user_agent', 500);
      table.string('location', 100);
      table.timestamp('joined_at').defaultTo(db.fn.now());
      table.timestamp('left_at');
      table.integer('watch_duration').defaultTo(0);
      table.text('quality_metrics');
      table.index(['stream_id']);
      table.index(['joined_at']);
      table.index(['viewer_ip']);
      table.index(['stream_id', 'joined_at']);
    });
    console.log('✅ Stream sessions table created');

    // STREAM_ANALYTICS TABLE
    console.log('Creating stream_analytics table...');
    await db.schema.createTable('stream_analytics', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('stream_id').references('id').inTable('streams').onDelete('CASCADE');
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
    console.log('✅ Stream analytics table created');

    // NOTIFICATIONS TABLE
    console.log('Creating notifications table...');
    await db.schema.createTable('notifications', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('type', 50).notNullable();
      table.string('title', 200).notNullable();
      table.text('message');
      table.text('metadata');
      table.boolean('is_read').defaultTo(false);
      table.timestamp('expires_at');
      table.timestamps(true, true);
      table.index(['user_id']);
      table.index(['is_read']);
      table.index(['created_at']);
      table.index(['user_id', 'is_read']);
    });
    console.log('✅ Notifications table created');

    // SIX_SIGMA_METRICS TABLE
    console.log('Creating six_sigma_metrics table...');
    await db.schema.createTable('six_sigma_metrics', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.string('metric_name', 100).notNullable();
      table.string('metric_type', 50).notNullable();
      table.decimal('value', 15, 6).notNullable();
      table.decimal('target', 15, 6).notNullable();
      table.decimal('sigma_level', 10, 6);
      table.date('date').notNullable();
      table.timestamp('measured_at').defaultTo(db.fn.now());
      table.timestamps(true, true);
      table.index(['metric_name']);
      table.index(['metric_type']);
      table.index(['date']);
      table.index(['metric_name', 'date']);
    });
    console.log('✅ Six sigma metrics table created');

    // SYSTEM_HEALTH TABLE
    console.log('Creating system_health table...');
    await db.schema.createTable('system_health', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
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
      table.timestamp('recorded_at').defaultTo(db.fn.now());
      table.timestamps(true, true);
      table.index(['created_at']);
      table.index(['recorded_at']);
      table.index(['is_healthy']);
    });
    console.log('✅ System health table created');

    // USER_SESSIONS TABLE
    console.log('Creating user_sessions table...');
    await db.schema.createTable('user_sessions', table => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('session_token', 255).notNullable().unique();
      table.string('refresh_token', 255).notNullable().unique();
      table.string('ip_address', 45);
      table.string('user_agent', 500);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('expires_at').notNullable();
      table.timestamp('last_activity').defaultTo(db.fn.now());
      table.timestamps(true, true);
      table.index(['user_id']);
      table.index(['session_token']);
      table.index(['refresh_token']);
      table.index(['is_active']);
      table.index(['expires_at']);
    });
    console.log('✅ User sessions table created');

    // Verify all tables were created
    console.log('🔄 Verifying database schema...');
    const result = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name NOT LIKE 'pg_%' 
      AND table_name NOT LIKE 'knex_%' 
      ORDER BY table_name
    `);
    
    const tables = result.rows.map(r => r.table_name);
    console.log('✅ Database schema verification:');
    console.log('Tables created:', tables);
    
    const expectedTables = [
      'api_keys', 'notifications', 'six_sigma_metrics', 'stream_analytics', 
      'stream_sessions', 'streams', 'system_health', 'user_sessions', 'users'
    ];
    
    const missingTables = expectedTables.filter(table => !tables.includes(table));
    if (missingTables.length === 0) {
      console.log('🎉 All database tables created successfully!');
      console.log('📊 Database schema is ready for production use.');
    } else {
      console.error('❌ Missing tables:', missingTables);
      throw new Error('Database setup incomplete');
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase().then(() => {
    console.log('Database setup completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('Database setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { setupDatabase };