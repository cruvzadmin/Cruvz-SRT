/**
 * Database migrations for production streaming platform
 * Supports both PostgreSQL (production) and SQLite (development)
 */

exports.up = function(knex) {
  const isPostgreSQL = knex.client.config.client === 'pg';
  
  // Helper function to define UUID column
  const uuidColumn = (table, name) => {
    if (isPostgreSQL) {
      return table.uuid(name);
    } else {
      return table.string(name, 36); // SQLite: store UUID as string
    }
  };

  const schema = knex.schema;
  
  // Enable UUID extension for PostgreSQL only
  const createExtension = isPostgreSQL ? 
    schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"') : 
    Promise.resolve();

  return createExtension
    .then(() => schema.createTable('users', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      } else {
        table.string('id', 36).primary();
      }
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
      
      // Indexes for high-performance lookups
      table.index(['email']);
      table.index(['role']);
      table.index(['is_active']);
      table.index(['created_at']);
    }))
    .then(() => schema.createTable('api_keys', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      } else {
        table.string('id', 36).primary();
        table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      }
      table.string('key_hash', 255).notNullable().unique();
      table.string('name', 100).notNullable();
      table.text('permissions');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('expires_at');
      table.timestamp('last_used_at');
      table.timestamps(true, true);
      
      // Indexes for API key lookups
      table.index(['key_hash']);
      table.index(['user_id']);
      table.index(['is_active']);
    }))
    .then(() => schema.createTable('streams', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      } else {
        table.string('id', 36).primary();
        table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      }
      table.string('title', 200).notNullable();
      table.text('description');
      table.string('stream_key', 100).notNullable().unique();
      table.string('protocol').defaultTo('rtmp');
      table.string('source_url', 500);
      table.string('destination_url', 500);
      table.string('status').defaultTo('inactive');
      table.text('settings'); // JSON field
      table.integer('max_viewers').defaultTo(1000);
      table.integer('current_viewers').defaultTo(0);
      table.boolean('is_recording').defaultTo(false);
      table.string('recording_url', 500);
      table.timestamp('started_at');
      table.timestamp('ended_at');
      table.bigInteger('total_view_time').defaultTo(0); // in seconds
      table.integer('peak_viewers').defaultTo(0);
      table.timestamps(true, true);
      
      // High-performance indexes for streaming queries
      table.index(['user_id']);
      table.index(['stream_key']);
      table.index(['status']);
      table.index(['protocol']);
      table.index(['started_at']);
      table.index(['created_at']);
      table.index(['user_id', 'status']); // Composite index for user streams
    }))
    .then(() => schema.createTable('stream_sessions', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('stream_id').references('id').inTable('streams').onDelete('CASCADE');
      } else {
        table.string('id', 36).primary();
        table.string('stream_id', 36).references('id').inTable('streams').onDelete('CASCADE');
      }
      table.string('viewer_ip', 45); // IPv6 support
      table.string('user_agent', 500);
      table.string('location', 100);
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.timestamp('left_at');
      table.integer('watch_duration').defaultTo(0); // in seconds
      table.text('quality_metrics'); // JSON field
      
      // Indexes for analytics and real-time tracking
      table.index(['stream_id']);
      table.index(['joined_at']);
      table.index(['viewer_ip']);
      table.index(['stream_id', 'joined_at']); // Composite for session analytics
    }))
    .then(() => schema.createTable('stream_analytics', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('stream_id').references('id').inTable('streams').onDelete('CASCADE');
      } else {
        table.string('id', 36).primary();
        table.string('stream_id', 36).references('id').inTable('streams').onDelete('CASCADE');
      }
      table.date('date').notNullable();
      table.integer('unique_viewers').defaultTo(0);
      table.integer('total_views').defaultTo(0);
      table.integer('peak_concurrent_viewers').defaultTo(0);
      table.bigInteger('total_watch_time').defaultTo(0);
      table.decimal('avg_watch_duration', 10, 2).defaultTo(0);
      table.text('geographic_data'); // JSON field
      table.text('device_data'); // JSON field
      table.text('quality_metrics'); // JSON field
      table.timestamps(true, true);
      
      // Unique constraint and indexes for analytics
      table.unique(['stream_id', 'date']);
      table.index(['stream_id']);
      table.index(['date']);
    }))
    .then(() => schema.createTable('notifications', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      } else {
        table.string('id', 36).primary();
        table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      }
      table.string('type', 50).notNullable();
      table.string('title', 200).notNullable();
      table.text('message');
      table.text('metadata'); // JSON field
      table.boolean('is_read').defaultTo(false);
      table.timestamp('expires_at');
      table.timestamps(true, true);
      
      // Indexes for notification queries
      table.index(['user_id']);
      table.index(['is_read']);
      table.index(['created_at']);
      table.index(['user_id', 'is_read']); // Composite for unread notifications
    }))
    .then(() => schema.createTable('six_sigma_metrics', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      } else {
        table.string('id', 36).primary();
      }
      table.string('metric_name', 100).notNullable();
      table.string('metric_type', 50).notNullable(); // 'defect', 'performance', 'quality'
      table.decimal('value', 15, 6).notNullable();
      table.decimal('target', 15, 6).notNullable();
      table.decimal('sigma_level', 10, 6);
      table.date('date').notNullable();
      table.timestamp('measured_at').defaultTo(knex.fn.now()); // Add timestamp for analytics
      table.timestamps(true, true);
      
      table.index(['metric_name']);
      table.index(['metric_type']);
      table.index(['date']);
      table.index(['metric_name', 'date']); // Composite for time series
    }))
    .then(() => schema.createTable('system_health', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      } else {
        table.string('id', 36).primary();
      }
      table.decimal('cpu_usage', 5, 2);
      table.decimal('memory_usage', 5, 2);
      table.decimal('disk_usage', 5, 2);
      table.integer('active_connections').defaultTo(0);
      table.integer('active_streams').defaultTo(0);
      table.decimal('network_in_mbps', 15, 2); // Network input in Mbps
      table.decimal('network_out_mbps', 15, 2); // Network output in Mbps 
      table.decimal('response_time', 10, 3); // milliseconds
      table.boolean('is_healthy').defaultTo(true);
      table.text('alerts'); // JSON field
      table.timestamp('recorded_at').defaultTo(knex.fn.now()); // Add timestamp for system health tracking
      table.timestamps(true, true);
      
      table.index(['created_at']);
      table.index(['recorded_at']); // Index for time-based queries
      table.index(['is_healthy']);
    }))
    .then(() => schema.createTable('user_sessions', (table) => {
      if (isPostgreSQL) {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      } else {
        table.string('id', 36).primary();
        table.string('user_id', 36).references('id').inTable('users').onDelete('CASCADE');
      }
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
      table.index(['refresh_token']);
      table.index(['is_active']);
      table.index(['expires_at']);
    }));
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('user_sessions')
    .dropTableIfExists('system_health')
    .dropTableIfExists('six_sigma_metrics')
    .dropTableIfExists('notifications')
    .dropTableIfExists('stream_analytics')
    .dropTableIfExists('stream_sessions')
    .dropTableIfExists('streams')
    .dropTableIfExists('api_keys')
    .dropTableIfExists('users');
};