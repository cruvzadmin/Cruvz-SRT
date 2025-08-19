const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

console.log('Starting simple test server...');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Cruvz Backend is running!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server running on port ${PORT}`);
});