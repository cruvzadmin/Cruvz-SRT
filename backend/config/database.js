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
  connection: process.env.DATABASE_URL || {
    host: process.env.POSTGRES_HOST || (isProduction ? 'postgres' : 'localhost'),
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    port: process.env.POSTGRES_PORT || 5432,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 15000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 300000
  },
  migrations: {
    directory: path.join(__dirname, '../scripts/migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../scripts/seeds')
  },
  acquireConnectionTimeout: 60000,
  asyncStackTraces: false // Disable for production performance
};

/*
 * ========== REMOVED FOR PRODUCTION ==========
 * All SQLite configuration (production/development) is now removed.
 * This server will ONLY use PostgreSQL for any environment.
 */

const db = knex(config);

module.exports = db;
