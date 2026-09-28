import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join a Trip',
  description: 'Got a TripMate trip code or invite link? Join your group’s trip to add expenses and settle up on UPI.',
  alternates: { canonical: '/join-trip' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
