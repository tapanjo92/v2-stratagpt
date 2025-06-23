import { fetchAuthSession } from 'aws-amplify/auth';
import { 
  getAwsCredentials, 
  createDynamoDBClient, 
  createS3Client,
  createSTSClient,
  clearCredentialCache,
  startCredentialRefresh,
  stopCredentialRefresh 
} from '@/app/lib/aws-config';

jest.mock('aws-amplify/auth');

describe('AWS Config', () => {
  const mockCredentials = {
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    sessionToken: 'test-session-token',
    expiration: new Date(Date.now() + 3600 * 1000)
  };

  const mockSession = {
    credentials: mockCredentials,
    identityId: 'test-identity-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearCredentialCache();
    (fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>).mockResolvedValue(mockSession as any);
  });

  afterEach(() => {
    stopCredentialRefresh();
  });

  describe('getAwsCredentials', () => {
    it('should fetch and return AWS credentials', async () => {
      const credentials = await getAwsCredentials();

      expect(fetchAuthSession).toHaveBeenCalledTimes(1);
      expect(credentials).toEqual({
        accessKeyId: mockCredentials.accessKeyId,
        secretAccessKey: mockCredentials.secretAccessKey,
        sessionToken: mockCredentials.sessionToken,
        expiration: mockCredentials.expiration
      });
    });

    it('should cache credentials and not refetch if not expired', async () => {
      const credentials1 = await getAwsCredentials();
      const credentials2 = await getAwsCredentials();

      expect(fetchAuthSession).toHaveBeenCalledTimes(1);
      expect(credentials1).toBe(credentials2);
    });

    it('should refetch credentials if cache is expired', async () => {
      const expiredCredentials = {
        ...mockCredentials,
        expiration: new Date(Date.now() - 1000)
      };
      
      (fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>)
        .mockResolvedValueOnce({ ...mockSession, credentials: expiredCredentials } as any)
        .mockResolvedValueOnce(mockSession as any);

      await getAwsCredentials();
      clearCredentialCache();
      const credentials = await getAwsCredentials();

      expect(fetchAuthSession).toHaveBeenCalledTimes(2);
      expect(credentials.accessKeyId).toBe(mockCredentials.accessKeyId);
    });

    it('should throw error if no credentials available', async () => {
      (fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>)
        .mockResolvedValueOnce({ identityId: 'test-id' } as any);

      await expect(getAwsCredentials()).rejects.toThrow('Failed to get AWS credentials');
    });

    it('should handle fetchAuthSession errors', async () => {
      (fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>)
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(getAwsCredentials()).rejects.toThrow('Failed to get AWS credentials');
    });
  });

  describe('createDynamoDBClient', () => {
    it('should create a DynamoDB client with credentials', async () => {
      const client = await createDynamoDBClient();

      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
      expect(fetchAuthSession).toHaveBeenCalled();
    });
  });

  describe('createS3Client', () => {
    it('should create an S3 client with credentials', async () => {
      const client = await createS3Client();

      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
      expect(fetchAuthSession).toHaveBeenCalled();
    });
  });

  describe('createSTSClient', () => {
    it('should create an STS client with credentials', async () => {
      const client = await createSTSClient();

      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
      expect(fetchAuthSession).toHaveBeenCalled();
    });
  });

  describe('credential refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start credential refresh interval', async () => {
      startCredentialRefresh(1000);

      await getAwsCredentials();
      expect(fetchAuthSession).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      expect(fetchAuthSession).toHaveBeenCalledTimes(1);
    });

    it('should refresh credentials when they are close to expiring', async () => {
      const nearExpiryCredentials = {
        ...mockCredentials,
        expiration: new Date(Date.now() + 10 * 60 * 1000)
      };

      (fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>)
        .mockResolvedValueOnce({ ...mockSession, credentials: nearExpiryCredentials } as any)
        .mockResolvedValueOnce(mockSession as any);

      startCredentialRefresh(1000);
      
      await getAwsCredentials();
      jest.advanceTimersByTime(1100);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(fetchAuthSession).toHaveBeenCalledTimes(2);
    });

    it('should stop credential refresh', () => {
      startCredentialRefresh(1000);
      stopCredentialRefresh();

      jest.advanceTimersByTime(2000);
      
      expect(fetchAuthSession).toHaveBeenCalledTimes(0);
    });
  });

  describe('clearCredentialCache', () => {
    it('should clear cached credentials', async () => {
      await getAwsCredentials();
      expect(fetchAuthSession).toHaveBeenCalledTimes(1);

      clearCredentialCache();
      await getAwsCredentials();
      
      expect(fetchAuthSession).toHaveBeenCalledTimes(2);
    });
  });
});