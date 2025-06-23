import { s3Service } from '@/app/lib/services/s3-service';
import { getCurrentUser } from 'aws-amplify/auth';
import { createS3Client, awsConfig } from '@/app/lib/aws-config';
import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('aws-amplify/auth');
jest.mock('@/app/lib/aws-config');
jest.mock('@/app/lib/utils/aws-error-handler');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3Service', () => {
  const mockUserId = 'test-user-123';
  const mockDocumentsBucket = 'test-documents-bucket';
  const mockProcessedBucket = 'test-processed-bucket';
  const userPrefix = `users/${mockUserId}/`;
  
  const mockClient = {
    send: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (getCurrentUser as jest.MockedFunction<typeof getCurrentUser>).mockResolvedValue({
      userId: mockUserId,
      username: 'testuser'
    } as any);
    
    (createS3Client as jest.MockedFunction<typeof createS3Client>).mockResolvedValue(mockClient as any);
    
    (awsConfig as any).s3BucketDocuments = mockDocumentsBucket;
    (awsConfig as any).s3BucketProcessed = mockProcessedBucket;
  });

  describe('uploadDocument', () => {
    it('should upload a document successfully', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const onProgress = jest.fn();
      
      mockClient.send.mockResolvedValueOnce({});

      const result = await s3Service.uploadDocument(file, onProgress);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      const putCommand = mockClient.send.mock.calls[0][0];
      
      expect(putCommand.input.Bucket).toBe(mockDocumentsBucket);
      expect(putCommand.input.Key).toMatch(new RegExp(`^${userPrefix}documents/\\d+_test_txt$`));
      expect(putCommand.input.ContentType).toBe('text/plain');
      expect(onProgress).toHaveBeenCalledWith({ loaded: 0, total: file.size, percentage: 0 });
      expect(onProgress).toHaveBeenCalledWith({ loaded: file.size, total: file.size, percentage: 100 });
      expect(result).toMatch(new RegExp(`^${userPrefix}documents/\\d+_test_txt$`));
    });

    it('should sanitize file names', async () => {
      const file = new File(['content'], 'test file@#$.txt', { type: 'text/plain' });
      
      mockClient.send.mockResolvedValueOnce({});

      const result = await s3Service.uploadDocument(file);

      expect(result).toMatch(/_test_file___.txt$/);
    });
  });

  describe('downloadDocument', () => {
    it('should download a document successfully', async () => {
      const key = `${userPrefix}documents/123_test.txt`;
      const mockContent = 'test content';
      
      const mockStream = {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ 
              done: false, 
              value: new TextEncoder().encode(mockContent) 
            })
            .mockResolvedValueOnce({ done: true })
        })
      };

      mockClient.send.mockResolvedValueOnce({
        Body: {
          transformToWebStream: () => mockStream
        },
        ContentType: 'text/plain'
      });

      const result = await s3Service.downloadDocument(key);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('text/plain');
    });

    it('should reject download for files outside user prefix', async () => {
      const key = 'users/other-user/documents/file.txt';

      await expect(s3Service.downloadDocument(key))
        .rejects.toThrow('Access denied');
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should generate presigned download URL', async () => {
      const key = `${userPrefix}documents/test.txt`;
      const mockUrl = 'https://s3.amazonaws.com/signed-url';
      
      (getSignedUrl as jest.MockedFunction<typeof getSignedUrl>).mockResolvedValueOnce(mockUrl);

      const result = await s3Service.getPresignedDownloadUrl(key);

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockClient,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
      expect(result).toBe(mockUrl);
    });

    it('should reject URL generation for files outside user prefix', async () => {
      const key = 'users/other-user/documents/file.txt';

      await expect(s3Service.getPresignedDownloadUrl(key))
        .rejects.toThrow('Access denied');
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate presigned upload URL', async () => {
      const fileName = 'test.pdf';
      const contentType = 'application/pdf';
      const mockUrl = 'https://s3.amazonaws.com/upload-signed-url';
      
      (getSignedUrl as jest.MockedFunction<typeof getSignedUrl>).mockResolvedValueOnce(mockUrl);

      const result = await s3Service.getPresignedUploadUrl(fileName, contentType);

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockClient,
        expect.any(PutObjectCommand),
        { expiresIn: 3600 }
      );
      
      const putCommand = (getSignedUrl as jest.MockedFunction<typeof getSignedUrl>).mock.calls[0][1];
      expect(putCommand.input?.ContentType).toBe(contentType);
      expect(result).toBe(mockUrl);
    });
  });

  describe('listDocuments', () => {
    it('should list all user documents', async () => {
      const mockDocuments = [
        {
          Key: `${userPrefix}documents/123_file1.txt`,
          Size: 1024,
          LastModified: new Date('2024-01-01')
        },
        {
          Key: `${userPrefix}documents/456_file2.pdf`,
          Size: 2048,
          LastModified: new Date('2024-01-02')
        }
      ];

      mockClient.send.mockResolvedValueOnce({ Contents: mockDocuments });

      const result = await s3Service.listDocuments();

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
      expect(mockClient.send.mock.calls[0][0].input).toMatchObject({
        Bucket: mockDocumentsBucket,
        Prefix: `${userPrefix}documents/`
      });
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        key: mockDocuments[0].Key,
        name: '123_file1.txt',
        size: 1024
      });
    });

    it('should return empty array if no documents', async () => {
      mockClient.send.mockResolvedValueOnce({});

      const result = await s3Service.listDocuments();

      expect(result).toEqual([]);
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document successfully', async () => {
      const key = `${userPrefix}documents/test.txt`;
      mockClient.send.mockResolvedValueOnce({});

      await s3Service.deleteDocument(key);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
      expect(mockClient.send.mock.calls[0][0].input).toEqual({
        Bucket: mockDocumentsBucket,
        Key: key
      });
    });

    it('should reject deletion for files outside user prefix', async () => {
      const key = 'users/other-user/documents/file.txt';

      await expect(s3Service.deleteDocument(key))
        .rejects.toThrow('Access denied');
    });
  });

  describe('getDocumentMetadata', () => {
    it('should get document metadata successfully', async () => {
      const key = `${userPrefix}documents/test.txt`;
      const mockMetadata = {
        ContentLength: 1024,
        LastModified: new Date('2024-01-01'),
        ContentType: 'text/plain'
      };

      mockClient.send.mockResolvedValueOnce(mockMetadata);

      const result = await s3Service.getDocumentMetadata(key);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(result).toMatchObject({
        key,
        name: 'test.txt',
        size: 1024,
        contentType: 'text/plain'
      });
    });

    it('should return null for non-existent document', async () => {
      const key = `${userPrefix}documents/nonexistent.txt`;
      const notFoundError = new Error('Not Found');
      (notFoundError as any).name = 'NotFound';
      
      mockClient.send.mockRejectedValueOnce(notFoundError);

      const result = await s3Service.getDocumentMetadata(key);

      expect(result).toBeNull();
    });
  });

  describe('copyToProcessedBucket', () => {
    it('should copy processed data to processed bucket', async () => {
      const sourceKey = `${userPrefix}documents/test.txt`;
      const processedData = { text: 'processed content', metadata: {} };
      
      mockClient.send.mockResolvedValueOnce({});

      const result = await s3Service.copyToProcessedBucket(sourceKey, processedData);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      const putCommand = mockClient.send.mock.calls[0][0];
      
      expect(putCommand.input.Bucket).toBe(mockProcessedBucket);
      expect(putCommand.input.Key).toBe(`${userPrefix}processed/test.txt`);
      expect(putCommand.input.ContentType).toBe('application/json');
      expect(result).toBe(`${userPrefix}processed/test.txt`);
    });
  });
});