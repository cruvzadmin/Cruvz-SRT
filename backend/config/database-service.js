// Shared database service for all route modules
// Handles fallback to mock database when PostgreSQL is not available

let db;
let isConnected = false;

// Test PostgreSQL connection synchronously and fall back immediately
try {
  const knex = require('knex');
  const knexConfig = require('../knexfile');
  
  // Try to create connection but immediately fall back to mock if ENV vars not set
  if (!process.env.POSTGRES_HOST || process.env.POSTGRES_HOST === 'postgres') {
    console.warn('PostgreSQL host not available, using mock database');
    db = require('./database-mock');
    isConnected = false;
  } else {
    db = knex(knexConfig[process.env.NODE_ENV || 'development']);
    isConnected = true;
  }
} catch (error) {
  console.warn('Database configuration failed, using mock database');
  db = require('./database-mock');
  isConnected = false;
}

module.exports = {
  get db() { return db; },
  isConnected: () => isConnected
};