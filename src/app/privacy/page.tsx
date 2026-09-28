import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'
import { PRIVACY_POLICY } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What TripMate collects to split trip costs, why, who can see it and how to delete it. No ads, no tracking, never sold.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY_POLICY} other={{ href: '/terms', label: 'Terms of Service' }} />
}
