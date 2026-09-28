import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create a Trip — Free Group Expense Splitter',
  description: 'Start a trip in seconds: add friends, log dinners, cabs and hotel stays, and TripMate works out who owes whom. Free, no ads, works offline.',
  alternates: { canonical: '/create-trip' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
