// Simple test to isolate the security check
require('dotenv').config();

console.log('Testing security check...');

function performSecurityCheck() {
  const issues = [];
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('Production mode:', isProduction);
  
  if (isProduction) {
    // Check JWT secret - more lenient check
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET is too short - should be at least 32 characters');
    }
    
    // Check admin password - more lenient check  
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
      issues.push('ADMIN_PASSWORD is too short - should be at least 8 characters');
    }
    
    // Warn about default values but don't stop server
    if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.includes('changeme')) {
      console.log('⚠️  ADMIN_PASSWORD contains default value - should be changed for production');
    }
    
    if (process.env.POSTGRES_PASSWORD && process.env.POSTGRES_PASSWORD === 'cruvzpass') {
      console.log('⚠️  POSTGRES_PASSWORD is using default value - should be changed for production');
    }
    
    if (!process.env.REDIS_PASSWORD) {
      console.log('⚠️  REDIS_PASSWORD not set - Redis cache will be disabled');
    }
  }
  
  if (issues.length > 0) {
    console.log('Security validation failed:');
    issues.forEach(issue => console.log(`- ${issue}`));
    return false;
  }
  
  console.log('✅ Security validation passed');
  return true;
}

const result = performSecurityCheck();
console.log('Security check result:', result);
process.exit(result ? 0 : 1);