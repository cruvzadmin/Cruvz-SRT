// Production-ready database configuration for Six Sigma deployment using PostgreSQL (Knex)
const db = require('./database');

class SimpleDB {
  constructor() {
    // Initialize tables on creation (async, but fire and forget)
    this._init();
  }

  async _init() {
    try {
      await this.initializeTables();
      console.log('Connected to PostgreSQL database');
    } catch (err) {
      console.error('Database connection error:', err);
    }
  }

  async initializeTables() {
    // Create users table if it doesn't exist
    const hasUsers = await db.schema.hasTable('users');
    if (!hasUsers) {
      await db.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('email').unique().notNullable();
        table.string('password_hash').notNullable();
        table.string('first_name').notNullable();
        table.string('last_name').notNullable();
        table.string('role').defaultTo('user');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Users table ready');
    }

    // Create user_sessions table if it doesn't exist
    const hasSessions = await db.schema.hasTable('user_sessions');
    if (!hasSessions) {
      await db.schema.createTable('user_sessions', (table) => {
        table.increments('id').primary();
        table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.string('session_token').unique();
        table.timestamp('expires_at');
        table.timestamp('created_at').defaultTo(db.fn.now());
      });
      console.log('Sessions table ready');
    }
  }

  // Promisify database operations using Knex
  async run(sql, params = []) {
    try {
      const res = await db.raw(sql, params);
      // For INSERT/UPDATE/DELETE, return affected rows info if available
      return { rowCount: res.rowCount || (Array.isArray(res.rows) ? res.rows.length : 0) };
    } catch (err) {
      throw err;
    }
  }

  async get(sql, params = []) {
    try {
      const res = await db.raw(sql, params);
      return res.rows && res.rows.length > 0 ? res.rows[0] : null;
    } catch (err) {
      throw err;
    }
  }

  async all(sql, params = []) {
    try {
      const res = await db.raw(sql, params);
      return res.rows;
    } catch (err) {
      throw err;
    }
  }
}

// Export singleton instance
const dbInstance = new SimpleDB();
module.exports = dbInstance;
