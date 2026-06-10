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
  themeColor: '#fbf7ec',
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
        {/* Aurora gradient blobs — vivid violet, mint and fuchsia over cream */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full opacity-40 blur-3xl"
            style={{ background: 'hsl(262, 90%, 82%)' }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full opacity-40 blur-3xl"
            style={{ background: 'hsl(168, 75%, 78%)' }}
          />
          <div
            className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full opacity-25 blur-3xl"
            style={{ background: 'hsl(310, 85%, 84%)' }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-20 blur-3xl"
            style={{ background: 'hsl(42, 95%, 80%)' }}
          />
        </div>
        <StoreProvider>
          <div className="relative z-10">{children}</div>
        </StoreProvider>
      </body>
    </html>
  )
}
