// Test server to isolate the issue
const express = require('express');
require('dotenv').config();

console.log('Starting test server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 5000;

// Test basic express
app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Test server works' });
});

console.log('About to start listening...');

app.listen(PORT, () => {
  console.log(`✓ Test server running on port ${PORT}`);
}).on('error', (err) => {
  console.log('✗ Server failed to start:', err.message);
});

console.log('Server setup complete');