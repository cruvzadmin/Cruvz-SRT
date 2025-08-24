const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Production-grade database configuration (PostgreSQL ONLY, NO SQLite or mock)
const isProduction = process.env.NODE_ENV === 'production';

// Ensure directories exist (for logs/data)
const dataDir = path.join(__dirname, '../data');
const dbDir = path.join(dataDir, 'database');
const logsDir = path.join(dataDir, 'logs');

[dataDir, dbDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ===============================
// PRODUCTION/DEVELOPMENT: POSTGRES
// ===============================
const config = {
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    port: process.env.POSTGRES_PORT || 5432,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  pool: {
    min: 1,
    max: 5,
    acquireTimeoutMillis: 10000,
    createTimeoutMillis: 5000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
  },
  migrations: {
    directory: path.join(__dirname, '../scripts/migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../scripts/seeds')
  },
  acquireConnectionTimeout: 10000,
  asyncStackTraces: false // Disable for production performance
};

/*
 * ========== REMOVED FOR PRODUCTION ==========
 * All SQLite configuration (production/development) is now removed.
 * This server will ONLY use PostgreSQL for any environment.
 */

const db = knex(config);

module.exports = db;
