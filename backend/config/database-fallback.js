const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Production-grade database configuration (PostgreSQL ONLY, NO fallback/support for SQLite)
const _isProduction = process.env.NODE_ENV === 'production';

// Ensure directories exist (for logs/data)
// Changed from '../../data' to '../data' to avoid EACCES error in Docker
const dataDir = path.join(__dirname, '../data');
const dbDir = path.join(dataDir, 'database');
const logsDir = path.join(dataDir, 'logs');

[dataDir, dbDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ===============================
// DATABASE CONFIGURATION (PostgreSQL only)
// ===============================
const config = {
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    port: process.env.POSTGRES_PORT || 5432,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 10000,
    idle_in_transaction_session_timeout: 30000
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 10000,
    createTimeoutMillis: 10000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
    propagateCreateError: false
  },
  migrations: {
    directory: path.join(__dirname, '../scripts/migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../scripts/seeds')
  },
  acquireConnectionTimeout: 60000,
  asyncStackTraces: false, // Disable for production performance
  debug: false
};

/*
 * ========== REMOVED FOR PRODUCTION ==========
 * All SQLite and fallback configuration is removed.
 * This server will ONLY use PostgreSQL for any environment.
 */

const db = knex(config);

module.exports = db;
