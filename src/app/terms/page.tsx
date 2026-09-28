import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'
import { TERMS_OF_SERVICE } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms for using TripMate on the web and Android: what the app does, your account and PIN, your content and acceptable use.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return <LegalPage doc={TERMS_OF_SERVICE} other={{ href: '/privacy', label: 'Privacy Policy' }} />
}
