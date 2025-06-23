import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient, awsConfig } from '../aws-config';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { withRetry } from '../utils/aws-error-handler';

export interface UserProfile {
  userId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  profileData?: Record<string, any>;
}

export interface ChatSession {
  userId: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DocumentMetadata {
  documentId: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedText?: string;
  pageCount?: number;
  error?: string;
}

export class DynamoDBService {
  private tableName: string;

  constructor() {
    this.tableName = awsConfig.dynamoDBTable;
  }

  private async getUserId(): Promise<string> {
    // We need the identity pool ID for IAM policy matching
    const session = await fetchAuthSession();
    
    // Use identityId for IAM policy matching with DynamoDB
    return session.identityId || (await getCurrentUser()).userId;
  }

  async getUserProfile(): Promise<UserProfile | null> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      const response = await client.send(command);
      
      if (!response.Item) {
        return null;
      }

      return {
        userId: response.Item.userId,
        email: response.Item.email,
        createdAt: response.Item.createdAt,
        updatedAt: response.Item.updatedAt,
        profileData: response.Item.profileData
      };
    });
  }

  async createUserProfile(email: string): Promise<UserProfile> {
    try {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();
      const now = new Date().toISOString();

      const profile: UserProfile = {
        userId,
        email,
        createdAt: now,
        updatedAt: now
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
          ...profile
        }
      });

      await client.send(command);
      return profile;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  async updateUserProfile(profileData: Record<string, any>): Promise<void> {
    try {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        },
        UpdateExpression: 'SET profileData = :profileData, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':profileData': profileData,
          ':updatedAt': new Date().toISOString()
        }
      });

      await client.send(command);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  async createChatSession(title: string): Promise<ChatSession> {
    try {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();
      const sessionId = `SESSION#${Date.now()}#${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const session: ChatSession = {
        userId,
        sessionId,
        title,
        createdAt: now,
        updatedAt: now,
        messages: []
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${userId}`,
          SK: sessionId,
          ...session
        }
      });

      await client.send(command);
      return session;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  async getChatSessions(): Promise<ChatSession[]> {
    try {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'SESSION#'
        },
        ScanIndexForward: false
      });

      const response = await client.send(command);
      
      if (!response.Items) {
        return [];
      }

      return response.Items.map(item => ({
        userId: item.userId,
        sessionId: item.sessionId,
        title: item.title,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        messages: item.messages || []
      }));
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      throw new Error('Failed to get chat sessions');
    }
  }

  async addMessageToSession(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    try {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();
      const messageId = `MSG#${Date.now()}#${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      const message: ChatMessage = {
        messageId,
        role,
        content,
        timestamp
      };

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: sessionId
        },
        UpdateExpression: 'SET messages = list_append(if_not_exists(messages, :empty_list), :message), updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':message': [message],
          ':empty_list': [],
          ':updatedAt': timestamp
        }
      });

      await client.send(command);
    } catch (error) {
      console.error('Error adding message to session:', error);
      throw new Error('Failed to add message to session');
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: sessionId
        }
      });

      await client.send(command);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw new Error('Failed to delete session');
    }
  }

  // Document metadata methods
  async createDocumentMetadata(metadata: DocumentMetadata): Promise<void> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${userId}`,
          SK: `DOC#${metadata.documentId}`,
          entityType: 'document',
          ...metadata,
          userId,
          createdAt: new Date().toISOString()
        }
      });

      await client.send(command);
    });
  }

  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata | null> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `DOC#${documentId}`
        }
      });

      const response = await client.send(command);
      
      if (!response.Item) {
        return null;
      }

      return {
        documentId: response.Item.documentId,
        name: response.Item.name,
        size: response.Item.size,
        contentType: response.Item.contentType,
        uploadedAt: response.Item.uploadedAt,
        status: response.Item.status,
        extractedText: response.Item.extractedText,
        pageCount: response.Item.pageCount,
        error: response.Item.error
      };
    });
  }

  async updateDocumentStatus(
    documentId: string, 
    status: DocumentMetadata['status'], 
    updates?: Partial<DocumentMetadata>
  ): Promise<void> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      let updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
      const expressionAttributeNames: Record<string, string> = {
        '#status': 'status'
      };
      const expressionAttributeValues: Record<string, any> = {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      };

      if (updates?.extractedText) {
        updateExpression += ', extractedText = :extractedText';
        expressionAttributeValues[':extractedText'] = updates.extractedText;
      }

      if (updates?.pageCount) {
        updateExpression += ', pageCount = :pageCount';
        expressionAttributeValues[':pageCount'] = updates.pageCount;
      }

      if (updates?.error) {
        updateExpression += ', #error = :error';
        expressionAttributeNames['#error'] = 'error';
        expressionAttributeValues[':error'] = updates.error;
      }

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `DOC#${documentId}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      });

      await client.send(command);
    });
  }

  async deleteDocumentMetadata(documentId: string): Promise<void> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `DOC#${documentId}`
        }
      });

      await client.send(command);
    });
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'DOC#'
        },
        Limit: 100
      });

      const response = await client.send(command);
      
      if (!response.Items) {
        return [];
      }

      return response.Items.map(item => ({
        documentId: item.documentId,
        name: item.name,
        size: item.size,
        contentType: item.contentType,
        uploadedAt: item.uploadedAt,
        status: item.status,
        extractedText: item.extractedText,
        pageCount: item.pageCount,
        error: item.error
      }));
    });
  }

  // Chat-related methods
  async saveChatMessage(message: {
    messageId: string;
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }): Promise<void> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${userId}`,
          SK: `CHAT#${message.conversationId}#${message.timestamp}`,
          messageId: message.messageId,
          conversationId: message.conversationId,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          entityType: 'CHAT_MESSAGE'
        }
      });

      await client.send(command);
    });
  }

  async getChatHistory(conversationId: string = 'default', limit: number = 50): Promise<any[]> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `CHAT#${conversationId}#`
        },
        Limit: limit,
        ScanIndexForward: false // Get newest messages first
      });

      const response = await client.send(command);
      const items = response.Items || [];

      // Return in chronological order (oldest first)
      return items.reverse().map(item => ({
        messageId: item.messageId,
        conversationId: item.conversationId,
        role: item.role,
        content: item.content,
        timestamp: item.timestamp
      }));
    });
  }

  async deleteConversation(conversationId: string = 'default'): Promise<void> {
    return withRetry(async () => {
      const client = await createDynamoDBClient();
      const userId = await this.getUserId();

      // First, get all messages in the conversation
      const messages = await this.getChatHistory(conversationId, 1000);

      // Delete each message
      for (const message of messages) {
        const deleteCommand = new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: `USER#${userId}`,
            SK: `CHAT#${conversationId}#${message.timestamp}`
          }
        });
        await client.send(deleteCommand);
      }
    });
  }
}

export const dynamoDBService = new DynamoDBService();