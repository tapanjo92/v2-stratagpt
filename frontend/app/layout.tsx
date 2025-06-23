import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AmplifyProvider from '@/app/components/AmplifyProvider'
import { AuthProvider } from '@/app/contexts/AuthContext'
import Navigation from '@/app/components/Navigation'

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
              <Navigation />
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