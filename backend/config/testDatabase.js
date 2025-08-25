// Test database using PostgreSQL for production-ready testing
const knex = require('knex');

const config = {
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_TEST_DB || 'cruvzdb_test',
    port: process.env.POSTGRES_PORT || 5432,
  },
  pool: { min: 1, max: 5 }
};

const db = knex(config);

class TestDB {
  constructor() {
    this.db = db;
    this._init();
  }

  async _init() {
    try {
      await this.initializeTables();
      console.log('[INFO] ✅ In-memory SQLite database initialized');
    } catch (err) {
      console.error('[ERROR] Database initialization failed:', err);
    }
  }

  async initializeTables() {
    // Create users table
    await this.db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      table.string('name').notNullable();
      table.string('role').defaultTo('user');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });

    // Create streams table
    await this.db.schema.createTable('streams', (table) => {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('title').notNullable();
      table.text('description');
      table.string('stream_key').unique().notNullable();
      table.string('status').defaultTo('inactive'); // active, inactive, live
      table.boolean('is_private').defaultTo(false);
      table.integer('viewer_count').defaultTo(0);
      table.timestamp('started_at');
      table.timestamp('ended_at');
      table.timestamps(true, true);
    });

    // Create stream_analytics table
    await this.db.schema.createTable('stream_analytics', (table) => {
      table.increments('id').primary();
      table.integer('stream_id').references('id').inTable('streams').onDelete('CASCADE');
      table.integer('viewer_count').defaultTo(0);
      table.decimal('bitrate', 10, 2);
      table.integer('duration_seconds');
      table.timestamps(true, true);
    });

    console.log('[INFO] ✅ Database tables created successfully');
  }

  // Simple wrapper methods
  async run(sql, params = []) {
    return await this.db.raw(sql, params);
  }

  async get(sql, params = []) {
    const result = await this.db.raw(sql, params);
    return result.length > 0 ? result[0] : null;
  }

  async all(sql, params = []) {
    return await this.db.raw(sql, params);
  }

  // Direct access to knex instance
  table(tableName) {
    return this.db(tableName);
  }
}

// Export singleton instance
const dbInstance = new TestDB();
module.exports = dbInstance;