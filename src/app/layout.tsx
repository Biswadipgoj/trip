import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TripSplit — Smart Group Expense Manager',
  description:
    'Split trip expenses effortlessly with friends. Track payments, settle debts with UPI, and close trips automatically when everyone is settled.',
  keywords: ['trip expense', 'split expenses', 'group travel', 'UPI payments', 'expense tracker'],
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  themeColor: '#0a0e1a',
  openGraph: {
    title: 'TripSplit — Smart Group Expense Manager',
    description: 'Split trip expenses effortlessly with friends.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head />
      <body className="min-h-screen bg-surface-0 text-white antialiased">
        {/* Background gradient blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'hsl(240, 78%, 58%)' }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15 blur-3xl"
            style={{ background: 'hsl(280, 78%, 55%)' }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl"
            style={{ background: 'hsl(195, 70%, 48%)' }}
          />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
