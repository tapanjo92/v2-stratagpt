'use client'

import { useEffect } from 'react'
import { configureAmplify } from '@/app/lib/amplify-config'

export default function AmplifyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    configureAmplify()
  }, [])

  return <>{children}</>
}