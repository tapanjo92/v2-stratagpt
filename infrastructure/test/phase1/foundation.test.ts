import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../../lib/stacks/auth-stack';
import { DataStack } from '../../lib/stacks/data-stack';
import { DirectAccessStack } from '../../lib/stacks/direct-access-stack';
import { getEnvironmentConfig } from '../../lib/config/environment';

describe('Foundation Infrastructure', () => {
  let app: cdk.App;
  let authStack: AuthStack;
  let dataStack: DataStack;
  let directAccessStack: DirectAccessStack;
  
  beforeAll(() => {
    app = new cdk.App();
    const config = getEnvironmentConfig('test');
    
    authStack = new AuthStack(app, 'test-auth-stack', { config });
    dataStack = new DataStack(app, 'test-data-stack', { config });
    directAccessStack = new DirectAccessStack(app, 'test-direct-access-stack', {
      config,
      authenticatedRoleArn: 'arn:aws:iam::123456789012:role/test-authenticated-role',
      unauthenticatedRoleArn: 'arn:aws:iam::123456789012:role/test-unauthenticated-role',
      userPoolArn: 'arn:aws:cognito-idp:ap-southeast-2:123456789012:userpool/test-pool',
    });
  });

  test('CDK synthesizes without errors', () => {
    expect(() => app.synth()).not.toThrow();
  });

  test('Environment variables are properly set', () => {
    const config = getEnvironmentConfig('test');
    expect(config.stage).toBe('test');
    expect(config.region).toBe('ap-south-1');
  });

  describe('Cognito User Pool', () => {
    let template: Template;
    
    beforeAll(() => {
      template = Template.fromStack(authStack);
    });

    test('User Pool exists and is configured correctly', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'stratagpt-user-pool-test',
        MfaConfiguration: 'OPTIONAL',
        Policies: {
          PasswordPolicy: {
            MinimumLength: 12,
            RequireLowercase: true,
            RequireUppercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
          },
        },
      });
    });

    test('User Pool has custom attributes configured', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: [
          {
            AttributeDataType: 'String',
            Mutable: false,
            Name: 'tenantId',
            StringAttributeConstraints: {
              MinLength: '1',
              MaxLength: '50',
            },
          },
          {
            AttributeDataType: 'String',
            Mutable: true,
            Name: 'jurisdiction',
            StringAttributeConstraints: {
              MinLength: '2',
              MaxLength: '10',
            },
          },
        ],
      });
    });

    test('User Pool Client is configured', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        UserPoolId: {
          Ref: expect.stringMatching(/UserPool/),
        },
        ExplicitAuthFlows: [
          'ALLOW_USER_SRP_AUTH',
          'ALLOW_CUSTOM_AUTH',
          'ALLOW_REFRESH_TOKEN_AUTH',
        ],
      });
    });
  });

  describe('Identity Pool Integration', () => {
    let template: Template;
    
    beforeAll(() => {
      template = Template.fromStack(authStack);
    });

    test('Identity Pool is created and linked to User Pool', () => {
      template.hasResourceProperties('AWS::Cognito::IdentityPool', {
        AllowUnauthenticatedIdentities: false,
        CognitoIdentityProviders: [
          {
            ClientId: {
              Ref: expect.stringMatching(/UserPoolClient/),
            },
            ProviderName: {
              'Fn::GetAtt': [expect.stringMatching(/UserPool/), 'ProviderName'],
            },
          },
        ],
      });
    });

    test('Authenticated and Unauthenticated roles are created', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'stratagpt-authenticated-role-test',
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com',
              },
              Action: 'sts:AssumeRoleWithWebIdentity',
            },
          ],
        },
      });

      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'stratagpt-unauthenticated-role-test',
      });
    });

    test('Identity Pool Role Attachment is configured', () => {
      template.hasResourceProperties('AWS::Cognito::IdentityPoolRoleAttachment', {
        IdentityPoolId: {
          Ref: expect.stringMatching(/IdentityPool/),
        },
        Roles: {
          authenticated: {
            'Fn::GetAtt': [expect.stringMatching(/AuthenticatedRole/), 'Arn'],
          },
          unauthenticated: {
            'Fn::GetAtt': [expect.stringMatching(/UnauthenticatedRole/), 'Arn'],
          },
        },
      });
    });
  });

  describe('Direct DynamoDB Access', () => {
    let dataTemplate: Template;
    let directAccessTemplate: Template;
    
    beforeAll(() => {
      dataTemplate = Template.fromStack(dataStack);
      directAccessTemplate = Template.fromStack(directAccessStack);
    });

    test('DynamoDB table is created with proper configuration', () => {
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

    test('DynamoDB table has required GSIs', () => {
      dataTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
          },
          {
            IndexName: 'TenantIndex',
            KeySchema: [
              { AttributeName: 'tenantId', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
          },
        ],
      });
    });

    test('IAM policies allow user-isolated DynamoDB access', () => {
      directAccessTemplate.hasResourceProperties('AWS::IAM::ManagedPolicy', {
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
      });
    });

    test('S3 buckets are created with proper configuration', () => {
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

    test('IAM policies allow user-isolated S3 access', () => {
      directAccessTemplate.hasResourceProperties('AWS::IAM::ManagedPolicy', {
        PolicyDocument: {
          Statement: expect.arrayContaining([
            expect.objectContaining({
              Effect: 'Allow',
              Action: expect.arrayContaining([
                's3:GetObject',
                's3:PutObject',
              ]),
              Resource: expect.arrayContaining([
                expect.stringContaining('users/${cognito-identity.amazonaws.com:sub}/*'),
              ]),
            }),
          ]),
        },
      });
    });
  });
});