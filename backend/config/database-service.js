// Shared database service for all route modules
// Production: Only connect to PostgreSQL, never fall back to mock database

let db;
let isConnected = false;

try {
  const knex = require('knex');
  const knexConfig = require('../knexfile');

  // Always attempt to connect to PostgreSQL using config
  db = knex(knexConfig[process.env.NODE_ENV || 'production']);
  isConnected = true;
} catch (error) {
  console.error('❌ Database configuration failed:', error);
  process.exit(1); // Exit if unable to connect; never use mock
}

module.exports = {
  get db() { return db; },
  isConnected: () => isConnected
};
