/**
 * Phase 2.1: Application Rendering Tests
 * 
 * Tests that verify the Next.js application can render properly
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'
import RootLayout from '@/app/layout'

// Mock the AmplifyProvider to avoid Amplify initialization in tests
jest.mock('@/app/components/AmplifyProvider', () => {
  return function MockAmplifyProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
})

describe('Phase 2.1: Application Rendering', () => {
  describe('Home Page', () => {
    test('Can render home page without errors', () => {
      expect(() => {
        render(<HomePage />)
      }).not.toThrow()
    })

    test('Home page displays welcome message', () => {
      render(<HomePage />)
      
      expect(screen.getByText('Welcome to StrataGPT')).toBeInTheDocument()
      expect(screen.getByText(/Your AI-powered assistant/)).toBeInTheDocument()
    })

    test('Home page contains navigation links', () => {
      render(<HomePage />)
      
      expect(screen.getByText('Get Started')).toBeInTheDocument()
      expect(screen.getByText('Sign In')).toBeInTheDocument()
    })

    test('Home page displays feature cards', () => {
      render(<HomePage />)
      
      expect(screen.getByText('Upload Documents')).toBeInTheDocument()
      expect(screen.getByText('Ask Questions')).toBeInTheDocument()
      expect(screen.getByText('Expert Guidance')).toBeInTheDocument()
    })
  })

  describe('Root Layout', () => {
    test('Root layout renders with children', () => {
      const TestChild = () => <div>Test Content</div>
      
      render(
        <RootLayout>
          <TestChild />
        </RootLayout>
      )
      
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    test('Layout includes header navigation', () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      )
      
      // Check header elements
      expect(screen.getByText('StrataGPT')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      
      // Check that Sign In link exists
      const signInLinks = screen.getAllByText('Sign In')
      expect(signInLinks.length).toBeGreaterThan(0)
    })

    test('Layout includes footer', () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      )
      
      expect(screen.getByText(/© 2025 StrataGPT/)).toBeInTheDocument()
    })
  })

  describe('CSS Classes', () => {
    test('Required CSS classes are applied', () => {
      const { container } = render(<HomePage />)
      
      // Check for container classes
      expect(container.querySelector('.container')).toBeInTheDocument()
      expect(container.querySelector('.btn')).toBeInTheDocument()
      expect(container.querySelector('.btn-primary')).toBeInTheDocument()
      expect(container.querySelector('.btn-secondary')).toBeInTheDocument()
    })
  })
})