'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'

export default function SignUpPage() {
  const router = useRouter()
  const { signUp, error, clearError } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!givenName) {
      errors.givenName = 'First name is required'
    }
    
    if (!familyName) {
      errors.familyName = 'Last name is required'
    }
    
    if (!email) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Email is invalid'
    }
    
    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 12) {
      errors.password = 'Password must be at least 12 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(password)) {
      errors.password = 'Password must contain uppercase, lowercase, number, and special character'
    }
    
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
    
    if (!tenantId) {
      errors.tenantId = 'Organization/Building name is required'
    }
    
    if (!jurisdiction) {
      errors.jurisdiction = 'Jurisdiction is required'
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
      const result = await signUp(email, password, {
        given_name: givenName,
        family_name: familyName,
        'custom:tenantId': tenantId,
        'custom:jurisdiction': jurisdiction,
      })
      
      // Store email for confirmation page
      sessionStorage.setItem('pendingSignUpEmail', email)
      
      if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        router.push('/confirm-signup')
      }
    } catch (err) {
      console.error('Sign up error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Create Account</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="givenName" className="block text-sm font-medium mb-2">
                First Name
              </label>
              <input
                id="givenName"
                type="text"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                className="input"
                placeholder="John"
                autoComplete="given-name"
              />
              {validationErrors.givenName && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.givenName}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="familyName" className="block text-sm font-medium mb-2">
                Last Name
              </label>
              <input
                id="familyName"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="input"
                placeholder="Doe"
                autoComplete="family-name"
              />
              {validationErrors.familyName && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.familyName}</p>
              )}
            </div>
          </div>
          
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
            />
            {validationErrors.email && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.email}</p>
            )}
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
              autoComplete="new-password"
            />
            {validationErrors.password && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.password}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 12 characters with uppercase, lowercase, number, and special character
            </p>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              Confirm Password
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
          
          <div>
            <label htmlFor="tenantId" className="block text-sm font-medium mb-2">
              Organization/Building Name
            </label>
            <input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="input"
              placeholder="Sunset Towers"
            />
            {validationErrors.tenantId && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.tenantId}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="jurisdiction" className="block text-sm font-medium mb-2">
              Jurisdiction
            </label>
            <select
              id="jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="input"
            >
              <option value="">Select jurisdiction</option>
              <option value="NSW">New South Wales</option>
              <option value="VIC">Victoria</option>
              <option value="QLD">Queensland</option>
              <option value="WA">Western Australia</option>
              <option value="SA">South Australia</option>
              <option value="TAS">Tasmania</option>
              <option value="ACT">Australian Capital Territory</option>
              <option value="NT">Northern Territory</option>
            </select>
            {validationErrors.jurisdiction && (
              <p className="text-sm text-red-500 mt-1">{validationErrors.jurisdiction}</p>
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm">
          Already have an account?{' '}
          <Link href="/signin" className="text-blue-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}