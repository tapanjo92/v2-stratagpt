/**
 * Phase 2.2: Authentication UI Tests
 * 
 * Tests for authentication pages, forms, and flows
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import SignUpPage from '@/app/signup/page'
import SignInPage from '@/app/signin/page'
import ConfirmSignUpPage from '@/app/confirm-signup/page'
import ForgotPasswordPage from '@/app/forgot-password/page'
import ConfirmResetPasswordPage from '@/app/confirm-reset-password/page'
import DashboardPage from '@/app/dashboard/page'
import { useAuth } from '@/app/contexts/AuthContext'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock auth context
jest.mock('@/app/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock Amplify
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

describe('Phase 2.2: Authentication UI', () => {
  let mockPush: jest.Mock
  let mockAuth: any

  beforeEach(() => {
    mockPush = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })

    mockAuth = {
      user: null,
      loading: false,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      confirmSignUp: jest.fn(),
      confirmSignIn: jest.fn(),
      resendSignUpCode: jest.fn(),
      resetPassword: jest.fn(),
      confirmResetPassword: jest.fn(),
      getSession: jest.fn(),
      clearError: jest.fn(),
    }
    ;(useAuth as jest.Mock).mockReturnValue(mockAuth)

    // Clear sessionStorage
    sessionStorage.clear()
  })

  describe('Sign Up Page', () => {
    test('renders sign up form with all required fields', () => {
      render(<SignUpPage />)

      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Organization/Building Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Jurisdiction')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    test('validates form fields', async () => {
      const user = userEvent.setup()
      render(<SignUpPage />)

      const submitButton = screen.getByRole('button', { name: /create account/i })
      
      // Try to submit empty form
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument()
        expect(screen.getByText('Password is required')).toBeInTheDocument()
        expect(screen.getByText('Organization/Building name is required')).toBeInTheDocument()
        expect(screen.getByText('Jurisdiction is required')).toBeInTheDocument()
      })
    })

    test('validates password requirements', async () => {
      const user = userEvent.setup()
      render(<SignUpPage />)

      const passwordInput = screen.getByLabelText('Password')
      
      // Test short password
      await user.type(passwordInput, 'short')
      await user.tab()

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument()
      })
    })

    test('successfully submits sign up form', async () => {
      const user = userEvent.setup()
      mockAuth.signUp.mockResolvedValue({
        isSignUpComplete: false,
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      })

      render(<SignUpPage />)

      await user.type(screen.getByLabelText('Email Address'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPassword123!')
      await user.type(screen.getByLabelText('Confirm Password'), 'TestPassword123!')
      await user.type(screen.getByLabelText('Organization/Building Name'), 'Test Building')
      await user.selectOptions(screen.getByLabelText('Jurisdiction'), 'NSW')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockAuth.signUp).toHaveBeenCalledWith(
          'test@example.com',
          'TestPassword123!',
          {
            'custom:tenantId': 'Test Building',
            'custom:jurisdiction': 'NSW',
          }
        )
        expect(mockPush).toHaveBeenCalledWith('/confirm-signup')
      })
    })
  })

  describe('Confirm Sign Up Page', () => {
    test('renders confirmation code input', () => {
      sessionStorage.setItem('pendingSignUpEmail', 'test@example.com')
      render(<ConfirmSignUpPage />)

      expect(screen.getByText(/sent a verification code to/)).toBeInTheDocument()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
      expect(screen.getByLabelText('Verification Code')).toBeInTheDocument()
    })

    test('handles code confirmation', async () => {
      const user = userEvent.setup()
      sessionStorage.setItem('pendingSignUpEmail', 'test@example.com')
      mockAuth.confirmSignUp.mockResolvedValue({})

      render(<ConfirmSignUpPage />)

      await user.type(screen.getByLabelText('Verification Code'), '123456')
      await user.click(screen.getByRole('button', { name: /verify email/i }))

      await waitFor(() => {
        expect(mockAuth.confirmSignUp).toHaveBeenCalledWith('test@example.com', '123456')
        expect(mockPush).toHaveBeenCalledWith('/signin')
      })
    })

    test('handles resend code', async () => {
      const user = userEvent.setup()
      sessionStorage.setItem('pendingSignUpEmail', 'test@example.com')
      mockAuth.resendSignUpCode.mockResolvedValue({})

      render(<ConfirmSignUpPage />)

      await user.click(screen.getByText(/resend code/i))

      await waitFor(() => {
        expect(mockAuth.resendSignUpCode).toHaveBeenCalledWith('test@example.com')
        expect(screen.getByText(/resent successfully/i)).toBeInTheDocument()
      })
    })
  })

  describe('Sign In Page', () => {
    test('renders sign in form', () => {
      render(<SignInPage />)

      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
    })

    test('handles successful sign in', async () => {
      const user = userEvent.setup()
      mockAuth.signIn.mockResolvedValue({ isSignedIn: true })

      render(<SignInPage />)

      await user.type(screen.getByLabelText('Email Address'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPassword123!')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockAuth.signIn).toHaveBeenCalledWith('test@example.com', 'TestPassword123!')
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    test('handles MFA requirement', async () => {
      const user = userEvent.setup()
      mockAuth.signIn.mockRejectedValue(new Error('MFA_REQUIRED'))

      render(<SignInPage />)

      await user.type(screen.getByLabelText('Email Address'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPassword123!')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
        expect(screen.getByLabelText('Verification Code')).toBeInTheDocument()
      })
    })

    test('handles MFA code submission', async () => {
      const user = userEvent.setup()
      mockAuth.signIn.mockRejectedValue(new Error('MFA_REQUIRED'))
      mockAuth.confirmSignIn.mockResolvedValue({ isSignedIn: true })

      render(<SignInPage />)

      // First sign in
      await user.type(screen.getByLabelText('Email Address'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPassword123!')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      // Then enter MFA code
      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('Verification Code'), '123456')
      await user.click(screen.getByRole('button', { name: /verify/i }))

      await waitFor(() => {
        expect(mockAuth.confirmSignIn).toHaveBeenCalledWith('123456')
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Password Reset Flow', () => {
    test('forgot password page renders and submits', async () => {
      const user = userEvent.setup()
      mockAuth.resetPassword.mockResolvedValue({})

      render(<ForgotPasswordPage />)

      expect(screen.getByText('Reset Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()

      await user.type(screen.getByLabelText('Email Address'), 'test@example.com')
      await user.click(screen.getByRole('button', { name: /send reset code/i }))

      await waitFor(() => {
        expect(mockAuth.resetPassword).toHaveBeenCalledWith('test@example.com')
        expect(screen.getByText('Check Your Email')).toBeInTheDocument()
      })
    })

    test('confirm reset password page handles new password', async () => {
      const user = userEvent.setup()
      sessionStorage.setItem('resetPasswordEmail', 'test@example.com')
      mockAuth.confirmResetPassword.mockResolvedValue({})

      render(<ConfirmResetPasswordPage />)

      await user.type(screen.getByLabelText('Reset Code'), '123456')
      await user.type(screen.getByLabelText('New Password'), 'NewPassword123!')
      await user.type(screen.getByLabelText('Confirm New Password'), 'NewPassword123!')
      await user.click(screen.getByRole('button', { name: /reset password/i }))

      await waitFor(() => {
        expect(mockAuth.confirmResetPassword).toHaveBeenCalledWith(
          'test@example.com',
          '123456',
          'NewPassword123!'
        )
        expect(mockPush).toHaveBeenCalledWith('/signin')
      })
    })
  })

  describe('Dashboard Page', () => {
    test('redirects to sign in when not authenticated', () => {
      mockAuth.user = null
      mockAuth.loading = false

      render(<DashboardPage />)

      expect(mockPush).toHaveBeenCalledWith('/signin')
    })

    test('displays user information and credentials when authenticated', async () => {
      mockAuth.user = {
        username: 'test@example.com',
        userId: 'test-user-id',
      }
      mockAuth.loading = false

      // Mock fetchAuthSession
      const { fetchAuthSession } = require('aws-amplify/auth')
      fetchAuthSession.mockResolvedValue({
        identityId: 'test-identity-id',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'secret',
          sessionToken: 'token',
          expiration: new Date(Date.now() + 3600000),
        },
        tokens: {},
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
        expect(screen.getByText('test-user-id')).toBeInTheDocument()
      })
      
      // Check that credentials are displayed - the success message is already in the DOM
      expect(screen.getByText('✓ Successfully obtained AWS credentials via Identity Pool')).toBeInTheDocument()
      expect(screen.getByText('test-identity-id')).toBeInTheDocument()
    })

    test('handles sign out', async () => {
      const user = userEvent.setup()
      mockAuth.user = {
        username: 'test@example.com',
        userId: 'test-user-id',
      }
      mockAuth.loading = false
      mockAuth.signOut.mockResolvedValue({})

      render(<DashboardPage />)

      await user.click(screen.getByRole('button', { name: /sign out/i }))

      await waitFor(() => {
        expect(mockAuth.signOut).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })
  })
})

/**
 * Integration Test: Complete Authentication Flow
 */
describe('Integration: Authentication Flow', () => {
  let mockPush: jest.Mock
  let mockAuth: any

  beforeEach(() => {
    mockPush = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })

    mockAuth = {
      user: null,
      loading: false,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      confirmSignUp: jest.fn(),
      confirmSignIn: jest.fn(),
      resendSignUpCode: jest.fn(),
      resetPassword: jest.fn(),
      confirmResetPassword: jest.fn(),
      getSession: jest.fn(),
      clearError: jest.fn(),
    }
    ;(useAuth as jest.Mock).mockReturnValue(mockAuth)

    sessionStorage.clear()
  })

  test('Complete sign up → confirm → sign in flow', async () => {
    const user = userEvent.setup()

    // Step 1: Sign up
    mockAuth.signUp.mockResolvedValue({
      isSignUpComplete: false,
      nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
    })

    const { rerender } = render(<SignUpPage />)

    await user.type(screen.getByLabelText('Email Address'), 'newuser@example.com')
    await user.type(screen.getByLabelText('Password'), 'NewUserPass123!')
    await user.type(screen.getByLabelText('Confirm Password'), 'NewUserPass123!')
    await user.type(screen.getByLabelText('Organization/Building Name'), 'New Building')
    await user.selectOptions(screen.getByLabelText('Jurisdiction'), 'VIC')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(sessionStorage.getItem('pendingSignUpEmail')).toBe('newuser@example.com')
    })

    // Step 2: Confirm sign up
    mockAuth.confirmSignUp.mockResolvedValue({})
    rerender(<ConfirmSignUpPage />)

    await waitFor(() => {
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Verification Code'), '654321')
    await user.click(screen.getByRole('button', { name: /verify email/i }))

    await waitFor(() => {
      expect(sessionStorage.getItem('signUpSuccess')).toBe('true')
    })

    // Step 3: Sign in
    mockAuth.signIn.mockResolvedValue({ isSignedIn: true })
    rerender(<SignInPage />)

    await waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Email Address'), 'newuser@example.com')
    await user.type(screen.getByLabelText('Password'), 'NewUserPass123!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})

/**
 * Gate Check: Authentication UI Complete
 * 
 * This test suite ensures that:
 * 1. Sign up flow completes successfully with email confirmation
 * 2. Sign in works with MFA support
 * 3. Password reset functionality is implemented
 * 4. Dashboard shows AWS credentials from Identity Pool
 * 
 * All authentication UI components are working and integrated
 */