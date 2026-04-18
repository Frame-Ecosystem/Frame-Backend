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
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@databases$': '<rootDir>/src/databases',
    '^@dtos/(.*)$': '<rootDir>/src/dtos/$1',
    '^@exceptions/(.*)$': '<rootDir>/src/exceptions/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^uuid$': '<rootDir>/src/__mocks__/uuid.js',
  },
  maxConcurrency: 4,
};
