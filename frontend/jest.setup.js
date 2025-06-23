// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NEXT_PUBLIC_USER_POOL_ID = 'test-user-pool-id'
process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID = 'test-client-id'
process.env.NEXT_PUBLIC_IDENTITY_POOL_ID = 'test-identity-pool-id'
process.env.NEXT_PUBLIC_AWS_REGION = 'us-east-1'
process.env.NEXT_PUBLIC_DYNAMODB_TABLE_NAME = 'StrataGPT-test'
process.env.NEXT_PUBLIC_S3_DOCUMENTS_BUCKET = 'test-documents-bucket'
process.env.NEXT_PUBLIC_S3_PUBLIC_BUCKET = 'test-public-bucket'