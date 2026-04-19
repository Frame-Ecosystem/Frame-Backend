require('reflect-metadata');

// ── Global test environment variables ──────────────────────────────────────
// Set BEFORE any module is imported so @config reads these values.
process.env.NODE_ENV = 'test';
process.env.SECRET_KEY = 'test-jwt-secret-key-for-jest-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-jest-only';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '27017';
process.env.DB_DATABASE = 'frame_test';
process.env.PORT = '3001';
process.env.ORIGIN = 'http://localhost';
process.env.CREDENTIALS = 'true';
process.env.LOG_FORMAT = 'dev';
process.env.LOG_DIR = '../logs';
process.env.FRONTEND_BASE_URL = 'http://localhost:3001';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'Admin@Test123';

// Suppress verbose logs during test runs
process.env.SUPPRESS_LOGS = 'true';

// Increase default Jest timeout for route tests that spin up App instances
jest.setTimeout(15000);
