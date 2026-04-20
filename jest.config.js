const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/__mocks__/jest.setup.js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!uuid)',
  ],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/src/' }),
    // Explicit mappings for test files
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config$': '<rootDir>/src/config',
    '^@databases$': '<rootDir>/src/databases',
    '^@exceptions/(.*)$': '<rootDir>/src/exceptions/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@systems/(.*)$': '<rootDir>/src/systems/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^uuid$': '<rootDir>/src/__mocks__/uuid.js',
  },
  testMatch: ['**/?(*.)+(test|spec).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/__mocks__/**',
    '!src/tests/**',
    '!src/**/tests/**',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'html'],
  testTimeout: 15000,
  maxConcurrency: 4,
  verbose: false,
  clearMocks: true,
  restoreMocks: true,
};
