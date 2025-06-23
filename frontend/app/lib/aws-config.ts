import { fetchAuthSession } from 'aws-amplify/auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { STSClient } from '@aws-sdk/client-sts';
import type { AwsCredentialIdentity } from '@aws-sdk/types';

const REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

interface CachedCredentials {
  credentials: AwsCredentialIdentity | null;
  expiration: number;
}

let credentialCache: CachedCredentials = {
  credentials: null,
  expiration: 0
};

export async function getAwsCredentials(): Promise<AwsCredentialIdentity> {
  const now = Date.now();
  
  if (credentialCache.credentials && credentialCache.expiration > now + 5 * 60 * 1000) {
    return credentialCache.credentials;
  }

  try {
    const session = await fetchAuthSession();
    
    if (!session.credentials) {
      throw new Error('No credentials available. Please sign in.');
    }

    const credentials: AwsCredentialIdentity = {
      accessKeyId: session.credentials.accessKeyId,
      secretAccessKey: session.credentials.secretAccessKey,
      sessionToken: session.credentials.sessionToken,
      expiration: session.credentials.expiration
    };

    credentialCache = {
      credentials,
      expiration: credentials.expiration ? credentials.expiration.getTime() : now + 3600 * 1000
    };

    return credentials;
  } catch (error) {
    console.error('Error fetching AWS credentials:', error);
    throw new Error('Failed to get AWS credentials. Please sign in again.');
  }
}

export async function createDynamoDBClient(): Promise<DynamoDBDocumentClient> {
  const credentials = await getAwsCredentials();
  
  const client = new DynamoDBClient({
    region: REGION,
    credentials
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      convertEmptyValues: false,
      removeUndefinedValues: true,
      convertClassInstanceToMap: false
    },
    unmarshallOptions: {
      wrapNumbers: false
    }
  });
}

export async function createS3Client(): Promise<S3Client> {
  const credentials = await getAwsCredentials();
  
  return new S3Client({
    region: REGION,
    credentials
  });
}

export async function createSTSClient(): Promise<STSClient> {
  const credentials = await getAwsCredentials();
  
  return new STSClient({
    region: REGION,
    credentials
  });
}

export function clearCredentialCache(): void {
  credentialCache = {
    credentials: null,
    expiration: 0
  };
}

let refreshInterval: NodeJS.Timeout | null = null;

export function startCredentialRefresh(intervalMs: number = 10 * 60 * 1000): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(async () => {
    try {
      const now = Date.now();
      if (credentialCache.expiration - now < 15 * 60 * 1000) {
        await getAwsCredentials();
      }
    } catch (error) {
      console.error('Error refreshing credentials:', error);
    }
  }, intervalMs);
}

export function stopCredentialRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

export const awsConfig = {
  region: REGION,
  dynamoDBTable: process.env.NEXT_PUBLIC_DYNAMODB_TABLE_NAME || '',
  s3BucketDocuments: process.env.NEXT_PUBLIC_S3_BUCKET_DOCUMENTS || '',
  s3BucketProcessed: process.env.NEXT_PUBLIC_S3_BUCKET_PROCESSED || '',
  userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || '',
  identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID || ''
};