const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

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
    const migrate = require('./migrate');
    await migrate();

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