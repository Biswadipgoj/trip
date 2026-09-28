import type { Metadata } from 'next'
import { DownloadPageClient } from './DownloadPageClient'

export const metadata: Metadata = {
  title: { absolute: 'TripMate Android App — Free APK Download' },
  description:
    'Download the free TripMate Android app (APK) to split trip expenses with friends, snap bills and settle up on UPI. Works offline, no ads.',
  alternates: { canonical: '/download' },
  openGraph: {
    title: 'TripMate Android App — Direct Download',
    description: 'Get the official TripMate Android app with offline sync and receipt capture.',
    type: 'website',
  },
}

export default function DownloadPage() {
  return <DownloadPageClient />
}
