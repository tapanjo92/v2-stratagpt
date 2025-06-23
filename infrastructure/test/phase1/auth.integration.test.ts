import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

// These tests require actual AWS resources to be deployed
describe('Authentication Base Integration Tests', () => {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const userPoolId = process.env.USER_POOL_ID!;
  const userPoolClientId = process.env.USER_POOL_CLIENT_ID!;
  const identityPoolId = process.env.IDENTITY_POOL_ID!;
  const tableName = process.env.TABLE_NAME!;
  
  const cognitoProvider = new CognitoIdentityProviderClient({ region });
  const cognitoIdentity = new CognitoIdentityClient({ region });
  
  let testUsername: string;
  let testPassword: string;
  let identityId: string;
  let credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };

  beforeAll(() => {
    // Ensure required environment variables are set
    expect(userPoolId).toBeDefined();
    expect(userPoolClientId).toBeDefined();
    expect(identityPoolId).toBeDefined();
    expect(tableName).toBeDefined();
    
    testUsername = `test-user-${Date.now()}@example.com`;
    testPassword = 'TestPassword123!';
  });

  afterAll(async () => {
    // Clean up test user if needed
    // Note: In production, you'd want to delete the test user
  });

  test('User Pool exists and is configured correctly', async () => {
    const response = await cognitoProvider.send(new DescribeUserPoolCommand({
      UserPoolId: userPoolId,
    }));

    expect(response.UserPool?.MfaConfiguration).toBe('OPTIONAL');
    expect(response.UserPool?.Policies?.PasswordPolicy?.MinimumLength).toBe(12);
    expect(response.UserPool?.SchemaAttributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Name: 'custom:tenantId' }),
        expect.objectContaining({ Name: 'custom:jurisdiction' }),
      ])
    );
  });

  test('Can create and authenticate test user', async () => {
    // Create test user
    await cognitoProvider.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: testUsername,
      TemporaryPassword: testPassword,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: testUsername },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: 'Test' },
        { Name: 'family_name', Value: 'User' },
        { Name: 'custom:tenantId', Value: 'test-tenant' },
        { Name: 'custom:jurisdiction', Value: 'NSW' },
      ],
    }));

    // Set permanent password
    await cognitoProvider.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: testUsername,
      Password: testPassword,
      Permanent: true,
    }));

    // Authenticate user
    const authResponse = await cognitoProvider.send(new InitiateAuthCommand({
      ClientId: userPoolClientId,
      AuthFlow: 'USER_SRP_AUTH',
      AuthParameters: {
        USERNAME: testUsername,
        PASSWORD: testPassword,
      },
    }));

    expect(authResponse.AuthenticationResult?.IdToken).toBeDefined();
    expect(authResponse.AuthenticationResult?.AccessToken).toBeDefined();
    expect(authResponse.AuthenticationResult?.RefreshToken).toBeDefined();
  });

  describe('Identity Pool Integration', () => {
    let idToken: string;

    beforeAll(async () => {
      // Authenticate to get tokens
      const authResponse = await cognitoProvider.send(new InitiateAuthCommand({
        ClientId: userPoolClientId,
        AuthFlow: 'USER_SRP_AUTH',
        AuthParameters: {
          USERNAME: testUsername,
          PASSWORD: testPassword,
        },
      }));

      idToken = authResponse.AuthenticationResult!.IdToken!;
    });

    test('Can obtain Identity Pool ID', async () => {
      const logins = {
        [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken,
      };

      const idResponse = await cognitoIdentity.send(new GetIdCommand({
        IdentityPoolId: identityPoolId,
        Logins: logins,
      }));

      identityId = idResponse.IdentityId!;
      expect(identityId).toBeDefined();
      expect(identityId).toMatch(/^ap-south-1:[a-f0-9-]+$/);
    });

    test('Can obtain temporary AWS credentials', async () => {
      const logins = {
        [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken,
      };

      const credentialsResponse = await cognitoIdentity.send(
        new GetCredentialsForIdentityCommand({
          IdentityId: identityId,
          Logins: logins,
        })
      );

      credentials = {
        accessKeyId: credentialsResponse.Credentials!.AccessKeyId!,
        secretAccessKey: credentialsResponse.Credentials!.SecretKey!,
        sessionToken: credentialsResponse.Credentials!.SessionToken!,
      };

      expect(credentials.accessKeyId).toBeDefined();
      expect(credentials.secretAccessKey).toBeDefined();
      expect(credentials.sessionToken).toBeDefined();
    });

    test('Credentials have correct permissions', async () => {
      const sts = new STSClient({
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });

      const identity = await sts.send(new GetCallerIdentityCommand({}));
      
      expect(identity.Arn).toContain('assumed-role');
      expect(identity.Arn).toContain('authenticated-role');
    });

    test('Integration: User Pool + Identity Pool flow', async () => {
      // This test validates the complete flow
      const authResponse = await cognitoProvider.send(new InitiateAuthCommand({
        ClientId: userPoolClientId,
        AuthFlow: 'USER_SRP_AUTH',
        AuthParameters: {
          USERNAME: testUsername,
          PASSWORD: testPassword,
        },
      }));

      const logins = {
        [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: authResponse.AuthenticationResult!.IdToken!,
      };

      const idResponse = await cognitoIdentity.send(new GetIdCommand({
        IdentityPoolId: identityPoolId,
        Logins: logins,
      }));

      const credentialsResponse = await cognitoIdentity.send(
        new GetCredentialsForIdentityCommand({
          IdentityId: idResponse.IdentityId!,
          Logins: logins,
        })
      );

      expect(credentialsResponse.Credentials).toBeDefined();
      expect(credentialsResponse.IdentityId).toBe(idResponse.IdentityId);
    });
  });

  describe('Direct DynamoDB Access', () => {
    let ddbClient: DynamoDBClient;

    beforeAll(() => {
      ddbClient = new DynamoDBClient({
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });
    });

    test('Can write to own partition', async () => {
      const command = new PutItemCommand({
        TableName: tableName,
        Item: {
          PK: { S: `USER#${identityId}` },
          SK: { S: `PROFILE#${Date.now()}` },
          data: { S: 'test data' },
          tenantId: { S: 'test-tenant' },
          createdAt: { S: new Date().toISOString() },
        },
      });

      await expect(ddbClient.send(command)).resolves.not.toThrow();
    });

    test('Can read from own partition', async () => {
      const timestamp = Date.now();
      
      // First write
      await ddbClient.send(new PutItemCommand({
        TableName: tableName,
        Item: {
          PK: { S: `USER#${identityId}` },
          SK: { S: `TEST#${timestamp}` },
          testData: { S: 'read test' },
        },
      }));

      // Then read
      const readCommand = new GetItemCommand({
        TableName: tableName,
        Key: {
          PK: { S: `USER#${identityId}` },
          SK: { S: `TEST#${timestamp}` },
        },
      });

      const response = await ddbClient.send(readCommand);
      expect(response.Item?.testData?.S).toBe('read test');
    });

    test('Cannot access other user partitions', async () => {
      const command = new GetItemCommand({
        TableName: tableName,
        Key: {
          PK: { S: 'USER#different-user-id' },
          SK: { S: 'PROFILE#123' },
        },
      });

      await expect(ddbClient.send(command)).rejects.toThrow(/AccessDenied|User/);
    });

    test('Integration: Full auth to database flow', async () => {
      // Sign in
      const authResponse = await cognitoProvider.send(new InitiateAuthCommand({
        ClientId: userPoolClientId,
        AuthFlow: 'USER_SRP_AUTH',
        AuthParameters: {
          USERNAME: testUsername,
          PASSWORD: testPassword,
        },
      }));

      // Get credentials
      const logins = {
        [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: authResponse.AuthenticationResult!.IdToken!,
      };

      const idResponse = await cognitoIdentity.send(new GetIdCommand({
        IdentityPoolId: identityPoolId,
        Logins: logins,
      }));

      const credentialsResponse = await cognitoIdentity.send(
        new GetCredentialsForIdentityCommand({
          IdentityId: idResponse.IdentityId!,
          Logins: logins,
        })
      );

      // Use credentials to access DynamoDB
      const ddb = new DynamoDBClient({
        region,
        credentials: {
          accessKeyId: credentialsResponse.Credentials!.AccessKeyId!,
          secretAccessKey: credentialsResponse.Credentials!.SecretKey!,
          sessionToken: credentialsResponse.Credentials!.SessionToken!,
        },
      });

      // Write to DynamoDB
      const writeCommand = new PutItemCommand({
        TableName: tableName,
        Item: {
          PK: { S: `USER#${idResponse.IdentityId}` },
          SK: { S: `FLOW#${Date.now()}` },
          data: { S: 'full flow test' },
        },
      });

      await expect(ddb.send(writeCommand)).resolves.not.toThrow();
    });
  });
});