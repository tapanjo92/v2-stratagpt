import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../../../lib/stacks/auth-stack';
import { getEnvironmentConfig } from '../../../lib/config/environment';

describe('Subphase 1.3: Identity Pool Integration', () => {
  let app: cdk.App;
  let stack: AuthStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    const config = getEnvironmentConfig('test');
    stack = new AuthStack(app, 'test-auth-stack', { config });
    template = Template.fromStack(stack);
  });

  test('Identity Pool is created and linked to User Pool', () => {
    template.hasResourceProperties('AWS::Cognito::IdentityPool', {
      AllowUnauthenticatedIdentities: false,
    });

    template.hasResource('AWS::Cognito::IdentityPool', {
      Properties: {
        CognitoIdentityProviders: [
          {
            ClientId: {
              Ref: template.findResources('AWS::Cognito::UserPoolClient')[0],
            },
          },
        ],
      },
    });
  });

  test('Authenticated role is created with correct trust policy', () => {
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
            Condition: {
              StringEquals: {
                'cognito-identity.amazonaws.com:aud': {
                  Ref: expect.any(String),
                },
              },
              'ForAnyValue:StringLike': {
                'cognito-identity.amazonaws.com:amr': 'authenticated',
              },
            },
          },
        ],
      },
    });
  });

  test('Unauthenticated role is created', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'stratagpt-unauthenticated-role-test',
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
  });

  test('Identity Pool Role Attachment is configured', () => {
    template.hasResource('AWS::Cognito::IdentityPoolRoleAttachment', {
      Properties: {
        IdentityPoolId: {
          Ref: expect.any(String),
        },
        Roles: {
          authenticated: {
            'Fn::GetAtt': [expect.any(String), 'Arn'],
          },
          unauthenticated: {
            'Fn::GetAtt': [expect.any(String), 'Arn'],
          },
        },
      },
    });
  });

  test('Role mappings are configured for token-based auth', () => {
    template.hasResource('AWS::Cognito::IdentityPoolRoleAttachment', {
      Properties: {
        RoleMappings: {
          userPoolAuth: {
            Type: 'Token',
            AmbiguousRoleResolution: 'AuthenticatedRole',
          },
        },
      },
    });
  });

  test('Stack outputs include all required values', () => {
    template.hasOutput('UserPoolIdOutput', {});
    template.hasOutput('UserPoolClientIdOutput', {});
    template.hasOutput('IdentityPoolIdOutput', {});
    template.hasOutput('Region', {});
  });
});