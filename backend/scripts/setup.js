const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Try to require logger, fallback to console if not found
let logger;
try {
  logger = require('../utils/logger');
} catch (e) {
  logger = {
    info: console.log,
    error: console.error
  };
}

async function setup() {
  try {
    logger.info('Starting backend setup...');

    // Create necessary directories
    const directories = [
      path.join(__dirname, '../logs'),
      path.join(__dirname, '../uploads'),
      path.join(__dirname, '../recordings')
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }

    // Install dependencies (if not already installed)
    try {
      logger.info('Running npm install...');
      execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      logger.info('npm install completed.');
    } catch (err) {
      logger.error('npm install failed:', err);
      throw err;
    }

    // Run database migrations
    try {
      logger.info('Running database migrations...');
      execSync('npx knex migrate:latest', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      logger.info('Database migrations completed.');
    } catch (err) {
      logger.error('Database migration failed:', err);
      throw err;
    }

    // Run database seeds (optional)
    try {
      logger.info('Running database seeds...');
      execSync('npx knex seed:run', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      logger.info('Database seeding completed.');
    } catch (err) {
      logger.error('Database seeding failed (continuing):', err);
      // Not a critical failure, continue setup
    }

    logger.info('Backend setup completed successfully');
  } catch (error) {
    logger.error('Backend setup failed:', error);
    throw error;
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setup()
    .then(() => {
      logger.info('Setup completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setup;
