import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../../../lib/stacks/auth-stack';
import { getEnvironmentConfig } from '../../../lib/config/environment';

describe('Subphase 1.2: Cognito User Pool Setup', () => {
  let app: cdk.App;
  let stack: AuthStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    const config = getEnvironmentConfig('test');
    stack = new AuthStack(app, 'test-auth-stack', { config });
    template = Template.fromStack(stack);
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

  test('MFA is configured with SMS and TOTP', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      EnabledMfas: ['SMS_MFA', 'SOFTWARE_TOKEN_MFA'],
      MfaConfiguration: 'OPTIONAL',
    });
  });

  test('Email verification is enabled', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AutoVerifiedAttributes: ['email'],
      UsernameAttributes: ['email'],
    });
  });

  test('Account recovery is email-only', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AccountRecoverySetting: {
        RecoveryMechanisms: [
          {
            Name: 'verified_email',
            Priority: 1,
          },
        ],
      },
    });
  });

  test('User Pool Client is configured for web application', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: [
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_CUSTOM_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
      GenerateSecret: false,
      PreventUserExistenceErrors: true,
    });
  });

  test('OAuth flows are configured', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      SupportedIdentityProviders: ['COGNITO'],
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['email', 'openid', 'profile'],
    });
  });

  test('Token validity periods are set', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      RefreshTokenValidity: 30,
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      TokenValidityUnits: {
        RefreshToken: 'days',
        AccessToken: 'minutes',
        IdToken: 'minutes',
      },
    });
  });
});