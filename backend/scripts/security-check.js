#!/usr/bin/env node

const logger = require('../utils/logger');

/**
 * Security check for production deployment
 * Validates that sensitive configuration is properly set
 */
function performSecurityCheck() {
  logger.info('Starting production security check...');
  
  const warnings = [];
  const errors = [];
  
  // Check for default/insecure JWT secret
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.includes('CHANGE_THIS')) {
    errors.push('JWT_SECRET contains default value - MUST be changed for production');
  }
  
  // Check for default admin password
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.includes('CHANGE_THIS')) {
    errors.push('ADMIN_PASSWORD contains default value - MUST be changed for production');
  }
  
  // Check for default Grafana password
  if (process.env.GRAFANA_ADMIN_PASSWORD && process.env.GRAFANA_ADMIN_PASSWORD.includes('CHANGE_THIS')) {
    warnings.push('GRAFANA_ADMIN_PASSWORD contains default value - should be changed for production');
  }
  
  // Check for development database configuration
  if (process.env.NODE_ENV === 'production' && process.env.POSTGRES_HOST) {
    warnings.push('Production environment detected but PostgreSQL configuration found - ensure this is intentional');
  }
  
  // Check for secure ports in production
  if (process.env.NODE_ENV === 'production' && process.env.PORT === '3000') {
    warnings.push('Using development port 3000 in production - consider using port 80/443 with reverse proxy');
  }
  
  // Log results
  if (errors.length > 0) {
    logger.error('SECURITY CHECK FAILED - Critical issues found:');
    errors.forEach(error => logger.error(`  ❌ ${error}`));
    logger.error('Production deployment BLOCKED - fix these issues before proceeding');
    return false;
  }
  
  if (warnings.length > 0) {
    logger.warn('Security warnings found:');
    warnings.forEach(warning => logger.warn(`  ⚠️  ${warning}`));
  }
  
  if (warnings.length === 0 && errors.length === 0) {
    logger.info('✅ Security check passed - no issues found');
  } else {
    logger.info(`Security check completed - ${warnings.length} warnings, ${errors.length} errors`);
  }
  
  return true;
}

// Run security check if this script is executed directly
if (require.main === module) {
  require('dotenv').config();
  
  const passed = performSecurityCheck();
  process.exit(passed ? 0 : 1);
}

module.exports = performSecurityCheck;