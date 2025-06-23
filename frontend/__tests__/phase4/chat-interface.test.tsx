import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatPage from '@/app/dashboard/chat/page';
import { useAuth } from '@/app/contexts/AuthContext';
import { DynamoDBService } from '@/app/lib/services/dynamodb-service';

// Mock the auth context
jest.mock('@/app/contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Mock the DynamoDB service
jest.mock('@/app/lib/services/dynamodb-service', () => ({
  DynamoDBService: jest.fn().mockImplementation(() => ({
    getChatHistory: jest.fn(),
    saveChatMessage: jest.fn(),
    deleteConversation: jest.fn()
  }))
}));

describe('Phase 4.1: Chat Interface', () => {
  let mockDynamoDBService: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock auth context
    (useAuth as jest.Mock).mockReturnValue({
      user: { userId: 'test-user-123', username: 'testuser' },
      loading: false
    });
    
    // Get mock instance
    mockDynamoDBService = new DynamoDBService();
  });

  describe('Chat UI Components', () => {
    test('renders chat interface with all components', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([]);
      
      render(<ChatPage />);
      
      // Check header
      expect(screen.getByText('Strata Law Assistant')).toBeInTheDocument();
      expect(screen.getByText('Ask questions about strata law and your documents')).toBeInTheDocument();
      
      // Check input area
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
      
      // Check empty state
      await waitFor(() => {
        expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      });
    });

    test('can send and display messages', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([]);
      mockDynamoDBService.saveChatMessage.mockResolvedValue(undefined);
      
      render(<ChatPage />);
      
      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button');
      
      // Type and send message
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);
      
      // Check message appears
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
      
      // Check input is cleared
      expect(input).toHaveValue('');
      
      // Check assistant response appears (placeholder)
      await waitFor(() => {
        expect(screen.getByText(/placeholder response/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('shows typing indicator during assistant response', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([]);
      mockDynamoDBService.saveChatMessage.mockResolvedValue(undefined);
      
      render(<ChatPage />);
      
      const input = screen.getByPlaceholderText('Type your message...');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.submit(input.closest('form')!);
      
      // Check for typing indicator
      await waitFor(() => {
        const typingIndicator = screen.getByText('AI').closest('.flex')?.querySelector('.animate-bounce');
        expect(typingIndicator).toBeInTheDocument();
      });
      
      // Typing indicator should disappear after response
      await waitFor(() => {
        const typingIndicator = screen.queryByText('AI')?.closest('.flex')?.querySelector('.animate-bounce');
        expect(typingIndicator).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('disables input while sending message', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([]);
      mockDynamoDBService.saveChatMessage.mockResolvedValue(undefined);
      
      render(<ChatPage />);
      
      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button');
      
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);
      
      // Check input is disabled
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
      
      // Should be re-enabled after sending
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      }, { timeout: 3000 });
    });
  });

  describe('Message History', () => {
    test('loads and displays chat history on mount', async () => {
      const mockHistory = [
        {
          messageId: 'msg-1',
          conversationId: 'default',
          role: 'user',
          content: 'Previous user message',
          timestamp: new Date().toISOString()
        },
        {
          messageId: 'msg-2',
          conversationId: 'default',
          role: 'assistant',
          content: 'Previous assistant response',
          timestamp: new Date().toISOString()
        }
      ];
      
      mockDynamoDBService.getChatHistory.mockResolvedValue(mockHistory);
      
      render(<ChatPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Previous user message')).toBeInTheDocument();
        expect(screen.getByText('Previous assistant response')).toBeInTheDocument();
      });
      
      expect(mockDynamoDBService.getChatHistory).toHaveBeenCalledTimes(1);
    });

    test('shows error state when loading history fails', async () => {
      mockDynamoDBService.getChatHistory.mockRejectedValue(new Error('Failed to load'));
      
      render(<ChatPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
        expect(screen.getByText('Try again')).toBeInTheDocument();
      });
    });

    test('can retry loading history after error', async () => {
      mockDynamoDBService.getChatHistory
        .mockRejectedValueOnce(new Error('Failed to load'))
        .mockResolvedValueOnce([]);
      
      render(<ChatPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Try again'));
      
      await waitFor(() => {
        expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      });
    });
  });

  describe('DynamoDB Persistence', () => {
    test('saves messages to DynamoDB', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([]);
      mockDynamoDBService.saveChatMessage.mockResolvedValue(undefined);
      
      render(<ChatPage />);
      
      const input = screen.getByPlaceholderText('Type your message...');
      fireEvent.change(input, { target: { value: 'Test persistence' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(mockDynamoDBService.saveChatMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            conversationId: 'default',
            role: 'user',
            content: 'Test persistence'
          })
        );
      });
      
      // Should also save assistant response
      await waitFor(() => {
        expect(mockDynamoDBService.saveChatMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            conversationId: 'default',
            role: 'assistant',
            content: expect.stringContaining('placeholder response')
          })
        );
      }, { timeout: 3000 });
    });

    test('shows error status when message save fails', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([]);
      mockDynamoDBService.saveChatMessage.mockRejectedValue(new Error('Save failed'));
      
      render(<ChatPage />);
      
      const input = screen.getByPlaceholderText('Type your message...');
      fireEvent.change(input, { target: { value: 'Test error' } });
      fireEvent.submit(input.closest('form')!);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to send')).toBeInTheDocument();
      });
    });
  });

  describe('Message Display', () => {
    test('displays user messages with correct styling', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([
        {
          messageId: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: new Date().toISOString()
        }
      ]);
      
      render(<ChatPage />);
      
      await waitFor(() => {
        const userMessage = screen.getByText('User message');
        const messageContainer = userMessage.closest('.bg-blue-600');
        expect(messageContainer).toBeInTheDocument();
        expect(screen.getByText('U')).toBeInTheDocument();
      });
    });

    test('displays assistant messages with correct styling', async () => {
      mockDynamoDBService.getChatHistory.mockResolvedValue([
        {
          messageId: 'msg-1',
          role: 'assistant',
          content: 'Assistant message',
          timestamp: new Date().toISOString()
        }
      ]);
      
      render(<ChatPage />);
      
      await waitFor(() => {
        const assistantMessage = screen.getByText('Assistant message');
        const messageContainer = assistantMessage.closest('.bg-white');
        expect(messageContainer).toBeInTheDocument();
        expect(screen.getByText('AI')).toBeInTheDocument();
      });
    });

    test('displays message timestamps', async () => {
      const timestamp = new Date();
      mockDynamoDBService.getChatHistory.mockResolvedValue([
        {
          messageId: 'msg-1',
          role: 'user',
          content: 'Test message',
          timestamp: timestamp.toISOString()
        }
      ]);
      
      render(<ChatPage />);
      
      await waitFor(() => {
        const timeString = timestamp.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        expect(screen.getByText(timeString)).toBeInTheDocument();
      });
    });
  });
});