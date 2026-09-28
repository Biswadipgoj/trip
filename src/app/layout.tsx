import type { Metadata, Viewport } from 'next'
import './globals.css'
import { StoreProvider } from '@/components/StoreProvider'
import { BrandFooter } from '@/components/shared/BrandFooter'

import { SITE_URL } from '@/config/site'

const siteUrl = SITE_URL

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TripMate — Split Trips, Not Friendships | Group Travel Expense Tracker',
    template: '%s | TripMate',
  },
  description:
    'Split trip expenses with friends, not headaches. Track dinners, hotel stays, cabs & chai. Settle up on UPI with the least payments possible. Works 100% offline with auto cloud sync.',
  keywords: [
    'trip expense tracker',
    'split expenses with friends',
    'group travel expense manager',
    'UPI payment settlement',
    'offline split bill app',
    'splitwise alternative India',
    'trip cost sharing',
    'hotel room split calculator',
    'goa trip expense tracker',
    'group budget planner',
    'TripMate',
    'Biswodip Goj',
    'Hindi travel expense tracker',
    'Bengali trip split app',
  ],
  authors: [{ name: 'Biswodip Goj', url: 'https://biswadip.in' }],
  creator: 'Biswodip Goj',
  publisher: 'TripMate',
  applicationName: 'TripMate',
  category: 'Finance',
  classification: 'Travel & Expense Management',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon.png',
  },
  openGraph: {
    title: 'TripMate — Split Trips, Not Friendships',
    description:
      'Split trip expenses with friends, not headaches. Track dinners, hotel stays & cabs. Settle up on UPI with minimal payments. 100% offline-ready.',
    url: siteUrl,
    siteName: 'TripMate',
    locale: 'en_IN',
    type: 'website',
    // Image: src/app/opengraph-image.tsx (a real 1200x630 card).
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TripMate — Split Trips, Not Friendships',
    description:
      'Track group expenses, hotel rooms, and chai runs. Settle up with the fewest UPI transfers. Works 100% offline.',
    // Image: src/app/twitter-image.tsx
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Only the home page's canonical. Every other public page sets its own, so
  // no page tells Google it is a copy of the home page.
  alternates: {
    canonical: '/',
  },
  verification: {
    google: ['google6f2eafaea5be099a.html', 'google6f2eafaea5be099a'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#7c3aed',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#software`,
      name: 'TripMate',
      operatingSystem: 'Android, Web',
      applicationCategory: 'FinanceApplication',
      description:
        'Split trip expenses with friends, track hotel stays, and settle up with minimal UPI payments. Works 100% offline with zero data loss.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
      },
      featureList: [
        '100% Offline-First functionality',
        'Automatic background cloud sync',
        'Debt minimization algorithm (fewest UPI transfers)',
        '20 regional Indian languages supported',
        'Receipt photos & UPI payment proof attachments',
        'Hotel multi-room split calculations',
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'TripMate',
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      founder: {
        '@type': 'Person',
        name: 'Biswodip Goj',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'TripMate',
      description: 'Split trips, not friendships. Free offline group travel expense tracker.',
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    },
  ],
}

import { AndroidDownloadModal } from '@/components/download/AndroidDownloadModal'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { PWARegister } from '@/components/shared/PWARegister'
import { MotionPreferences } from '@/components/shared/MotionPreferences'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TripMate" />
        <meta name="geo.region" content="IN" />
        <meta name="geo.placename" content="India" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-surface-0 text-slate-900 antialiased">
        <PWARegister />
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
        <MotionPreferences>
        <StoreProvider>
          <OfflineBanner />
          <div className="relative z-10">
            {children}
            <BrandFooter />
            <AndroidDownloadModal />
          </div>
        </StoreProvider>
        </MotionPreferences>
      </body>
    </html>
  )
}
