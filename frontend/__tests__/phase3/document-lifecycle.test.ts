import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { s3Service } from '@/app/lib/services/s3-service';
import { dynamoDBService } from '@/app/lib/services/dynamodb-service';
import { mockAuthSession, mockUser, clearAuthMocks, mockS3Client, mockDynamoDBClient } from '../lib/test-utils';

// Mock the AWS config module
jest.mock('@/app/lib/aws-config', () => ({
  createS3Client: jest.fn().mockResolvedValue((global as any).mockS3ClientInstance),
  createDynamoDBClient: jest.fn().mockResolvedValue((global as any).mockDynamoDBClientInstance),
  awsConfig: {
    region: 'us-east-1',
    userPoolId: 'test-user-pool',
    identityPoolId: 'test-identity-pool',
    userPoolClientId: 'test-client-id',
    dynamoDBTable: 'test-table',
    s3BucketDocuments: 'test-documents-bucket',
    s3BucketProcessed: 'test-processed-bucket'
  }
}));

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => (global as any).mockS3ClientInstance),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'PutObjectCommand' } })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'GetObjectCommand' } })),
  ListObjectsV2Command: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'ListObjectsV2Command' } })),
  HeadObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'HeadObjectCommand' } })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'DeleteObjectCommand' } })),
  CreateMultipartUploadCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'CreateMultipartUploadCommand' } })),
  UploadPartCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'UploadPartCommand' } })),
  CompleteMultipartUploadCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'CompleteMultipartUploadCommand' } })),
  AbortMultipartUploadCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'AbortMultipartUploadCommand' } }))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue((global as any).mockDynamoDBClientInstance)
  },
  PutCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'PutCommand' } })),
  GetCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'GetCommand' } })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'QueryCommand' } })),
  UpdateCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'UpdateCommand' } })),
  DeleteCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'DeleteCommand' } }))
}));

jest.mock('aws-amplify/auth');

// Mock the signed URL function
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://test-signed-url.com')
}));

describe('Phase 3: Document Management System', () => {
  let s3Mocks: ReturnType<typeof mockS3Client>;
  let dynamoMocks: ReturnType<typeof mockDynamoDBClient>;

  beforeAll(() => {
    mockAuthSession();
    mockUser();
    s3Mocks = mockS3Client();
    dynamoMocks = mockDynamoDBClient();
  });

  afterAll(() => {
    clearAuthMocks();
    jest.restoreAllMocks();
  });

  describe('Subphase 3.1: Direct S3 Upload Implementation', () => {
    test('Can upload file to user partition', async () => {
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf'
      });

      const key = await s3Service.uploadDocument(file);

      expect(key).toMatch(/users\/.*\/documents\/\d+_test\.pdf/);
    });

    test('Upload progress is tracked', async () => {
      const file = new File(['x'.repeat(10 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf'
      }); // 10MB file
      const progress: number[] = [];

      await s3Service.uploadDocument(file, (p) => {
        progress.push(p.percentage);
      });

      expect(progress.length).toBeGreaterThan(0);
      expect(progress[progress.length - 1]).toBe(100);
    });

    test('Cannot upload to other user paths', async () => {
      // This is enforced by IAM policies, but we can test the key generation
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const key = await s3Service.uploadDocument(file);
      
      // Verify the key includes the current user's ID
      expect(key).toMatch(/^users\/test-identity-id\//);
    });

    test('Integration: Upload → List → Download', async () => {
      const file = new File(['test content'], 'test-integration.pdf', {
        type: 'application/pdf'
      });

      // Upload
      const uploadedKey = await s3Service.uploadDocument(file);
      expect(uploadedKey).toBeDefined();

      // List
      const files = await s3Service.listDocuments();
      expect(files).toContainEqual(
        expect.objectContaining({ key: uploadedKey })
      );

      // Download
      const downloadUrl = await s3Service.getPresignedDownloadUrl(uploadedKey);
      expect(downloadUrl).toContain(uploadedKey);
    });

    test('Multipart upload for large files', async () => {
      const largeFile = new File(
        ['x'.repeat(15 * 1024 * 1024)], // 15MB
        'large-file.pdf',
        { type: 'application/pdf' }
      );

      const key = await s3Service.uploadDocument(largeFile);
      expect(key).toMatch(/users\/.*\/documents\/\d+_large-file\.pdf/);
    });
  });

  describe('Subphase 3.2: Document Processing Pipeline', () => {
    test('S3 upload triggers processing', async () => {
      const file = new File(['test pdf content'], 'test-doc.pdf', {
        type: 'application/pdf'
      });

      // Upload document
      const key = await s3Service.uploadDocument(file);

      // Create initial metadata
      await dynamoDBService.createDocumentMetadata({
        documentId: key,
        name: file.name,
        size: file.size,
        contentType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'pending'
      });

      // In real scenario, Lambda would be triggered
      // Here we simulate the expected behavior
      const metadata = await dynamoDBService.getDocumentMetadata(key);
      expect(metadata).toBeDefined();
      expect(metadata?.status).toBe('pending');
    });

    test('Extracted text stored in DynamoDB', async () => {
      const documentId = 'users/test-user/documents/test.pdf';
      
      // Simulate document processing completion
      await dynamoDBService.createDocumentMetadata({
        documentId,
        name: 'test.pdf',
        size: 1024,
        contentType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
        status: 'completed',
        extractedText: 'This is the extracted text from the PDF',
        pageCount: 5
      });

      const metadata = await dynamoDBService.getDocumentMetadata(documentId);
      
      expect(metadata?.extractedText).toBeDefined();
      expect(metadata?.pageCount).toBe(5);
      expect(metadata?.status).toBe('completed');
    });

    test('Failed processing is handled', async () => {
      const documentId = 'users/test-user/documents/corrupt.pdf';
      
      // Simulate failed processing
      await dynamoDBService.createDocumentMetadata({
        documentId,
        name: 'corrupt.pdf',
        size: 1024,
        contentType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
        status: 'failed',
        error: 'Invalid PDF format'
      });

      const metadata = await dynamoDBService.getDocumentMetadata(documentId);
      
      expect(metadata?.status).toBe('failed');
      expect(metadata?.error).toContain('Invalid PDF');
    });

    test('Integration: Full document lifecycle', async () => {
      // Step 1: Upload document
      const file = new File(['test strata law content'], 'strata-law.pdf', {
        type: 'application/pdf'
      });
      const key = await s3Service.uploadDocument(file);

      // Step 2: Create metadata (simulating what the upload handler would do)
      await dynamoDBService.createDocumentMetadata({
        documentId: key,
        name: file.name,
        size: file.size,
        contentType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'pending'
      });

      // Step 3: Simulate processing completion
      await dynamoDBService.updateDocumentStatus(key, 'completed', {
        extractedText: 'strata law content extracted',
        pageCount: 1
      });

      // Step 4: Verify processed document
      const metadata = await dynamoDBService.getDocumentMetadata(key);
      expect(metadata?.status).toBe('completed');
      expect(metadata?.extractedText).toContain('strata law');
      expect(metadata?.pageCount).toBe(1);
    });
  });

  describe('Document Management UI', () => {
    test('Documents list shows processing status', async () => {
      // Mock query to return documents with different statuses
      dynamoMocks.mockQuery.mockResolvedValueOnce({
        Items: [
          {
            documentId: 'users/test-user/documents/doc1.pdf',
            name: 'doc1.pdf',
            size: 1024,
            contentType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            status: 'pending'
          },
          {
            documentId: 'users/test-user/documents/doc2.pdf',
            name: 'doc2.pdf',
            size: 1024,
            contentType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            status: 'processing'
          },
          {
            documentId: 'users/test-user/documents/doc3.pdf',
            name: 'doc3.pdf',
            size: 1024,
            contentType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            status: 'completed'
          },
          {
            documentId: 'users/test-user/documents/doc4.pdf',
            name: 'doc4.pdf',
            size: 1024,
            contentType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            status: 'failed',
            error: 'Processing error'
          }
        ]
      });

      const documents = await dynamoDBService.listDocuments();
      
      // Verify all statuses are represented
      const statuses = documents.map(d => d.status);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('processing');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
    });

    test('Can filter documents by status', async () => {
      // Use the same documents from previous test
      dynamoMocks.mockQuery.mockResolvedValueOnce({
        Items: [
          { documentId: 'doc1', status: 'pending' },
          { documentId: 'doc2', status: 'processing' },
          { documentId: 'doc3', status: 'completed' },
          { documentId: 'doc4', status: 'failed' }
        ]
      });

      const documents = await dynamoDBService.listDocuments();
      
      // In the UI, filtering happens client-side
      const completedDocs = documents.filter(d => d.status === 'completed');
      const failedDocs = documents.filter(d => d.status === 'failed');
      
      expect(completedDocs.length).toBe(1);
      expect(failedDocs.length).toBe(1);
    });
  });

  describe('Security and Permissions', () => {
    test('User can only access their own documents', async () => {
      const key = 'users/test-identity-id/documents/test.pdf';
      
      // This should work
      const metadata = await s3Service.getDocumentMetadata(key);
      expect(metadata).toBeDefined();

      // Mock access denied for other user's document
      s3Mocks.mockHeadObject.mockRejectedValueOnce(new Error('Access denied'));
      
      // This should fail (enforced by IAM in real environment)
      const otherUserKey = 'users/other-user-id/documents/test.pdf';
      await expect(s3Service.getDocumentMetadata(otherUserKey))
        .rejects.toThrow('Access denied');
    });

    test('Document keys include user isolation', async () => {
      const file = new File(['test'], 'security-test.pdf', {
        type: 'application/pdf'
      });
      
      const key = await s3Service.uploadDocument(file);
      
      // Verify key includes user ID for isolation
      expect(key).toMatch(/^users\/test-identity-id\/documents\//);
    });
  });
});