import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommandOutput
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client, awsConfig } from '../aws-config';
import { getCurrentUser } from 'aws-amplify/auth';

export interface S3Document {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export class S3Service {
  private documentsBucket: string;
  private processedBucket: string;

  constructor() {
    this.documentsBucket = awsConfig.s3BucketDocuments;
    this.processedBucket = awsConfig.s3BucketProcessed;
  }

  private async getUserId(): Promise<string> {
    const user = await getCurrentUser();
    return user.userId;
  }

  private getUserPrefix(userId: string): string {
    return `users/${userId}/`;
  }

  async uploadDocument(
    file: File, 
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    if (!this.documentsBucket) {
      throw new Error('S3 documents bucket not configured');
    }
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${userPrefix}documents/${timestamp}_${sanitizedFileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const command = new PutObjectCommand({
        Bucket: this.documentsBucket,
        Key: key,
        Body: uint8Array,
        ContentType: file.type,
        Metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString()
        }
      });

      if (onProgress) {
        onProgress({
          loaded: 0,
          total: file.size,
          percentage: 0
        });
      }

      await client.send(command);

      if (onProgress) {
        onProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100
        });
      }

      return key;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new Error('Failed to upload document');
    }
  }

  async downloadDocument(key: string): Promise<Blob> {
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);

      if (!key.startsWith(userPrefix)) {
        throw new Error('Access denied: Document does not belong to user');
      }

      const command = new GetObjectCommand({
        Bucket: this.documentsBucket,
        Key: key
      });

      const response: GetObjectCommandOutput = await client.send(command);
      
      if (!response.Body) {
        throw new Error('No content received from S3');
      }

      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const concatenated = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        concatenated.set(chunk, offset);
        offset += chunk.length;
      }

      return new Blob([concatenated], { type: response.ContentType || 'application/octet-stream' });
    } catch (error) {
      console.error('Error downloading document:', error);
      throw new Error('Failed to download document');
    }
  }

  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);

      if (!key.startsWith(userPrefix)) {
        throw new Error('Access denied: Document does not belong to user');
      }

      const command = new GetObjectCommand({
        Bucket: this.documentsBucket,
        Key: key
      });

      return await getSignedUrl(client, command, { expiresIn });
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  async getPresignedUploadUrl(fileName: string, contentType: string, expiresIn: number = 3600): Promise<string> {
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${userPrefix}documents/${timestamp}_${sanitizedFileName}`;

      const command = new PutObjectCommand({
        Bucket: this.documentsBucket,
        Key: key,
        ContentType: contentType
      });

      const url = await getSignedUrl(client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating presigned upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  async listDocuments(): Promise<S3Document[]> {
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);

      const command = new ListObjectsV2Command({
        Bucket: this.documentsBucket,
        Prefix: `${userPrefix}documents/`,
        MaxKeys: 1000
      });

      const response = await client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      return response.Contents.map(object => ({
        key: object.Key!,
        name: object.Key!.split('/').pop()!,
        size: object.Size || 0,
        lastModified: object.LastModified || new Date()
      }));
    } catch (error) {
      console.error('Error listing documents:', error);
      throw new Error('Failed to list documents');
    }
  }

  async deleteDocument(key: string): Promise<void> {
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);

      if (!key.startsWith(userPrefix)) {
        throw new Error('Access denied: Document does not belong to user');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.documentsBucket,
        Key: key
      });

      await client.send(command);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error('Failed to delete document');
    }
  }

  async getDocumentMetadata(key: string): Promise<S3Document | null> {
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);

      if (!key.startsWith(userPrefix)) {
        throw new Error('Access denied: Document does not belong to user');
      }

      const command = new HeadObjectCommand({
        Bucket: this.documentsBucket,
        Key: key
      });

      const response = await client.send(command);
      
      return {
        key,
        name: key.split('/').pop()!,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType
      };
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        return null;
      }
      console.error('Error getting document metadata:', error);
      throw new Error('Failed to get document metadata');
    }
  }

  async copyToProcessedBucket(sourceKey: string, processedData: any): Promise<string> {
    try {
      const client = await createS3Client();
      const userId = await this.getUserId();
      const userPrefix = this.getUserPrefix(userId);

      if (!sourceKey.startsWith(userPrefix)) {
        throw new Error('Access denied: Document does not belong to user');
      }

      const processedKey = sourceKey.replace('/documents/', '/processed/');
      
      const command = new PutObjectCommand({
        Bucket: this.processedBucket,
        Key: processedKey,
        Body: JSON.stringify(processedData),
        ContentType: 'application/json',
        Metadata: {
          sourceKey,
          processedAt: new Date().toISOString()
        }
      });

      await client.send(command);
      return processedKey;
    } catch (error) {
      console.error('Error copying to processed bucket:', error);
      throw new Error('Failed to copy to processed bucket');
    }
  }
}

export const s3Service = new S3Service();