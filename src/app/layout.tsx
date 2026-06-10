import type { Metadata, Viewport } from 'next'
import './globals.css'
import { StoreProvider } from '@/components/StoreProvider'

export const metadata: Metadata = {
  title: 'TripSplit — Smart Group Expense Manager',
  description:
    'Split trip expenses effortlessly with friends. Track payments, settle debts with UPI, and close trips automatically when everyone is settled.',
  keywords: ['trip expense', 'split expenses', 'group travel', 'UPI payments', 'expense tracker'],
  openGraph: {
    title: 'TripSplit — Smart Group Expense Manager',
    description: 'Split trip expenses effortlessly with friends.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f3ea',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-surface-0 text-white antialiased">
        {/* Background gradient blobs — soft purple + mint over beige */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-25 blur-3xl"
            style={{ background: 'hsl(258, 75%, 84%)' }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-25 blur-3xl"
            style={{ background: 'hsl(160, 55%, 80%)' }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-15 blur-3xl"
            style={{ background: 'hsl(40, 70%, 85%)' }}
          />
        </div>
        <StoreProvider>
          <div className="relative z-10">{children}</div>
        </StoreProvider>
      </body>
    </html>
  )
}
