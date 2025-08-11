const db = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Utility: Check if a table exists (database-agnostic)
async function tableExists(tableName) {
  try {
    const hasTable = await db.schema.hasTable(tableName);
    return hasTable;
  } catch (error) {
    logger.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

// Utility: Check if a column exists in a table (database-agnostic)
async function columnExists(tableName, columnName) {
  try {
    const hasColumn = await db.schema.hasColumn(tableName, columnName);
    return hasColumn;
  } catch (error) {
    logger.error(`Error checking if column ${columnName} exists in table ${tableName}:`, error);
    return false;
  }
}

async function migrate() {
  try {
    logger.info('Starting database migration...');

    // Users table
    if (!(await tableExists('users'))) {
      await db.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('email').unique().notNullable();
        table.string('password').notNullable();
        table.string('name').notNullable();
        table.string('role').defaultTo('user'); // user, admin, moderator
        table.boolean('is_active').defaultTo(true);
        table.timestamp('email_verified_at').nullable();
        table.string('avatar_url').nullable();
        table.json('preferences').nullable();
        table.timestamp('last_login').nullable();
        table.timestamps(true, true);
      });
      logger.info('Users table created');
    } else {
      logger.info('Users table already exists');
    }

    // API Keys table
    if (!(await tableExists('api_keys'))) {
      await db.schema.createTable('api_keys', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.string('name').notNullable();
        table.string('key_hash').notNullable();
        table.string('permissions').defaultTo('read'); // read, write, admin
        table.boolean('is_active').defaultTo(true);
        table.timestamp('expires_at').nullable();
        table.timestamp('last_used').nullable();
        table.timestamps(true, true);
      });
      logger.info('API Keys table created');
    } else {
      logger.info('API Keys table already exists');
    }

    // Streams table
    if (!(await tableExists('streams'))) {
      await db.schema.createTable('streams', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.string('title').notNullable();
        table.text('description').nullable();
        table.string('stream_key').unique().notNullable();
        table.string('status').defaultTo('inactive'); // inactive, live, ended, error
        table.string('protocol').defaultTo('rtmp'); // rtmp, srt, webrtc
        table.string('source_url').nullable(); // Input URL where stream content comes from
        table.string('destination_url').nullable(); // Output URL where stream is published
        table.json('settings').nullable(); // quality, bitrate, etc.
        table.integer('max_viewers').defaultTo(1000);
        table.boolean('is_recording').defaultTo(false);
        table.string('recording_path').nullable();
        table.timestamp('started_at').nullable();
        table.timestamp('ended_at').nullable();
        table.timestamps(true, true);
      });
      logger.info('Streams table created');
    } else {
      logger.info('Streams table already exists');

      // Check and add source_url and destination_url columns if they don't exist
      if (!(await columnExists('streams', 'source_url'))) {
        await db.schema.alterTable('streams', (table) => {
          table.string('source_url').nullable();
        });
        logger.info('Added source_url column to streams table');
      }
      if (!(await columnExists('streams', 'destination_url'))) {
        await db.schema.alterTable('streams', (table) => {
          table.string('destination_url').nullable();
        });
        logger.info('Added destination_url column to streams table');
      }
    }

    // Stream Analytics table
    if (!(await tableExists('stream_analytics'))) {
      await db.schema.createTable('stream_analytics', (table) => {
        table.increments('id').primary();
        table.integer('stream_id').unsigned().references('id').inTable('streams').onDelete('CASCADE');
        table.integer('current_viewers').defaultTo(0);
        table.integer('peak_viewers').defaultTo(0);
        table.integer('total_viewers').defaultTo(0);
        table.decimal('duration_seconds', 10, 2).defaultTo(0);
        table.decimal('data_transferred_mb', 15, 2).defaultTo(0);
        table.decimal('average_bitrate', 10, 2).defaultTo(0);
        table.integer('dropped_frames').defaultTo(0);
        table.decimal('cpu_usage', 5, 2).defaultTo(0);
        table.decimal('memory_usage', 10, 2).defaultTo(0);
        table.timestamp('recorded_at').defaultTo(db.fn.now());
      });
      logger.info('Stream Analytics table created');
    } else {
      logger.info('Stream Analytics table already exists');
    }

    // Six Sigma Metrics table
    if (!(await tableExists('six_sigma_metrics'))) {
      await db.schema.createTable('six_sigma_metrics', (table) => {
        table.increments('id').primary();
        table.string('metric_type').notNullable(); // defect_rate, performance, availability
        table.string('category').notNullable(); // streaming, auth, api, system
        table.decimal('value', 15, 6).notNullable();
        table.decimal('target', 15, 6).notNullable();
        table.decimal('sigma_level', 5, 2).notNullable();
        table.boolean('is_within_spec').defaultTo(true);
        table.json('metadata').nullable();
        table.timestamp('measured_at').defaultTo(db.fn.now());
        table.timestamps(true, true);
      });
      logger.info('Six Sigma Metrics table created');
    } else {
      logger.info('Six Sigma Metrics table already exists');
    }

    // System Health table
    if (!(await tableExists('system_health'))) {
      await db.schema.createTable('system_health', (table) => {
        table.increments('id').primary();
        table.decimal('cpu_usage', 5, 2).notNullable();
        table.decimal('memory_usage', 10, 2).notNullable();
        table.decimal('disk_usage', 10, 2).notNullable();
        table.integer('active_connections').defaultTo(0);
        table.integer('active_streams').defaultTo(0);
        table.decimal('network_in_mbps', 10, 2).defaultTo(0);
        table.decimal('network_out_mbps', 10, 2).defaultTo(0);
        table.decimal('uptime_seconds', 15, 2).defaultTo(0);
        table.timestamp('recorded_at').defaultTo(db.fn.now());
      });
      logger.info('System Health table created');
    } else {
      logger.info('System Health table already exists');
    }

    // User Sessions table
    if (!(await tableExists('user_sessions'))) {
      await db.schema.createTable('user_sessions', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.string('session_token').unique().notNullable();
        table.string('ip_address').nullable();
        table.string('user_agent').nullable();
        table.boolean('is_active').defaultTo(true);
        table.timestamp('expires_at').notNullable();
        table.timestamps(true, true);
      });
      logger.info('User Sessions table created');
    } else {
      logger.info('User Sessions table already exists');
    }

    // Create default admin user
    const adminExists = await db('users').where({ email: 'admin@cruvzstreaming.com' }).first();
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'changeme123!', 12);
      await db('users').insert({
        email: 'admin@cruvzstreaming.com',
        password: hashedPassword,
        name: 'System Administrator',
        role: 'admin',
        is_active: true,
        email_verified_at: new Date()
      });
      logger.info('Default admin user created');
    } else {
      logger.info('Default admin user already exists');
    }

    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Database migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;
