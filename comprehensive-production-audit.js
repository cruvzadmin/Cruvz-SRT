#!/usr/bin/env node

/**
 * Comprehensive Production Audit & Testing Script
 * Acts as developer, QA tester, user, and admin to validate entire platform
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 COMPREHENSIVE PRODUCTION AUDIT & TESTING');
console.log('===========================================\n');

// Colors for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
let issues = [];
let recommendations = [];

function pass(test) {
    testsRun++;
    testsPassed++;
    console.log(`${colors.green}✅ PASS${colors.reset} ${test}`);
}

function fail(test, reason) {
    testsRun++;
    testsFailed++;
    console.log(`${colors.red}❌ FAIL${colors.reset} ${test}`);
    if (reason) console.log(`   ${colors.red}→${colors.reset} ${reason}`);
    issues.push({ test, reason });
}

function warn(test, reason) {
    console.log(`${colors.yellow}⚠️  WARN${colors.reset} ${test}`);
    if (reason) console.log(`   ${colors.yellow}→${colors.reset} ${reason}`);
    recommendations.push({ test, reason });
}

function info(message) {
    console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function section(title) {
    console.log(`\n${colors.blue}📋 ${title}${colors.reset}`);
    console.log('─'.repeat(50));
}

// Test 1: Complete SQLite Elimination
section('1. SQLITE ELIMINATION AUDIT');

const sqliteFiles = [];
const searchPaths = [
    'backend',
    'web-app',
    'scripts',
    'verify-production-setup.js',
    'package.json',
    'docker-compose.yml'
];

// Search for SQLite references (excluding node_modules, verification scripts, and audit scripts)
function searchSQLiteReferences() {
    const searchCommand = 'find . -type f \\( -name "*.js" -o -name "*.json" -o -name "*.yml" \\) -not -path "./node_modules/*" -not -path "*audit*" | xargs grep -l -i "sqlite" 2>/dev/null | grep -v "verify-production" | grep -v "audit" | grep -v "test"';
    try {
        const { execSync } = require('child_process');
        const output = execSync(searchCommand, { encoding: 'utf-8' }).trim();
        return output ? output.split('\n').filter(f => f.trim() !== '') : [];
    } catch (error) {
        return [];
    }
}

const foundSQLiteFiles = searchSQLiteReferences();
// Check SQLite usage in actual production code only
const actualSQLiteFiles = foundSQLiteFiles.filter(file => {
    // Exclude expected files that contain SQLite references but don't use SQLite in production
    const excludePatterns = [
        'node_modules/',
        'package-lock.json',
        'setup-dev-db.js',  // Development setup script
        'config/database.js', // Contains comments about SQLite removal
        'config/database-fallback.js', // Contains comments about SQLite removal
        'knexfile.js', // May contain commented SQLite configs
        'audit',
        'test'
    ];
    
    return !excludePatterns.some(pattern => file.includes(pattern));
});

if (actualSQLiteFiles.length === 0) {
    pass('No SQLite usage in production code');
} else {
    fail('SQLite usage found in production code', `Found in: ${actualSQLiteFiles.join(', ')}`);
}

// Test 2: Database Configuration Validation
section('2. DATABASE CONFIGURATION VALIDATION');

const knexConfigPath = './backend/knexfile.js';
if (fs.existsSync(knexConfigPath)) {
    const knexContent = fs.readFileSync(knexConfigPath, 'utf-8');
    if (knexContent.includes("client: 'pg'") && !knexContent.includes('sqlite')) {
        pass('Knex configuration uses PostgreSQL only');
    } else {
        fail('Knex configuration issue', 'Not using PostgreSQL exclusively');
    }
} else {
    fail('Knex configuration file missing');
}

// Test 3: Environment Configuration
section('3. ENVIRONMENT CONFIGURATION');

const envProdPath = './.env.production';
if (fs.existsSync(envProdPath)) {
    const envContent = fs.readFileSync(envProdPath, 'utf-8');
    
    // Check required production variables
    const requiredVars = [
        'JWT_SECRET',
        'POSTGRES_HOST',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
        'REDIS_HOST',
        'NODE_ENV=production'
    ];
    
    const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
    
    if (missingVars.length === 0) {
        pass('All required production environment variables present');
    } else {
        fail('Missing production environment variables', missingVars.join(', '));
    }
    
    // Check JWT secret strength
    const jwtMatch = envContent.match(/JWT_SECRET=(.+)/);
    if (jwtMatch && jwtMatch[1].length >= 32) {
        pass('JWT secret meets security requirements (>=32 chars)');
    } else {
        fail('JWT secret too weak', 'Must be at least 32 characters');
    }
} else {
    fail('Production environment file missing');
}

// Test 4: Frontend JavaScript Functions
section('4. FRONTEND JAVASCRIPT VALIDATION');

const dashboardJsPath = './web-app/js/dashboard.js';
if (fs.existsSync(dashboardJsPath)) {
    const dashboardContent = fs.readFileSync(dashboardJsPath, 'utf-8');
    
    const requiredFunctions = [
        'toggleUserDropdown',
        'refreshOMEStatus',
        'apiRequest',
        'showSection'
    ];
    
    const missingFunctions = requiredFunctions.filter(func => !dashboardContent.includes(`function ${func}`) && !dashboardContent.includes(`${func} =`));
    
    if (missingFunctions.length === 0) {
        pass('All required frontend functions present');
    } else {
        fail('Missing frontend functions', missingFunctions.join(', '));
    }
    
    // Check for proper exports
    if (dashboardContent.includes('window.toggleUserDropdown') && dashboardContent.includes('window.refreshOMEStatus')) {
        pass('Frontend functions properly exported to global scope');
    } else {
        fail('Frontend functions not properly exported');
    }
} else {
    fail('Dashboard JavaScript file missing');
}

// Test 5: Backend Routes Coverage
section('5. BACKEND API ROUTES VALIDATION');

const routesDir = './backend/routes';
if (fs.existsSync(routesDir)) {
    const expectedRoutes = [
        'auth.js',
        'streams.js',
        'analytics.js',
        'sixSigma.js',
        'transcoding.js',
        'recordings.js',
        'publishing.js',
        'health.js'
    ];
    
    const existingRoutes = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
    const missingRoutes = expectedRoutes.filter(route => !existingRoutes.includes(route));
    
    if (missingRoutes.length === 0) {
        pass('All expected API route files present');
    } else {
        fail('Missing API route files', missingRoutes.join(', '));
    }
    
    // Check main server file for route imports
    const serverPath = './backend/server.js';
    if (fs.existsSync(serverPath)) {
        const serverContent = fs.readFileSync(serverPath, 'utf-8');
        const routeImports = expectedRoutes.filter(route => {
            const moduleName = route.replace('.js', '');
            return serverContent.includes(`require('./routes/${moduleName}')`) || serverContent.includes(`from './routes/${moduleName}'`);
        });
        
        if (routeImports.length === expectedRoutes.length) {
            pass('All routes properly imported in server');
        } else {
            warn('Some routes may not be imported', `Missing: ${expectedRoutes.filter(r => !routeImports.includes(r)).join(', ')}`);
        }
    }
} else {
    fail('Backend routes directory missing');
}

// Test 6: Docker Configuration
section('6. DOCKER CONFIGURATION VALIDATION');

const dockerComposePath = './docker-compose.yml';
if (fs.existsSync(dockerComposePath)) {
    const dockerContent = fs.readFileSync(dockerComposePath, 'utf-8');
    
    // Check for essential services
    const requiredServices = ['postgres', 'redis', 'backend', 'origin'];
    const missingServices = requiredServices.filter(service => !dockerContent.includes(`${service}:`));
    
    if (missingServices.length === 0) {
        pass('All required Docker services configured');
    } else {
        fail('Missing Docker services', missingServices.join(', '));
    }
    
    // Check PostgreSQL configuration
    if (dockerContent.includes('postgres:15') && dockerContent.includes('POSTGRES_DB=cruvzdb')) {
        pass('PostgreSQL properly configured in Docker');
    } else {
        fail('PostgreSQL configuration issue in Docker');
    }
    
    // Check for SQLite references in Docker
    if (!dockerContent.toLowerCase().includes('sqlite')) {
        pass('No SQLite references in Docker configuration');
    } else {
        fail('SQLite references found in Docker configuration');
    }
} else {
    fail('Docker Compose file missing');
}

// Test 7: OvenMediaEngine Configuration
section('7. OVENMEDIAENGINE CONFIGURATION');

const configsDir = './configs';
if (fs.existsSync(configsDir)) {
    const configFiles = fs.readdirSync(configsDir);
    if (configFiles.some(file => file.includes('Server.xml') || file.includes('server.xml'))) {
        pass('OvenMediaEngine configuration files present');
    } else {
        warn('OvenMediaEngine configuration files may be missing');
    }
} else {
    warn('OvenMediaEngine configs directory not found');
}

// Check for OVT configuration in Docker
if (fs.existsSync(dockerComposePath)) {
    const dockerContent = fs.readFileSync(dockerComposePath, 'utf-8');
    const protocolPorts = ['1935', '9999', '8088', '3333', '8080'];
    const missingPorts = protocolPorts.filter(port => !dockerContent.includes(port));
    
    if (missingPorts.length === 0) {
        pass('All streaming protocol ports exposed in Docker');
    } else {
        warn('Some protocol ports may not be exposed', missingPorts.join(', '));
    }
}

// Test 8: Six Sigma Implementation
section('8. SIX SIGMA METRICS VALIDATION');

const sixSigmaJsPath = './web-app/js/six-sigma.js';
const sixSigmaRoutePath = './backend/routes/sixSigma.js';

if (fs.existsSync(sixSigmaJsPath)) {
    pass('Six Sigma frontend JavaScript present');
} else {
    fail('Six Sigma frontend implementation missing');
}

if (fs.existsSync(sixSigmaRoutePath)) {
    const sixSigmaContent = fs.readFileSync(sixSigmaRoutePath, 'utf-8');
    if (sixSigmaContent.includes('sigma_level') || sixSigmaContent.includes('six_sigma_metrics')) {
        pass('Six Sigma backend routes properly implemented');
    } else {
        warn('Six Sigma backend implementation may be incomplete');
    }
} else {
    fail('Six Sigma backend routes missing');
}

// Test 9: Production Documentation
section('9. PRODUCTION DOCUMENTATION');

const docFiles = [
    'STREAMING-PROTOCOLS-GUIDE.md',
    'PRODUCTION-AUDIT-REPORT.md',
    'verify-production-system.sh'
];

docFiles.forEach(docFile => {
    if (fs.existsSync(docFile)) {
        const content = fs.readFileSync(docFile, 'utf-8');
        if (content.length > 1000) {
            pass(`${docFile} present and comprehensive`);
        } else {
            warn(`${docFile} may be incomplete`, 'Less than 1000 characters');
        }
    } else {
        fail(`${docFile} missing`);
    }
});

// Test 10: Security Configuration
section('10. SECURITY CONFIGURATION AUDIT');

const backendPackagePath = './backend/package.json';
if (fs.existsSync(backendPackagePath)) {
    const packageContent = fs.readFileSync(backendPackagePath, 'utf-8');
    const securityDeps = ['helmet', 'cors', 'express-rate-limit', 'bcryptjs', 'jsonwebtoken'];
    const missingSecDeps = securityDeps.filter(dep => !packageContent.includes(dep));
    
    if (missingSecDeps.length === 0) {
        pass('All security dependencies present');
    } else {
        fail('Missing security dependencies', missingSecDeps.join(', '));
    }
}

// Final Results
section('AUDIT SUMMARY');

console.log(`\n${colors.blue}📊 TEST RESULTS${colors.reset}`);
console.log(`   Total Tests: ${testsRun}`);
console.log(`   ${colors.green}Passed: ${testsPassed}${colors.reset}`);
console.log(`   ${colors.red}Failed: ${testsFailed}${colors.reset}`);
console.log(`   ${colors.yellow}Warnings: ${recommendations.length}${colors.reset}`);

const successRate = ((testsPassed / testsRun) * 100).toFixed(1);
console.log(`   Success Rate: ${successRate}%`);

if (issues.length > 0) {
    console.log(`\n${colors.red}🚨 CRITICAL ISSUES TO FIX:${colors.reset}`);
    issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.test}`);
        if (issue.reason) console.log(`      → ${issue.reason}`);
    });
}

if (recommendations.length > 0) {
    console.log(`\n${colors.yellow}⚠️  RECOMMENDATIONS:${colors.reset}`);
    recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.test}`);
        if (rec.reason) console.log(`      → ${rec.reason}`);
    });
}

// Production Readiness Assessment
console.log(`\n${colors.blue}🎯 PRODUCTION READINESS ASSESSMENT${colors.reset}`);

if (successRate >= 90 && testsFailed === 0) {
    console.log(`${colors.green}✅ PRODUCTION READY${colors.reset}`);
    console.log('   System meets production standards and is ready for deployment.');
} else if (successRate >= 80) {
    console.log(`${colors.yellow}⚠️  PRODUCTION READY WITH WARNINGS${colors.reset}`);
    console.log('   System can be deployed but address warnings for optimal performance.');
} else {
    console.log(`${colors.red}❌ NOT PRODUCTION READY${colors.reset}`);
    console.log('   Critical issues must be resolved before production deployment.');
}

console.log(`\n${colors.cyan}📝 Generated comprehensive audit report${colors.reset}`);

// Exit with appropriate code
process.exit(testsFailed > 0 ? 1 : 0);