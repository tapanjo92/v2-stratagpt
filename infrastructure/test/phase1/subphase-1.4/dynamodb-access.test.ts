import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../../../lib/stacks/data-stack';
import { DirectAccessStack } from '../../../lib/stacks/direct-access-stack';
import { getEnvironmentConfig } from '../../../lib/config/environment';

describe('Subphase 1.4: DynamoDB Direct Access Setup', () => {
  let app: cdk.App;
  let dataStack: DataStack;
  let directAccessStack: DirectAccessStack;
  let dataTemplate: Template;
  let directAccessTemplate: Template;

  beforeAll(() => {
    app = new cdk.App();
    const config = getEnvironmentConfig('test');
    
    dataStack = new DataStack(app, 'test-data-stack', { config });
    directAccessStack = new DirectAccessStack(app, 'test-direct-access-stack', {
      config,
      authenticatedRoleArn: 'arn:aws:iam::123456789012:role/test-authenticated-role',
      unauthenticatedRoleArn: 'arn:aws:iam::123456789012:role/test-unauthenticated-role',
      userPoolArn: 'arn:aws:cognito-idp:ap-south-1:123456789012:userpool/test-pool',
    });
    
    dataTemplate = Template.fromStack(dataStack);
    directAccessTemplate = Template.fromStack(directAccessStack);
  });

  describe('DynamoDB Table Configuration', () => {
    test('Main table is created with correct configuration', () => {
      dataTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'stratagpt-main-table-test',
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
      });
    });

    test('Global Secondary Indexes are configured', () => {
      dataTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'TenantIndex',
            KeySchema: [
              { AttributeName: 'tenantId', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      });
    });

    test('Table has proper encryption configuration', () => {
      dataTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        SSESpecification: {
          SSEEnabled: true,
          KMSMasterKeyId: {
            'Fn::GetAtt': [expect.any(String), 'Arn'],
          },
        },
      });
    });
  });

  describe('S3 Bucket Configuration', () => {
    test('Documents bucket is created with encryption', () => {
      dataTemplate.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'stratagpt-documents-bucket-test',
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
              },
            },
          ],
        },
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('CORS is configured for documents bucket', () => {
      dataTemplate.hasResourceProperties('AWS::S3::Bucket', {
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
              AllowedOrigins: ['https://*.stratagpt.com', 'http://localhost:3000'],
              ExposedHeaders: ['ETag'],
              MaxAge: 3600,
            },
          ],
        },
      });
    });

    test('Lifecycle rules are configured', () => {
      dataTemplate.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'delete-old-versions',
              Status: 'Enabled',
              NoncurrentVersionExpirationInDays: 30,
            },
            {
              Id: 'transition-to-ia',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 90,
                },
              ],
            },
          ],
        },
      });
    });
  });

  describe('IAM Policies for User Isolation', () => {
    test('Direct access policy has DynamoDB user isolation', () => {
      directAccessTemplate.hasResource('AWS::IAM::ManagedPolicy', {
        Properties: {
          PolicyDocument: {
            Statement: expect.arrayContaining([
              expect.objectContaining({
                Effect: 'Allow',
                Action: expect.arrayContaining([
                  'dynamodb:GetItem',
                  'dynamodb:PutItem',
                  'dynamodb:Query',
                ]),
                Condition: {
                  'ForAllValues:StringEquals': {
                    'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
                  },
                },
              }),
            ]),
          },
        },
      });
    });

    test('S3 access is user-isolated', () => {
      directAccessTemplate.hasResource('AWS::IAM::ManagedPolicy', {
        Properties: {
          PolicyDocument: {
            Statement: expect.arrayContaining([
              expect.objectContaining({
                Effect: 'Allow',
                Action: expect.arrayContaining(['s3:GetObject', 's3:PutObject']),
                Resource: expect.arrayContaining([
                  expect.stringContaining('users/${cognito-identity.amazonaws.com:sub}/*'),
                ]),
              }),
            ]),
          },
        },
      });
    });

    test('S3 ListBucket has prefix condition', () => {
      directAccessTemplate.hasResource('AWS::IAM::ManagedPolicy', {
        Properties: {
          PolicyDocument: {
            Statement: expect.arrayContaining([
              expect.objectContaining({
                Effect: 'Allow',
                Action: ['s3:ListBucket'],
                Condition: {
                  StringLike: {
                    's3:prefix': ['users/${cognito-identity.amazonaws.com:sub}/*'],
                  },
                },
              }),
            ]),
          },
        },
      });
    });

    test('Limited policy for unauthenticated users', () => {
      directAccessTemplate.hasResource('AWS::IAM::ManagedPolicy', {
        Properties: {
          ManagedPolicyName: 'stratagpt-limited-access-policy-test',
          PolicyDocument: {
            Statement: expect.arrayContaining([
              expect.objectContaining({
                Effect: 'Allow',
                Action: ['s3:GetObject'],
                Resource: expect.arrayContaining([
                  expect.stringContaining('/public/*'),
                ]),
              }),
            ]),
          },
        },
      });
    });
  });

  describe('KMS Encryption', () => {
    test('KMS key is created with rotation enabled', () => {
      dataTemplate.hasResourceProperties('AWS::KMS::Key', {
        EnableKeyRotation: true,
        KeyPolicy: {
          Statement: expect.arrayContaining([
            expect.objectContaining({
              Effect: 'Allow',
              Principal: { AWS: expect.any(String) },
              Action: 'kms:*',
              Resource: '*',
            }),
          ]),
        },
      });
    });
  });
});