'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

export default function ConfirmSignUpPage() {
  const router = useRouter()
  const { confirmSignUp, resendSignUpCode, error, clearError } = useAuth()
  
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  useEffect(() => {
    // Get email from session storage
    const pendingEmail = sessionStorage.getItem('pendingSignUpEmail')
    if (pendingEmail) {
      setEmail(pendingEmail)
    } else {
      // If no pending email, redirect to sign up
      router.push('/signup')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!code || code.length !== 6) {
      return
    }
    
    setLoading(true)
    clearError()
    
    try {
      await confirmSignUp(email, code)
      
      // Clear session storage
      sessionStorage.removeItem('pendingSignUpEmail')
      
      // Redirect to sign in with success message
      sessionStorage.setItem('signUpSuccess', 'true')
      router.push('/signin')
    } catch (err) {
      console.error('Confirm sign up error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setResending(true)
    setResendSuccess(false)
    clearError()
    
    try {
      await resendSignUpCode(email)
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err) {
      console.error('Resend code error:', err)
    } finally {
      setResending(false)
    }
  }

  if (!email) {
    return null // Show nothing while checking for email
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Confirm Your Email</h1>
        
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
          We&apos;ve sent a verification code to <strong>{email}</strong>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-2">
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input text-center text-2xl tracking-wider"
              placeholder="000000"
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the 6-digit code sent to your email
            </p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {resendSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Verification code resent successfully!
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full btn btn-primary py-3"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Didn&apos;t receive the code?{' '}
            <button
              onClick={handleResendCode}
              disabled={resending}
              className="text-blue-600 hover:underline"
            >
              {resending ? 'Resending...' : 'Resend Code'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}