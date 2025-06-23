import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AmplifyProvider from '@/app/components/AmplifyProvider'
import { AuthProvider } from '@/app/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StrataGPT - AI-Powered Strata Law Assistant',
  description: 'Expert strata law guidance powered by AI and your documents',
  keywords: 'strata law, body corporate, AI assistant, legal documents',
  authors: [{ name: 'StrataGPT' }],
  robots: 'index, follow',
  openGraph: {
    title: 'StrataGPT - AI-Powered Strata Law Assistant',
    description: 'Expert strata law guidance powered by AI and your documents',
    type: 'website',
    locale: 'en_US',
    siteName: 'StrataGPT',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AmplifyProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <header className="bg-white shadow-sm border-b">
                <div className="container mx-auto px-4 py-4">
                  <nav className="flex justify-between items-center">
                    <div className="text-2xl font-bold text-gray-800">
                      StrataGPT
                    </div>
                    <div className="space-x-4">
                      <a href="/" className="text-gray-600 hover:text-gray-900">
                        Home
                      </a>
                      <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                        Dashboard
                      </a>
                      <a href="/signin" className="text-gray-600 hover:text-gray-900">
                        Sign In
                      </a>
                    </div>
                  </nav>
                </div>
              </header>
              <main className="flex-grow">
                {children}
              </main>
              <footer className="bg-gray-50 border-t">
                <div className="container mx-auto px-4 py-6 text-center text-gray-600">
                  <p>&copy; 2025 StrataGPT. All rights reserved.</p>
                </div>
              </footer>
            </div>
          </AuthProvider>
        </AmplifyProvider>
      </body>
    </html>
  )
}