'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

export default function ConfirmResetPasswordPage() {
  const router = useRouter()
  const { confirmResetPassword, error, clearError } = useAuth()
  
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // Get email from session storage
    const resetEmail = sessionStorage.getItem('resetPasswordEmail')
    if (resetEmail) {
      setEmail(resetEmail)
    } else {
      // If no email, redirect to forgot password
      router.push('/forgot-password')
    }
  }, [router])

  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!code || code.length !== 6) {
      errors.code = 'Please enter the 6-digit code'
    }
    
    if (!newPassword) {
      errors.newPassword = 'Password is required'
    } else if (newPassword.length < 12) {
      errors.newPassword = 'Password must be at least 12 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(newPassword)) {
      errors.newPassword = 'Password must contain uppercase, lowercase, number, and special character'
    }
    
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    clearError()
    
    try {
      await confirmResetPassword(email, code, newPassword)
      
      // Clear session storage
      sessionStorage.removeItem('resetPasswordEmail')
      
      // Show success and redirect to sign in
      sessionStorage.setItem('passwordResetSuccess', 'true')
      router.push('/signin')
    } catch (err) {
      console.error('Confirm reset password error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return null // Show nothing while checking for email
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Reset Your Password</h1>
        
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
          Enter the code sent to <strong>{email}</strong> and choose a new password
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-2">
              Reset Code
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
            {validationErrors.code && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.code}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="********"
              autoComplete="new-password"
            />
            {validationErrors.newPassword && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.newPassword}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 12 characters with uppercase, lowercase, number, and special character
            </p>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="********"
              autoComplete="new-password"
            />
            {validationErrors.confirmPassword && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.confirmPassword}</p>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-3"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}