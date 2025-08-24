const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Production-grade database configuration with fallback support
const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = process.env.USE_POSTGRES === 'true';

// Ensure directories exist (for logs/data)
const dataDir = path.join(__dirname, '../../data');
const dbDir = path.join(dataDir, 'database');
const logsDir = path.join(dataDir, 'logs');

[dataDir, dbDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ===============================
// DATABASE CONFIGURATION 
// ===============================
const config = usePostgres ? {
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    port: process.env.POSTGRES_PORT || 5432,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 3000,
    statement_timeout: 3000,
    query_timeout: 3000,
    idle_in_transaction_session_timeout: 5000
  },
  pool: {
    min: 0,
    max: 2,
    acquireTimeoutMillis: 3000,
    createTimeoutMillis: 3000,
    destroyTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    createRetryIntervalMillis: 200,
    propagateCreateError: false
  },
  migrations: {
    directory: path.join(__dirname, '../scripts/migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../scripts/seeds')
  },
  acquireConnectionTimeout: 3000,
  asyncStackTraces: false, // Disable for production performance
  debug: false
} : {
  client: 'sqlite3',
  connection: {
    filename: path.join(dbDir, 'cruvz_development.db')
  },
  migrations: {
    directory: path.join(__dirname, '../scripts/migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../scripts/seeds')
  },
  useNullAsDefault: true,
  pool: {
    min: 1,
    max: 5,
    afterCreate: (conn, cb) => {
      conn.run('PRAGMA foreign_keys = ON', cb);
      conn.run('PRAGMA journal_mode = WAL', cb);
      conn.run('PRAGMA synchronous = NORMAL', cb);
    }
  }
};

const db = knex(config);

module.exports = db;