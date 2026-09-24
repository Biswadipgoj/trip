import type { Metadata } from 'next'
import { DownloadPageClient } from './DownloadPageClient'

export const metadata: Metadata = {
  title: 'TripMate Android App — Download Official APK',
  description:
    'Download the official TripMate Android application directly from Supabase Storage. Fast, offline-first group expense tracking with zero ads.',
  openGraph: {
    title: 'TripMate Android App — Direct Download',
    description: 'Get the official TripMate Android app with offline sync and receipt capture.',
    type: 'website',
  },
}

export default function DownloadPage() {
  return <DownloadPageClient />
}
