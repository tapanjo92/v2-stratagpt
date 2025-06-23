'use client';

import { useState, useEffect } from 'react';
import { dynamoDBService, UserProfile, ChatSession } from '@/app/lib/services/dynamodb-service';
import { startCredentialRefresh, stopCredentialRefresh } from '@/app/lib/aws-config';

export const dynamic = 'force-dynamic';

export default function TestDynamoDBPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    startCredentialRefresh();
    // Delay initial load to ensure authentication is complete
    const timer = setTimeout(() => {
      loadProfile();
    }, 1000);
    
    return () => {
      clearTimeout(timer);
      stopCredentialRefresh();
    };
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const userProfile = await dynamoDBService.getUserProfile();
      setProfile(userProfile);
      addTestResult(userProfile ? 'Profile loaded successfully' : 'No profile found');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      // Only log to test results if it's not an initial auth error
      if (!errorMessage.includes('No credentials available')) {
        addTestResult(`Error loading profile: ${err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const email = prompt('Enter email for profile:');
      if (!email) return;
      
      const newProfile = await dynamoDBService.createUserProfile(email);
      setProfile(newProfile);
      addTestResult('Profile created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
      addTestResult(`Error creating profile: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = {
        displayName: 'Test User',
        preferences: {
          theme: 'dark',
          language: 'en'
        }
      };
      
      await dynamoDBService.updateUserProfile(data);
      await loadProfile();
      addTestResult('Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      addTestResult(`Error updating profile: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const title = prompt('Enter session title:') || 'Test Session';
      
      const newSession = await dynamoDBService.createChatSession(title);
      await loadSessions();
      addTestResult(`Session created: ${newSession.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      addTestResult(`Error creating session: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const chatSessions = await dynamoDBService.getChatSessions();
      setSessions(chatSessions);
      addTestResult(`Loaded ${chatSessions.length} sessions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      addTestResult(`Error loading sessions: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const addMessage = async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      const content = prompt('Enter message:');
      if (!content) return;
      
      await dynamoDBService.addMessageToSession(sessionId, 'user', content);
      await dynamoDBService.addMessageToSession(sessionId, 'assistant', `Echo: ${content}`);
      await loadSessions();
      addTestResult(`Added messages to session ${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add message');
      addTestResult(`Error adding message: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      await dynamoDBService.deleteSession(sessionId);
      await loadSessions();
      addTestResult(`Deleted session ${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
      addTestResult(`Error deleting session: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">DynamoDB Integration Test</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">User Profile</h2>
          {profile ? (
            <div className="space-y-2">
              <p><strong>User ID:</strong> {profile.userId}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Created:</strong> {new Date(profile.createdAt).toLocaleString()}</p>
              <p><strong>Updated:</strong> {new Date(profile.updatedAt).toLocaleString()}</p>
              {profile.profileData && (
                <div>
                  <strong>Profile Data:</strong>
                  <pre className="bg-gray-100 p-2 rounded mt-1 text-sm">
                    {JSON.stringify(profile.profileData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No profile loaded</p>
          )}
          
          <div className="mt-4 space-x-2">
            <button
              onClick={createProfile}
              disabled={loading || !!profile}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Create Profile
            </button>
            <button
              onClick={updateProfile}
              disabled={loading || !profile}
              className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
            >
              Update Profile
            </button>
            <button
              onClick={loadProfile}
              disabled={loading}
              className="px-4 py-2 bg-gray-500 text-white rounded disabled:bg-gray-300"
            >
              Reload
            </button>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Chat Sessions</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.length > 0 ? (
              sessions.map(session => (
                <div key={session.sessionId} className="border rounded p-2">
                  <p className="font-medium">{session.title}</p>
                  <p className="text-sm text-gray-600">
                    Created: {new Date(session.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Messages: {session.messages?.length || 0}
                  </p>
                  <div className="mt-2 space-x-2">
                    <button
                      onClick={() => addMessage(session.sessionId)}
                      disabled={loading}
                      className="text-sm px-2 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
                    >
                      Add Message
                    </button>
                    <button
                      onClick={() => deleteSession(session.sessionId)}
                      disabled={loading}
                      className="text-sm px-2 py-1 bg-red-500 text-white rounded disabled:bg-gray-300"
                    >
                      Delete
                    </button>
                  </div>
                  {session.messages && session.messages.length > 0 && (
                    <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
                      {session.messages.slice(-2).map(msg => (
                        <div key={msg.messageId} className="mb-1">
                          <strong>{msg.role}:</strong> {msg.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500">No sessions found</p>
            )}
          </div>
          
          <div className="mt-4 space-x-2">
            <button
              onClick={createSession}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Create Session
            </button>
            <button
              onClick={loadSessions}
              disabled={loading}
              className="px-4 py-2 bg-gray-500 text-white rounded disabled:bg-gray-300"
            >
              Load Sessions
            </button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Test Results</h2>
        <div className="bg-gray-50 p-4 rounded h-48 overflow-y-auto">
          {testResults.length > 0 ? (
            testResults.map((result, index) => (
              <div key={index} className="text-sm mb-1">
                {result}
              </div>
            ))
          ) : (
            <p className="text-gray-500">No test results yet</p>
          )}
        </div>
      </div>
    </div>
  );
}