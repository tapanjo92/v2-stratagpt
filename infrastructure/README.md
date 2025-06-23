# StrataGPT Infrastructure

This directory contains the AWS CDK infrastructure code for StrataGPT using Cognito Identity Pools for direct client access to AWS services.

## Architecture Overview

The infrastructure implements a serverless architecture with direct client access pattern:

- **Authentication**: Cognito User Pool + Identity Pool
- **Database**: DynamoDB with user isolation
- **Storage**: S3 with user-specific paths
- **Security**: Fine-grained IAM policies based on Cognito Identity

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally: `npm install -g aws-cdk`

## Project Structure

```
infrastructure/
├── bin/                    # CDK app entry point
├── lib/
│   ├── config/            # Environment configurations
│   └── stacks/            # CDK stack definitions
│       ├── base-stack.ts  # Base abstract stack
│       ├── auth-stack.ts  # Cognito resources
│       ├── data-stack.ts  # DynamoDB and S3
│       └── direct-access-stack.ts  # IAM policies
├── scripts/               # Utility scripts
├── test/                  # Test suites
│   ├── integration/       # Integration tests
│   └── foundation.test.ts # Unit tests
└── jest.config.js         # Jest configuration
```

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your AWS account details:
   ```
   AWS_REGION=ap-south-1
   CDK_DEFAULT_ACCOUNT=your-account-id
   CDK_DEFAULT_REGION=ap-south-1
   STAGE=dev
   ```

## Deployment

### First-time Setup

1. Bootstrap the CDK (one-time per account/region):
   ```bash
   npm run bootstrap
   ```

2. Deploy to development:
   ```bash
   npm run deploy:dev
   ```

### Deploy to Different Stages

```bash
# Development
npm run deploy:dev

# Staging
npm run deploy:staging

# Production (requires CERTIFICATE_ARN in .env)
npm run deploy:prod
```

### View Stack Differences

```bash
npm run diff
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests

**Note**: Integration tests require deployed resources. Set these environment variables first:

```bash
export USER_POOL_ID=your-user-pool-id
export USER_POOL_CLIENT_ID=your-client-id
export IDENTITY_POOL_ID=your-identity-pool-id
export TABLE_NAME=your-table-name

npm run test:integration
```

### Create Test Users

After deploying the auth stack:

```bash
export USER_POOL_ID=your-user-pool-id
npm run create-test-users
```

## Stack Outputs

After deployment, important values are output to the console:

- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito User Pool Client ID
- **IdentityPoolId**: Cognito Identity Pool ID
- **MainTableName**: DynamoDB table name
- **DocumentsBucketName**: S3 bucket for user documents

## Security Features

1. **User Isolation**: Each user can only access their own data
2. **MFA Support**: Optional multi-factor authentication
3. **Fine-grained IAM**: Policies use Cognito Identity ID for access control
4. **Encryption**: KMS encryption for DynamoDB and S3
5. **CORS**: Configured for frontend domains only

## Cost Optimization

- DynamoDB: On-demand billing mode
- S3: Lifecycle policies for cost management
- No always-on compute resources
- Direct client access reduces Lambda invocations

## Troubleshooting

### CDK Bootstrap Issues

If you encounter bootstrap errors:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Permission Errors

Ensure your AWS CLI credentials have sufficient permissions to create:
- IAM roles and policies
- Cognito resources
- DynamoDB tables
- S3 buckets
- KMS keys

### Test Failures

For integration test failures:
1. Verify all stacks are deployed
2. Check environment variables are set correctly
3. Ensure test users have been created

## Clean Up

To remove all resources:

```bash
# Development
npm run destroy -- -c stage=dev

# Staging
npm run destroy -- -c stage=staging

# Production (be careful!)
npm run destroy -- -c stage=prod
```

**Note**: Some resources like S3 buckets may need manual deletion if they contain data.

## Next Steps

After Phase 1 deployment:
1. Deploy the frontend application
2. Configure frontend with stack outputs
3. Test authentication flow
4. Verify direct AWS access from browser

## Support

For issues or questions, refer to the project documentation in `/docs`.