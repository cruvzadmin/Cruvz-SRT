// Jest setup file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-tokens-in-testing-environment';
process.env.PORT = '0'; // Use random available port for tests
process.env.DATABASE_URL = ':memory:'; // Use in-memory database for tests

// Increase timeout for async operations
jest.setTimeout(15000);

// Clean up after tests
afterAll(() => {
  // Close any open database connections
  // This will be handled by the server shutdown logic
});