import * as cdk from 'aws-cdk-lib';
import { getEnvironmentConfig } from '../../../lib/config/environment';

describe('Subphase 1.1: CDK Setup', () => {
  test('CDK synthesizes without errors', () => {
    const app = new cdk.App();
    expect(() => app.synth()).not.toThrow();
  });

  test('Environment variables are properly set', () => {
    expect(process.env.AWS_REGION).toBeDefined();
    expect(process.env.STAGE).toBeDefined();
  });

  test('Environment configuration works for all stages', () => {
    const stages = ['dev', 'staging', 'prod', 'test'];
    
    stages.forEach(stage => {
      const config = getEnvironmentConfig(stage);
      expect(config.stage).toBe(stage);
      expect(config.region).toBe('ap-south-1');
      if (stage === 'test') {
        expect(config.account).toBe('123456789012'); // Default test account
      }
      // For other stages, account may be undefined if not set in environment
    });
  });

  test('Stack naming conventions are consistent', () => {
    const { getStackName, getResourceName } = require('../../../lib/config/environment');
    
    expect(getStackName('Auth', 'dev')).toBe('StrataGPT-Auth-dev');
    expect(getStackName('Data', 'prod')).toBe('StrataGPT-Data-prod');
    
    expect(getResourceName('user-pool', 'dev')).toBe('stratagpt-user-pool-dev');
    expect(getResourceName('main-table', 'prod')).toBe('stratagpt-main-table-prod');
  });
});