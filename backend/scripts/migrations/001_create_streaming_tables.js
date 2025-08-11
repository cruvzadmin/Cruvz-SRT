/**
 * Database migrations for production streaming platform
 * Optimized for 1000+ users with PostgreSQL
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('first_name', 100);
      table.string('last_name', 100);
      table.enu('role', ['admin', 'user', 'streamer']).defaultTo('user');
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
    })
    .createTable('api_keys', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
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
    })
    .createTable('streams', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('title', 200).notNullable();
      table.text('description');
      table.string('stream_key', 100).notNullable().unique();
      table.enu('protocol', ['rtmp', 'srt', 'webrtc']).defaultTo('rtmp');
      table.string('source_url', 500);
      table.string('destination_url', 500);
      table.enu('status', ['inactive', 'active', 'ended', 'error']).defaultTo('inactive');
      table.json('settings'); // Quality, bitrate, fps, audio settings
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
    })
    .createTable('stream_sessions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('stream_id').references('id').inTable('streams').onDelete('CASCADE');
      table.string('viewer_ip', 45); // IPv6 support
      table.string('user_agent', 500);
      table.string('location', 100);
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.timestamp('left_at');
      table.integer('watch_duration').defaultTo(0); // in seconds
      table.json('quality_metrics'); // Buffering, quality changes, etc.
      
      // Indexes for analytics and real-time tracking
      table.index(['stream_id']);
      table.index(['joined_at']);
      table.index(['viewer_ip']);
      table.index(['stream_id', 'joined_at']); // Composite for session analytics
    })
    .createTable('stream_analytics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('stream_id').references('id').inTable('streams').onDelete('CASCADE');
      table.date('date').notNullable();
      table.integer('unique_viewers').defaultTo(0);
      table.integer('total_views').defaultTo(0);
      table.integer('peak_concurrent_viewers').defaultTo(0);
      table.bigInteger('total_watch_time').defaultTo(0);
      table.decimal('avg_watch_duration', 10, 2).defaultTo(0);
      table.json('geographic_data');
      table.json('device_data');
      table.json('quality_metrics');
      table.timestamps(true, true);
      
      // Unique constraint and indexes for analytics
      table.unique(['stream_id', 'date']);
      table.index(['stream_id']);
      table.index(['date']);
    })
    .createTable('notifications', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('type', 50).notNullable();
      table.string('title', 200).notNullable();
      table.text('message');
      table.json('metadata');
      table.boolean('is_read').defaultTo(false);
      table.timestamp('expires_at');
      table.timestamps(true, true);
      
      // Indexes for notification queries
      table.index(['user_id']);
      table.index(['is_read']);
      table.index(['created_at']);
      table.index(['user_id', 'is_read']); // Composite for unread notifications
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('notifications')
    .dropTableIfExists('stream_analytics')
    .dropTableIfExists('stream_sessions')
    .dropTableIfExists('streams')
    .dropTableIfExists('api_keys')
    .dropTableIfExists('users');
};