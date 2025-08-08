const fs = require('fs');
const path = require('path');

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
      path.join(__dirname, '../data'),
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

    // Run database migration
    let migrate;
    try {
      migrate = require('./migrate');
    } catch (e) {
      logger.info('No migrate script found. Skipping migrations.');
      migrate = null;
    }
    if (typeof migrate === 'function') {
      await migrate();
    } else if (migrate && typeof migrate.default === 'function') {
      await migrate.default();
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
