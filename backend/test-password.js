// Test password verification
const bcrypt = require('bcryptjs');

const testPasswords = ['demo123', 'demo', 'password', 'Adm1n123', 'Admin123!'];
const hash = '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

console.log('Testing passwords against stored hash...');

testPasswords.forEach(password => {
  const result = bcrypt.compareSync(password, hash);
  console.log(`Password "${password}": ${result ? '✅ MATCH' : '❌ No match'}`);
});

// Test creating a new hash for demo123
const newHash = bcrypt.hashSync('demo123', 12);
console.log('\nNew hash for "demo123":', newHash);
const verifyNew = bcrypt.compareSync('demo123', newHash);
console.log('Verification of new hash:', verifyNew ? '✅ MATCH' : '❌ No match');