'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader, MessageSquare } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { DynamoDBService } from '@/app/lib/services/dynamodb-service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dynamoDBService = useRef(new DynamoDBService());

  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const chatHistory = await dynamoDBService.current.getChatHistory();
      const formattedMessages: Message[] = (chatHistory || []).map(msg => ({
        id: msg.messageId,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        status: 'sent'
      }));
      
      setMessages(formattedMessages);
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setError('Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadChatHistory();
    }
  }, [user]);

  useEffect(() => {
      scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isSending) return;
    
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);
    
    try {
      // Save user message to DynamoDB
      await dynamoDBService.current.saveChatMessage({
        messageId: userMessage.id,
        conversationId: 'default', // Will implement conversation management later
        role: 'user',
        content: userMessage.content,
        timestamp: userMessage.timestamp.toISOString()
      });
      
      // Update message status
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
        )
      );
      
      // Simulate assistant response (Phase 4.3 will integrate with AI)
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: 'I\'m a placeholder response. In Phase 4.3, I\'ll provide real AI-powered responses based on your strata documents!',
        timestamp: new Date(),
        status: 'sent'
      };
      
      // Show typing indicator
      setMessages(prev => [...prev, { 
        id: 'typing', 
        role: 'assistant', 
        content: '', 
        timestamp: new Date() 
      }]);
      
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Remove typing indicator and add response
      setMessages(prev => [
        ...prev.filter(msg => msg.id !== 'typing'),
        assistantMessage
      ]);
      
      // Save assistant message
      await dynamoDBService.current.saveChatMessage({
        messageId: assistantMessage.id,
        conversationId: 'default',
        role: 'assistant',
        content: assistantMessage.content,
        timestamp: assistantMessage.timestamp.toISOString()
      });
      
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
        )
      );
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-6 w-6 text-gray-600" />
            <h1 className="text-xl font-semibold text-gray-900">Strata Law Assistant</h1>
          </div>
          <p className="text-sm text-gray-500">
            Ask questions about strata law and your documents
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-600 mb-2">{error}</p>
              <button 
                onClick={loadChatHistory}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Try again
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-500 text-sm">
                Ask me anything about strata law, building management, or your uploaded documents.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <MessageComponent key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex space-x-4">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Message Component
function MessageComponent({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  // Typing indicator
  if (message.id === 'typing') {
    return (
      <div className="flex items-start space-x-2">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-600">AI</span>
        </div>
        <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex items-start space-x-2 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-600' : 'bg-gray-300'
      }`}>
        <span className={`text-sm font-medium ${isUser ? 'text-white' : 'text-gray-600'}`}>
          {isUser ? 'U' : 'AI'}
        </span>
      </div>
      
      <div className={`relative max-w-md lg:max-w-lg ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-lg px-4 py-2 shadow-sm ${
          isUser 
            ? message.status === 'error' 
              ? 'bg-red-100 text-red-900'
              : 'bg-blue-600 text-white'
            : 'bg-white text-gray-900'
        }`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        
        <p className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isUser && message.status === 'sending' && ' • Sending...'}
          {isUser && message.status === 'error' && ' • Failed to send'}
        </p>
      </div>
    </div>
  );
}