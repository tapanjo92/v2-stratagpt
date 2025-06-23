import { Match, Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../../lib/stacks/data-stack';
import { getEnvironmentConfig } from '../../lib/config/environment';

describe('Phase 3: Processed Documents Bucket', () => {
  let app: cdk.App;
  let dataStack: DataStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    const config = getEnvironmentConfig('test');
    dataStack = new DataStack(app, 'TestDataStack', { config });
    template = Template.fromStack(dataStack);
  });

  test('Processed documents bucket is created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'stratagpt-processed-documents-bucket-test',
      BucketEncryption: {
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms'
            }
          })
        ])
      },
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    });
  });

  test('Processed bucket has lifecycle rules', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'stratagpt-processed-documents-bucket-test',
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Id: 'delete-old-versions',
            Status: 'Enabled'
          }),
          Match.objectLike({
            Id: 'transition-to-ia',
            Status: 'Enabled'
          })
        ])
      }
    });
  });

  test('All required buckets exist', () => {
    // Documents bucket
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'stratagpt-documents-bucket-test'
    });

    // Public bucket
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'stratagpt-public-bucket-test'
    });

    // Processed documents bucket
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'stratagpt-processed-documents-bucket-test'
    });
  });

  test('Buckets have correct outputs', () => {
    const outputs = template.findOutputs('*');
    expect(outputs).toHaveProperty('ProcessedDocumentsBucketNameOutput');
    
    // Verify the output has correct properties
    expect(outputs.ProcessedDocumentsBucketNameOutput).toMatchObject({
      Value: expect.objectContaining({
        Ref: expect.stringContaining('ProcessedDocumentsBucket')
      })
    });
  });
});

describe('Phase 3: Document Processing Lambda Validation', () => {
  test('Document processor Lambda code exists', () => {
    const fs = require('fs');
    const path = require('path');
    
    const lambdaPath = path.join(__dirname, '../../lib/lambdas/document-processor/index.ts');
    expect(fs.existsSync(lambdaPath)).toBe(true);
    
    // Read and validate Lambda code structure
    const lambdaCode = fs.readFileSync(lambdaPath, 'utf-8');
    expect(lambdaCode).toContain('handler');
    expect(lambdaCode).toContain('TextractClient');
    expect(lambdaCode).toContain('DynamoDBClient');
    expect(lambdaCode).toContain('S3Client');
  });

  test('DLQ handler Lambda code exists', () => {
    const fs = require('fs');
    const path = require('path');
    
    const dlqPath = path.join(__dirname, '../../lib/lambdas/processing-dlq/index.ts');
    expect(fs.existsSync(dlqPath)).toBe(true);
    
    // Read and validate DLQ handler code
    const dlqCode = fs.readFileSync(dlqPath, 'utf-8');
    expect(dlqCode).toContain('handler');
    expect(dlqCode).toContain('SQSEvent');
    expect(dlqCode).toContain('updateDocumentStatus');
  });

  test('Lambda functions use correct AWS SDK v3 imports', () => {
    const fs = require('fs');
    const path = require('path');
    
    const lambdaPath = path.join(__dirname, '../../lib/lambdas/document-processor/index.ts');
    const lambdaCode = fs.readFileSync(lambdaPath, 'utf-8');
    
    // Check for AWS SDK v3 imports
    expect(lambdaCode).toContain('@aws-sdk/client-textract');
    expect(lambdaCode).toContain('@aws-sdk/client-s3');
    expect(lambdaCode).toContain('@aws-sdk/client-dynamodb');
    expect(lambdaCode).not.toMatch(/from ['"]aws-sdk['"]/); // Should not use v2
  });
});

describe('Phase 3: Processing Stack Configuration', () => {
  test('Processing stack requires correct props', () => {
    const ProcessingStack = require('../../lib/stacks/processing-stack').ProcessingStack;
    
    // Verify the stack exports the correct interface
    expect(ProcessingStack).toBeDefined();
    
    // Test that it requires the expected props
    const app = new cdk.App();
    const config = getEnvironmentConfig('test');
    
    expect(() => {
      new ProcessingStack(app, 'TestStack', { config });
    }).toThrow(); // Should throw because required props are missing
  });

  test('Environment configuration includes processed bucket name', () => {
    const fs = require('fs');
    const path = require('path');
    
    const awsConfigPath = path.join(__dirname, '../../../frontend/app/lib/aws-config.ts');
    if (fs.existsSync(awsConfigPath)) {
      const awsConfig = fs.readFileSync(awsConfigPath, 'utf-8');
      expect(awsConfig).toContain('s3BucketProcessed');
    }
  });
});