'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { 
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp as amplifyConfirmSignUp,
  confirmSignIn as amplifyConfirmSignIn,
  resendSignUpCode as amplifyResendSignUpCode,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  type SignInInput,
  type SignUpInput,
  type ConfirmSignUpInput,
  type ConfirmSignInInput,
  type ResetPasswordInput,
  type ConfirmResetPasswordInput,
} from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'

interface User {
  username: string
  userId: string
  email?: string
  signInDetails?: {
    loginId?: string
    authFlowType?: string
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  signIn: (username: string, password: string) => Promise<void>
  signUp: (email: string, password: string, attributes?: Record<string, string>) => Promise<{ isSignUpComplete: boolean; userId?: string; nextStep: any }>
  signOut: () => Promise<void>
  confirmSignUp: (username: string, code: string) => Promise<void>
  confirmSignIn: (code: string) => Promise<void>
  resendSignUpCode: (username: string) => Promise<void>
  resetPassword: (username: string) => Promise<void>
  confirmResetPassword: (username: string, code: string, newPassword: string) => Promise<void>
  getSession: () => Promise<any>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
    
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkUser()
          break
        case 'signedOut':
          setUser(null)
          break
        case 'tokenRefresh':
          checkUser()
          break
        case 'tokenRefresh_failure':
          setError('Session expired. Please sign in again.')
          setUser(null)
          break
      }
    })

    return unsubscribe
  }, [])

  async function checkUser() {
    try {
      setLoading(true)
      const currentUser = await getCurrentUser()
      
      // Get the user's email from signInDetails or fetch user attributes
      let email = currentUser.signInDetails?.loginId
      
      // If email not in signInDetails, fetch from user attributes
      if (!email) {
        try {
          const session = await fetchAuthSession()
          const idToken = session.tokens?.idToken
          if (idToken && idToken.payload && idToken.payload.email) {
            email = idToken.payload.email as string
          }
        } catch (err) {
          console.error('Failed to get email from token:', err)
        }
      }
      
      setUser({
        username: currentUser.username,
        userId: currentUser.userId,
        email: email,
        signInDetails: currentUser.signInDetails,
      })
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(username: string, password: string) {
    try {
      setError(null)
      const result = await amplifySignIn({ username, password } as SignInInput)
      
      if (result.isSignedIn) {
        await checkUser()
      } else if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE' || 
                 result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        // MFA required - will handle in the component
        throw new Error('MFA_REQUIRED')
      }
    } catch (err: any) {
      if (err.message === 'MFA_REQUIRED') {
        throw err
      }
      setError(err.message || 'Failed to sign in')
      throw err
    }
  }

  async function signUp(email: string, password: string, attributes?: Record<string, string>) {
    try {
      setError(null)
      const result = await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...attributes,
          },
        },
      } as SignUpInput)
      
      return result
    } catch (err: any) {
      setError(err.message || 'Failed to sign up')
      throw err
    }
  }

  async function signOut() {
    try {
      setError(null)
      await amplifySignOut()
      setUser(null)
    } catch (err: any) {
      setError(err.message || 'Failed to sign out')
      throw err
    }
  }

  async function confirmSignUp(username: string, code: string) {
    try {
      setError(null)
      await amplifyConfirmSignUp({ username, confirmationCode: code } as ConfirmSignUpInput)
    } catch (err: any) {
      setError(err.message || 'Failed to confirm sign up')
      throw err
    }
  }

  async function confirmSignIn(code: string) {
    try {
      setError(null)
      const result = await amplifyConfirmSignIn({ challengeResponse: code } as ConfirmSignInInput)
      
      if (result.isSignedIn) {
        await checkUser()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm sign in')
      throw err
    }
  }

  async function resendSignUpCode(username: string) {
    try {
      setError(null)
      await amplifyResendSignUpCode({ username })
    } catch (err: any) {
      setError(err.message || 'Failed to resend code')
      throw err
    }
  }

  async function resetPassword(username: string) {
    try {
      setError(null)
      await amplifyResetPassword({ username } as ResetPasswordInput)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
      throw err
    }
  }

  async function confirmResetPassword(username: string, code: string, newPassword: string) {
    try {
      setError(null)
      await amplifyConfirmResetPassword({ 
        username, 
        confirmationCode: code, 
        newPassword 
      } as ConfirmResetPasswordInput)
    } catch (err: any) {
      setError(err.message || 'Failed to confirm password reset')
      throw err
    }
  }

  async function getSession() {
    try {
      const session = await fetchAuthSession()
      return session
    } catch (err: any) {
      setError(err.message || 'Failed to get session')
      throw err
    }
  }

  function clearError() {
    setError(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    confirmSignUp,
    confirmSignIn,
    resendSignUpCode,
    resetPassword,
    confirmResetPassword,
    getSession,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}