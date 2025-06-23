import { dynamoDBService } from '@/app/lib/services/dynamodb-service';
import { getCurrentUser } from 'aws-amplify/auth';
import { createDynamoDBClient, awsConfig } from '@/app/lib/aws-config';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

jest.mock('aws-amplify/auth');
jest.mock('@/app/lib/aws-config');
jest.mock('@/app/lib/utils/aws-error-handler');

describe('DynamoDBService', () => {
  const mockUserId = 'test-user-123';
  const mockEmail = 'test@example.com';
  const mockTableName = 'test-table';
  
  const mockClient = {
    send: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (getCurrentUser as jest.MockedFunction<typeof getCurrentUser>).mockResolvedValue({
      userId: mockUserId,
      username: 'testuser'
    } as any);
    
    (createDynamoDBClient as jest.MockedFunction<typeof createDynamoDBClient>).mockResolvedValue(mockClient as any);
    
    (awsConfig as any).dynamoDBTable = mockTableName;
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockProfile = {
        userId: mockUserId,
        email: mockEmail,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        profileData: { theme: 'dark' }
      };

      mockClient.send.mockResolvedValueOnce({ Item: mockProfile });

      const result = await dynamoDBService.getUserProfile();

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(GetCommand));
      expect(mockClient.send.mock.calls[0][0].input).toEqual({
        TableName: mockTableName,
        Key: {
          PK: `USER#${mockUserId}`,
          SK: 'PROFILE'
        }
      });
      expect(result).toEqual(mockProfile);
    });

    it('should return null if profile does not exist', async () => {
      mockClient.send.mockResolvedValueOnce({});

      const result = await dynamoDBService.getUserProfile();

      expect(result).toBeNull();
    });

    it('should handle errors from DynamoDB', async () => {
      mockClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      await expect(dynamoDBService.getUserProfile()).rejects.toThrow();
    });
  });

  describe('createUserProfile', () => {
    it('should create user profile successfully', async () => {
      mockClient.send.mockResolvedValueOnce({});

      const result = await dynamoDBService.createUserProfile(mockEmail);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(PutCommand));
      expect(mockClient.send.mock.calls[0][0].input.Item).toMatchObject({
        PK: `USER#${mockUserId}`,
        SK: 'PROFILE',
        userId: mockUserId,
        email: mockEmail
      });
      expect(result).toMatchObject({
        userId: mockUserId,
        email: mockEmail
      });
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile data successfully', async () => {
      const profileData = { displayName: 'Test User', theme: 'light' };
      mockClient.send.mockResolvedValueOnce({});

      await dynamoDBService.updateUserProfile(profileData);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(UpdateCommand));
      expect(mockClient.send.mock.calls[0][0].input).toMatchObject({
        TableName: mockTableName,
        Key: {
          PK: `USER#${mockUserId}`,
          SK: 'PROFILE'
        },
        UpdateExpression: 'SET profileData = :profileData, updatedAt = :updatedAt'
      });
    });
  });

  describe('createChatSession', () => {
    it('should create a new chat session', async () => {
      const title = 'Test Session';
      mockClient.send.mockResolvedValueOnce({});

      const result = await dynamoDBService.createChatSession(title);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(PutCommand));
      expect(result).toMatchObject({
        userId: mockUserId,
        title,
        messages: []
      });
      expect(result.sessionId).toMatch(/^SESSION#\d+#[a-z0-9]+$/);
    });
  });

  describe('getChatSessions', () => {
    it('should get all chat sessions for a user', async () => {
      const mockSessions = [
        {
          userId: mockUserId,
          sessionId: 'SESSION#123#abc',
          title: 'Session 1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messages: []
        }
      ];

      mockClient.send.mockResolvedValueOnce({ Items: mockSessions });

      const result = await dynamoDBService.getChatSessions();

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(QueryCommand));
      expect(mockClient.send.mock.calls[0][0].input).toMatchObject({
        TableName: mockTableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${mockUserId}`,
          ':sk': 'SESSION#'
        }
      });
      expect(result).toEqual(mockSessions);
    });

    it('should return empty array if no sessions exist', async () => {
      mockClient.send.mockResolvedValueOnce({});

      const result = await dynamoDBService.getChatSessions();

      expect(result).toEqual([]);
    });
  });

  describe('addMessageToSession', () => {
    it('should add a message to a session', async () => {
      const sessionId = 'SESSION#123#abc';
      const role = 'user';
      const content = 'Hello, world!';
      
      mockClient.send.mockResolvedValueOnce({});

      await dynamoDBService.addMessageToSession(sessionId, role, content);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const updateInput = mockClient.send.mock.calls[0][0].input;
      
      expect(updateInput.Key).toEqual({
        PK: `USER#${mockUserId}`,
        SK: sessionId
      });
      expect(updateInput.UpdateExpression).toContain('list_append');
      
      const message = updateInput.ExpressionAttributeValues[':message'][0];
      expect(message).toMatchObject({
        role,
        content
      });
      expect(message.messageId).toMatch(/^MSG#\d+#[a-z0-9]+$/);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const sessionId = 'SESSION#123#abc';
      mockClient.send.mockResolvedValueOnce({});

      await dynamoDBService.deleteSession(sessionId);

      expect(mockClient.send).toHaveBeenCalledWith(expect.any(DeleteCommand));
      expect(mockClient.send.mock.calls[0][0].input).toEqual({
        TableName: mockTableName,
        Key: {
          PK: `USER#${mockUserId}`,
          SK: sessionId
        }
      });
    });
  });
});