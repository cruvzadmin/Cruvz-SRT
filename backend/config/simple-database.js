// Simple PostgreSQL database configuration for testing
const knex = require('knex');

const config = {
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'CHANGE_THIS_STRONG_PASSWORD_FOR_PRODUCTION',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    port: process.env.POSTGRES_PORT || 5432,
  },
  pool: { 
    min: 1, 
    max: 5,
    acquireTimeoutMillis: 10000,
    createTimeoutMillis: 10000
  },
  useNullAsDefault: true
};

const db = knex(config);

module.exports = db;