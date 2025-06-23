# Phase 1 Tests

This directory contains all tests for Phase 1: Foundation & Identity Infrastructure.

## Test Structure

```
test/phase1/
├── README.md                           # This file
├── foundation.test.ts                  # Unit tests for CDK stacks
├── auth.integration.test.ts            # Integration tests for authentication
├── test-deployment.js                  # Complete deployment test
├── test-minimal.js                     # Minimal infrastructure test
├── subphase-1.1/                      # CDK Setup tests
├── subphase-1.2/                      # Cognito User Pool tests
├── subphase-1.3/                      # Identity Pool tests
└── subphase-1.4/                      # DynamoDB Direct Access tests
```

## Test Categories

### 1. Unit Tests (`foundation.test.ts`)
- CDK stack synthesis
- Template assertions
- Resource configuration validation
- Environment variable checks

### 2. Integration Tests (`auth.integration.test.ts`)
- End-to-end authentication flow
- Credential vending
- DynamoDB access with user isolation
- Full user journey testing

### 3. Deployment Tests (`test-deployment.js`)
- Live infrastructure validation
- Actual AWS service testing
- Security verification
- Performance validation

### 4. Subphase Tests
Each subphase has dedicated tests following the test-driven approach:

#### Subphase 1.1: CDK Setup
- ✅ CDK synthesizes without errors
- ✅ Environment variables properly configured
- ✅ Stack structure validation

#### Subphase 1.2: Cognito User Pool
- ✅ User Pool exists with MFA
- ✅ Password policies configured
- ✅ Custom attributes set up
- ✅ Test users can be created

#### Subphase 1.3: Identity Pool Integration
- ✅ Identity Pool linked to User Pool
- ✅ Authenticated/unauthenticated roles configured
- ✅ Credential vending works
- ✅ Role mappings correct

#### Subphase 1.4: DynamoDB Direct Access
- ✅ DynamoDB table with proper indexes
- ✅ IAM policies for user isolation
- ✅ S3 buckets with CORS
- ✅ End-to-end data access

## Running Tests

### All Phase 1 Tests
```bash
npm run test:phase1
```

### Individual Test Suites
```bash
# Unit tests only
npm run test:phase1:unit

# Integration tests only
npm run test:phase1:integration

# Deployment validation
npm run test:phase1:deployment

# Specific subphase
npm run test:phase1:subphase-1.1
npm run test:phase1:subphase-1.2
npm run test:phase1:subphase-1.3
npm run test:phase1:subphase-1.4
```

### Manual Tests
```bash
# Test infrastructure
node test/phase1/test-minimal.js

# Full deployment test
node test/phase1/test-deployment.js
```

## Prerequisites

### For Unit Tests
- CDK project built (`npm run build`)
- No AWS resources required

### For Integration Tests
- AWS credentials configured
- Phase 1 infrastructure deployed
- Environment variables set:
  ```bash
  export USER_POOL_ID=your-user-pool-id
  export USER_POOL_CLIENT_ID=your-client-id
  export IDENTITY_POOL_ID=your-identity-pool-id
  export TABLE_NAME=your-table-name
  export AWS_REGION=ap-south-1
  ```

### For Deployment Tests
- Test users created (`npm run create-test-users`)
- All Phase 1 stacks deployed

## Success Criteria

Phase 1 is complete when:

1. **All unit tests pass** (100% success rate)
2. **All integration tests pass** (100% success rate)
3. **All deployment tests pass** (100% success rate)
4. **All subphase gates pass**:
   - Gate 1.1: ✅ Can synthesize and deploy stack
   - Gate 1.2: ✅ Can create user and get JWT token
   - Gate 1.3: ✅ Frontend can obtain AWS credentials
   - Gate 1.4: ✅ Users can read/write their own data only

## Test Data Management

### Test Users
- `test1@stratagpt.com` / `TestPassword123!`
- `test2@stratagpt.com` / `TestPassword123!`
- `admin@stratagpt.com` / `AdminPassword123!`

### Test Data Cleanup
Test data is automatically cleaned up using:
- DynamoDB TTL for temporary test records
- S3 lifecycle policies for test files
- Test user cleanup scripts

## Troubleshooting

### Common Issues

1. **Unit tests fail**: Run `npm run build` first
2. **Integration tests fail**: Check environment variables
3. **Deployment tests fail**: Verify stacks are deployed
4. **Auth flow errors**: Check User Pool Client configuration

### Debug Commands
```bash
# Check deployed stacks
aws cloudformation list-stacks --region ap-south-1

# Verify test users
aws cognito-idp list-users --user-pool-id $USER_POOL_ID

# Check DynamoDB table
aws dynamodb describe-table --table-name $TABLE_NAME

# Verify IAM policies
aws iam list-policies --scope Local
```