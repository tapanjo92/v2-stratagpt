/**
 * Phase 2.2: Auth Context Tests
 * 
 * Tests for the authentication context and Amplify integration
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext'
import { Hub } from 'aws-amplify/utils'
import * as AuthModule from 'aws-amplify/auth'

// Mock Amplify auth module
jest.mock('aws-amplify/auth', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  confirmSignUp: jest.fn(),
  confirmSignIn: jest.fn(),
  resendSignUpCode: jest.fn(),
  resetPassword: jest.fn(),
  confirmResetPassword: jest.fn(),
  getCurrentUser: jest.fn(),
  fetchAuthSession: jest.fn(),
}))

// Mock Hub
jest.mock('aws-amplify/utils', () => ({
  Hub: {
    listen: jest.fn(),
  },
}))

describe('Phase 2.2: Auth Context', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock for getCurrentUser - no user signed in
    ;(AuthModule.getCurrentUser as jest.Mock).mockRejectedValue(new Error('No user'))
  })

  describe('Initial State', () => {
    test('initializes with no user and loading state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      // Initially loading
      expect(result.current.loading).toBe(true)
      expect(result.current.user).toBe(null)
      expect(result.current.error).toBe(null)

      // After checking user
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    test('loads existing user on mount', async () => {
      const mockUser = {
        username: 'existing@example.com',
        userId: 'existing-user-id',
        signInDetails: { loginId: 'existing@example.com' },
      }
      ;(AuthModule.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.user).toEqual({
          username: mockUser.username,
          userId: mockUser.userId,
          signInDetails: mockUser.signInDetails,
        })
      })
    })
  })

  describe('Sign Up', () => {
    test('handles successful sign up', async () => {
      const mockResult = {
        isSignUpComplete: false,
        userId: 'new-user-id',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      }
      ;(AuthModule.signUp as jest.Mock).mockResolvedValue(mockResult)

      const { result } = renderHook(() => useAuth(), { wrapper })

      let signUpResult: any
      await act(async () => {
        signUpResult = await result.current.signUp('new@example.com', 'Password123!', {
          'custom:tenantId': 'Building A',
        })
      })

      expect(AuthModule.signUp).toHaveBeenCalledWith({
        username: 'new@example.com',
        password: 'Password123!',
        options: {
          userAttributes: {
            email: 'new@example.com',
            'custom:tenantId': 'Building A',
          },
        },
      })
      expect(signUpResult).toEqual(mockResult)
      expect(result.current.error).toBe(null)
    })

    test('handles sign up error', async () => {
      const errorMessage = 'User already exists'
      ;(AuthModule.signUp as jest.Mock).mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await expect(
        result.current.signUp('existing@example.com', 'Password123!')
      ).rejects.toThrow(errorMessage)

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('Sign In', () => {
    test('handles successful sign in', async () => {
      const mockSignInResult = { isSignedIn: true, nextStep: {} }
      const mockUser = {
        username: 'user@example.com',
        userId: 'user-id',
      }
      ;(AuthModule.signIn as jest.Mock).mockResolvedValue(mockSignInResult)
      ;(AuthModule.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.signIn('user@example.com', 'Password123!')
      })

      expect(AuthModule.signIn).toHaveBeenCalledWith({
        username: 'user@example.com',
        password: 'Password123!',
      })
      
      await waitFor(() => {
        expect(result.current.user).toEqual({
          username: mockUser.username,
          userId: mockUser.userId,
        })
      })
    })

    test('handles MFA requirement', async () => {
      const mockSignInResult = {
        isSignedIn: false,
        nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_SMS_CODE' },
      }
      ;(AuthModule.signIn as jest.Mock).mockResolvedValue(mockSignInResult)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await expect(
        result.current.signIn('mfa@example.com', 'Password123!')
      ).rejects.toThrow('MFA_REQUIRED')
    })
  })

  describe('Sign Out', () => {
    test('handles sign out', async () => {
      ;(AuthModule.signOut as jest.Mock).mockResolvedValue({})

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Set initial user
      const mockUser = {
        username: 'user@example.com',
        userId: 'user-id',
      }
      ;(AuthModule.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      
      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.signOut()
      })

      expect(AuthModule.signOut).toHaveBeenCalled()
      expect(result.current.user).toBe(null)
    })
  })

  describe('Confirm Sign Up', () => {
    test('handles email confirmation', async () => {
      ;(AuthModule.confirmSignUp as jest.Mock).mockResolvedValue({
        isSignUpComplete: true,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.confirmSignUp('user@example.com', '123456')
      })

      expect(AuthModule.confirmSignUp).toHaveBeenCalledWith({
        username: 'user@example.com',
        confirmationCode: '123456',
      })
    })
  })

  describe('Password Reset', () => {
    test('initiates password reset', async () => {
      ;(AuthModule.resetPassword as jest.Mock).mockResolvedValue({
        nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.resetPassword('forgot@example.com')
      })

      expect(AuthModule.resetPassword).toHaveBeenCalledWith({
        username: 'forgot@example.com',
      })
    })

    test('confirms password reset', async () => {
      ;(AuthModule.confirmResetPassword as jest.Mock).mockResolvedValue({})

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.confirmResetPassword('user@example.com', '123456', 'NewPass123!')
      })

      expect(AuthModule.confirmResetPassword).toHaveBeenCalledWith({
        username: 'user@example.com',
        confirmationCode: '123456',
        newPassword: 'NewPass123!',
      })
    })
  })

  describe('Session Management', () => {
    test('fetches auth session', async () => {
      const mockSession = {
        tokens: { idToken: 'mock-id-token' },
        credentials: { accessKeyId: 'mock-access-key' },
        identityId: 'mock-identity-id',
      }
      ;(AuthModule.fetchAuthSession as jest.Mock).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useAuth(), { wrapper })

      let session: any
      await act(async () => {
        session = await result.current.getSession()
      })

      expect(AuthModule.fetchAuthSession).toHaveBeenCalled()
      expect(session).toEqual(mockSession)
    })
  })

  describe('Hub Integration', () => {
    test('listens for auth events', () => {
      renderHook(() => useAuth(), { wrapper })

      expect(Hub.listen).toHaveBeenCalledWith('auth', expect.any(Function))
    })

    test('handles signedIn event', async () => {
      const mockUser = {
        username: 'hub-user@example.com',
        userId: 'hub-user-id',
      }
      ;(AuthModule.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      let hubCallback: any
      ;(Hub.listen as jest.Mock).mockImplementation((channel, callback) => {
        hubCallback = callback
        return jest.fn() // unsubscribe function
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Simulate signedIn event
      act(() => {
        hubCallback({ payload: { event: 'signedIn' } })
      })

      await waitFor(() => {
        expect(result.current.user).toEqual({
          username: mockUser.username,
          userId: mockUser.userId,
        })
      })
    })

    test('handles signedOut event', async () => {
      let hubCallback: any
      ;(Hub.listen as jest.Mock).mockImplementation((channel, callback) => {
        hubCallback = callback
        return jest.fn()
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Simulate signedOut event
      act(() => {
        hubCallback({ payload: { event: 'signedOut' } })
      })

      expect(result.current.user).toBe(null)
    })

    test('handles tokenRefresh_failure event', async () => {
      let hubCallback: any
      ;(Hub.listen as jest.Mock).mockImplementation((channel, callback) => {
        hubCallback = callback
        return jest.fn()
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Simulate token refresh failure
      act(() => {
        hubCallback({ payload: { event: 'tokenRefresh_failure' } })
      })

      expect(result.current.error).toBe('Session expired. Please sign in again.')
      expect(result.current.user).toBe(null)
    })
  })

  describe('Error Handling', () => {
    test('clears error', async () => {
      ;(AuthModule.signIn as jest.Mock).mockRejectedValue(new Error('Invalid password'))

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Cause an error
      try {
        await act(async () => {
          await result.current.signIn('user@example.com', 'wrong')
        })
      } catch {}

      expect(result.current.error).toBe('Invalid password')

      // Clear error
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })
  })
})

/**
 * Gate Check: Auth Context Functionality
 * 
 * This test suite ensures that:
 * 1. Auth context properly integrates with AWS Amplify
 * 2. All authentication methods are properly exposed
 * 3. Hub events are handled for session management
 * 4. Error states are properly managed
 * 
 * The authentication context is ready for use throughout the application
 */