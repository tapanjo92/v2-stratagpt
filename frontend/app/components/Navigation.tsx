'use client'

import React from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

export default function Navigation() {
  const { user, loading, signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex justify-between items-center">
          <div className="text-2xl font-bold text-gray-800">
            StrataGPT
          </div>
          <div className="flex items-center space-x-4">
            <a href="/" className="text-gray-600 hover:text-gray-900">
              Home
            </a>
            {user ? (
              <>
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </a>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700">
                    {user.email || user.username}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1 rounded"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              !loading && (
                <a href="/signin" className="text-gray-600 hover:text-gray-900">
                  Sign In
                </a>
              )
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}