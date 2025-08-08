// Jest setup file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '0'; // Use random available port for tests

// Increase timeout for async operations
jest.setTimeout(10000);

// Clean up after tests
afterAll(() => {
  // Close any open database connections
  // This will be handled by the server shutdown logic
});