import { jest } from '@jest/globals';

export const mockAuthSession = () => {
  const mockSession = {
    identityId: 'test-identity-id',
    credentials: {
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      sessionToken: 'test-session-token',
      expiry: new Date(Date.now() + 3600000)
    },
    tokens: {
      idToken: 'test-id-token',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token'
    }
  };

  jest.mock('aws-amplify/auth', () => ({
    fetchAuthSession: jest.fn().mockResolvedValue(mockSession),
    getCurrentUser: jest.fn().mockResolvedValue({
      userId: 'test-user-id',
      username: 'test-user',
      attributes: {
        email: 'test@example.com'
      }
    })
  }));

  return mockSession;
};

export const mockUser = () => {
  const user = {
    userId: 'test-user-id',
    username: 'test-user',
    attributes: {
      email: 'test@example.com'
    }
  };

  return user;
};

export const clearAuthMocks = () => {
  jest.clearAllMocks();
};

export const createTestFile = (content: string = 'test content', filename: string = 'test.pdf'): File => {
  return new File([content], filename, {
    type: 'application/pdf'
  });
};

export const createLargeTestFile = (sizeInBytes: number): File => {
  const content = 'x'.repeat(sizeInBytes);
  return new File([content], 'large-file.pdf', {
    type: 'application/pdf'
  });
};

export const mockS3Client = () => {
  const mockPutObject = jest.fn().mockResolvedValue({
    ETag: '"test-etag"',
    VersionId: 'test-version'
  });

  const mockGetObject = jest.fn().mockResolvedValue({
    Body: {
      transformToWebStream: () => ({
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
            .mockResolvedValueOnce({ done: true })
        })
      })
    },
    ContentType: 'application/pdf'
  });

  const mockListObjectsV2 = jest.fn().mockResolvedValue({
    Contents: [
      {
        Key: 'users/test-identity-id/documents/test.pdf',
        Size: 1024,
        LastModified: new Date()
      }
    ]
  });

  const mockHeadObject = jest.fn().mockResolvedValue({
    ContentLength: 1024,
    ContentType: 'application/pdf',
    LastModified: new Date()
  });

  const mockDeleteObject = jest.fn().mockResolvedValue({});

  const mockCreateMultipartUpload = jest.fn().mockResolvedValue({
    UploadId: 'test-upload-id'
  });

  const mockUploadPart = jest.fn().mockResolvedValue({
    ETag: '"test-part-etag"'
  });

  const mockCompleteMultipartUpload = jest.fn().mockResolvedValue({
    Location: 'https://test-bucket.s3.amazonaws.com/test-key',
    ETag: '"test-complete-etag"'
  });

  const mockS3ClientInstance = {
    send: jest.fn().mockImplementation((command) => {
      if (command.constructor.name === 'PutObjectCommand') return mockPutObject();
      if (command.constructor.name === 'GetObjectCommand') return mockGetObject();
      if (command.constructor.name === 'ListObjectsV2Command') return mockListObjectsV2();
      if (command.constructor.name === 'HeadObjectCommand') return mockHeadObject();
      if (command.constructor.name === 'DeleteObjectCommand') return mockDeleteObject();
      if (command.constructor.name === 'CreateMultipartUploadCommand') return mockCreateMultipartUpload();
      if (command.constructor.name === 'UploadPartCommand') return mockUploadPart();
      if (command.constructor.name === 'CompleteMultipartUploadCommand') return mockCompleteMultipartUpload();
      throw new Error(`Unknown command: ${command.constructor.name}`);
    })
  };

  // Mock the S3Client constructor
  (global as any).mockS3ClientInstance = mockS3ClientInstance;

  return {
    mockS3ClientInstance,
    mockPutObject,
    mockGetObject,
    mockListObjectsV2,
    mockHeadObject,
    mockDeleteObject,
    mockCreateMultipartUpload,
    mockUploadPart,
    mockCompleteMultipartUpload
  };
};

export const mockDynamoDBClient = () => {
  const mockPut = jest.fn().mockResolvedValue({});
  const mockGet = jest.fn().mockResolvedValue({
    Item: {
      documentId: 'test-doc-id',
      name: 'test.pdf',
      size: 1024,
      contentType: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      status: 'pending'
    }
  });
  const mockQuery = jest.fn().mockResolvedValue({
    Items: []
  });
  const mockUpdate = jest.fn().mockResolvedValue({});
  const mockDelete = jest.fn().mockResolvedValue({});

  const mockDynamoDBClientInstance = {
    send: jest.fn().mockImplementation((command) => {
      if (command.constructor.name === 'PutCommand') return mockPut();
      if (command.constructor.name === 'GetCommand') return mockGet();
      if (command.constructor.name === 'QueryCommand') return mockQuery();
      if (command.constructor.name === 'UpdateCommand') return mockUpdate();
      if (command.constructor.name === 'DeleteCommand') return mockDelete();
      throw new Error(`Unknown command: ${command.constructor.name}`);
    })
  };

  // Mock the DynamoDB client instance
  (global as any).mockDynamoDBClientInstance = mockDynamoDBClientInstance;

  return {
    mockDynamoDBClientInstance,
    mockPut,
    mockGet,
    mockQuery,
    mockUpdate,
    mockDelete
  };
};

export const waitFor = async (
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> => {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
};