// Test setup file for Jest
import { config } from 'dotenv';

// Load environment variables from .env file for local testing
config();

// Set default test environment variables if not already set
process.env.AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
process.env.CDK_DEFAULT_REGION = process.env.CDK_DEFAULT_REGION || 'ap-south-1';
process.env.STAGE = process.env.STAGE || 'test';

// Mock AWS SDK clients for unit tests
jest.mock('@aws-sdk/client-cognito-identity-provider');
jest.mock('@aws-sdk/client-cognito-identity');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sts');

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests unless explicitly needed
if (process.env.SUPPRESS_TEST_LOGS !== 'false') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}