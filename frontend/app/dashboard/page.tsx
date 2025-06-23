'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { fetchAuthSession } from 'aws-amplify/auth'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const [credentials, setCredentials] = useState<any>(null)
  const [loadingCreds, setLoadingCreds] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    async function getCredentials() {
      if (user) {
        try {
          setLoadingCreds(true)
          const session = await fetchAuthSession()
          setCredentials({
            identityId: session.identityId,
            credentials: session.credentials,
            tokens: session.tokens,
          })
        } catch (err) {
          console.error('Failed to get credentials:', err)
        } finally {
          setLoadingCreds(false)
        }
      }
    }
    
    getCredentials()
  }, [user])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  if (loading || !user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="btn btn-secondary"
          >
            Sign Out
          </button>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-lg">{user.email || 'Loading...'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="text-sm font-mono bg-gray-100 p-2 rounded">{user.userId}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Cognito Username</dt>
              <dd className="text-xs font-mono text-gray-500">{user.username}</dd>
            </div>
          </dl>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">AWS Credentials Status</h2>
          {loadingCreds ? (
            <p>Loading credentials...</p>
          ) : credentials ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                ✓ Successfully obtained AWS credentials via Identity Pool
              </div>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Identity ID</dt>
                  <dd className="text-sm font-mono bg-gray-100 p-2 rounded break-all">
                    {credentials.identityId}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Access Key ID</dt>
                  <dd className="text-sm font-mono bg-gray-100 p-2 rounded">
                    {credentials.credentials?.accessKeyId?.substring(0, 10)}...
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Session Token</dt>
                  <dd className="text-sm font-mono bg-gray-100 p-2 rounded">
                    {credentials.credentials?.sessionToken ? 'Present' : 'Not available'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Expiration</dt>
                  <dd className="text-sm">
                    {credentials.credentials?.expiration 
                      ? new Date(credentials.credentials.expiration).toLocaleString()
                      : 'Not available'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Failed to obtain AWS credentials
            </div>
          )}
        </div>
        
      </div>
    </div>
  )
}