'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'

export default function SignInPage() {
  const router = useRouter()
  const { signIn, confirmSignIn, error, clearError } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaType, setMfaType] = useState<'SMS' | 'TOTP'>('SMS')
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    // Check for sign up success message
    if (sessionStorage.getItem('signUpSuccess') === 'true') {
      setShowSuccess(true)
      sessionStorage.removeItem('signUpSuccess')
      setTimeout(() => setShowSuccess(false), 5000)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      return
    }
    
    setLoading(true)
    clearError()
    
    try {
      await signIn(email, password)
      // If successful, redirect to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      if (err.message === 'MFA_REQUIRED') {
        setMfaRequired(true)
        // In a real app, you'd determine MFA type from the response
        setMfaType('SMS')
      }
      console.error('Sign in error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!mfaCode || mfaCode.length !== 6) {
      return
    }
    
    setLoading(true)
    clearError()
    
    try {
      await confirmSignIn(mfaCode)
      router.push('/dashboard')
    } catch (err) {
      console.error('MFA confirmation error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (mfaRequired) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">Two-Factor Authentication</h1>
          
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
            {mfaType === 'SMS' 
              ? 'Enter the 6-digit code sent to your registered phone number'
              : 'Enter the 6-digit code from your authenticator app'
            }
          </div>
          
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            <div>
              <label htmlFor="mfaCode" className="block text-sm font-medium mb-2">
                Verification Code
              </label>
              <input
                id="mfaCode"
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input text-center text-2xl tracking-wider"
                placeholder="000000"
                maxLength={6}
                autoComplete="off"
                autoFocus
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full btn btn-primary py-3"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
          
          <div className="text-center mt-6">
            <button
              onClick={() => {
                setMfaRequired(false)
                setMfaCode('')
                clearError()
              }}
              className="text-sm text-gray-600 hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Sign In</h1>
        
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            Account created successfully! You can now sign in.
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="********"
              autoComplete="current-password"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          
          {error && !mfaRequired && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-3"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  )
}