'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { resetPassword, error, clearError } = useAuth()
  
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      return
    }
    
    setLoading(true)
    clearError()
    
    try {
      await resetPassword(email)
      setSubmitted(true)
      
      // Store email for reset confirmation page
      sessionStorage.setItem('resetPasswordEmail', email)
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push('/confirm-reset-password')
      }, 3000)
    } catch (err) {
      console.error('Reset password error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">Check Your Email</h1>
          
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            <p>We&apos;ve sent a password reset code to <strong>{email}</strong></p>
            <p className="mt-2">Please check your email and follow the instructions.</p>
          </div>
          
          <p className="text-center text-sm text-gray-600">
            Redirecting to confirmation page...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Reset Password</h1>
        
        <p className="text-center text-gray-600 mb-8">
          Enter your email address and we&apos;ll send you a code to reset your password.
        </p>
        
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
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full btn btn-primary py-3"
          >
            {loading ? 'Sending...' : 'Send Reset Code'}
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm">
          Remember your password?{' '}
          <Link href="/signin" className="text-blue-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}