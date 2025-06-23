#!/usr/bin/env node
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

interface TestUser {
  email: string;
  password: string;
  givenName: string;
  familyName: string;
  tenantId: string;
  jurisdiction: string;
}

const createTestUsers = async () => {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const userPoolId = process.env.USER_POOL_ID;
  
  if (!userPoolId) {
    console.error('USER_POOL_ID environment variable is required');
    process.exit(1);
  }

  const client = new CognitoIdentityProviderClient({ region });

  const testUsers: TestUser[] = [
    {
      email: 'test1@stratagpt.com',
      password: 'TestPassword123!',
      givenName: 'Test',
      familyName: 'User One',
      tenantId: 'test-tenant-1',
      jurisdiction: 'NSW',
    },
    {
      email: 'test2@stratagpt.com',
      password: 'TestPassword123!',
      givenName: 'Test',
      familyName: 'User Two',
      tenantId: 'test-tenant-2',
      jurisdiction: 'VIC',
    },
    {
      email: 'admin@stratagpt.com',
      password: 'AdminPassword123!',
      givenName: 'Admin',
      familyName: 'User',
      tenantId: 'admin-tenant',
      jurisdiction: 'NSW',
    },
  ];

  console.log(`Creating test users in User Pool: ${userPoolId}`);

  for (const user of testUsers) {
    try {
      // Check if user already exists
      const existingUsers = await client.send(new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${user.email}"`,
      }));

      if (existingUsers.Users && existingUsers.Users.length > 0) {
        console.log(`User ${user.email} already exists, skipping...`);
        continue;
      }

      // Create user
      console.log(`Creating user: ${user.email}`);
      await client.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        TemporaryPassword: user.password,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: user.givenName },
          { Name: 'family_name', Value: user.familyName },
          { Name: 'custom:tenantId', Value: user.tenantId },
          { Name: 'custom:jurisdiction', Value: user.jurisdiction },
        ],
      }));

      // Set permanent password
      await client.send(new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        Password: user.password,
        Permanent: true,
      }));

      console.log(`✅ Created user: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to create user ${user.email}:`, error);
    }
  }

  console.log('\nTest users created successfully!');
  console.log('\nYou can use these credentials to test the application:');
  testUsers.forEach(user => {
    console.log(`\nEmail: ${user.email}`);
    console.log(`Password: ${user.password}`);
    console.log(`Tenant ID: ${user.tenantId}`);
    console.log(`Jurisdiction: ${user.jurisdiction}`);
  });
};

// Run the script
createTestUsers().catch(console.error);