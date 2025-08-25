// Shared database service for all route modules
// Handles fallback to mock database when PostgreSQL is not available

let db;
let isConnected = false;

// Initialize database with proper fallback - synchronous approach
try {
  // Try to create PostgreSQL connection but don't test it immediately
  const knex = require('knex');
  const knexConfig = require('../knexfile');
  db = knex(knexConfig[process.env.NODE_ENV || 'development']);
  
  // Test connection in background and switch to mock if needed
  db.raw('SELECT 1 as test').timeout(3000)
    .then(() => {
      isConnected = true;
      console.log('PostgreSQL database connected');
    })
    .catch((error) => {
      console.warn('Database connection failed, switching to mock database');
      db = require('./database-mock');
      isConnected = false;
    });
    
} catch (error) {
  console.warn('Database configuration failed, using mock database');
  db = require('./database-mock');
  isConnected = false;
}

module.exports = {
  get db() { return db; },
  isConnected: () => isConnected
};