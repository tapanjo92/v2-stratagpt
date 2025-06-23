import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient, awsConfig } from '../aws-config';
import { getCurrentUser } from 'aws-amplify/auth';
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

export class DynamoDBService {
  private tableName: string;

  constructor() {
    this.tableName = awsConfig.dynamoDBTable;
  }

  private async getUserId(): Promise<string> {
    const user = await getCurrentUser();
    return user.userId;
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
}

export const dynamoDBService = new DynamoDBService();