'use client'
import React from 'react'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useHydrated } from '@/components/StoreProvider'
import { AppNav } from '@/components/shared/AppNav'

interface AppLayoutProps {
  children: React.ReactNode
  params: Promise<{ tripId: string }>
}

// This is a client component that wraps each trip sub-route
export default function AppLayout({ children, params }: AppLayoutProps) {
  const { tripId } = React.use(params)
  const router = useRouter()
  const session = useStore(s => s.session)
  const hydrated = useHydrated()

  useEffect(() => {
    // Only redirect after store has hydrated from localStorage
    // Prevents false redirects on first SSR paint
    if (hydrated && !session) {
      router.replace('/login')
    }
  }, [hydrated, session, router])

  // Show nothing until we know whether user is logged in
  if (!hydrated) return null
  if (!session) return null

  return (
    <div className="min-h-screen">
      <AppNav tripId={tripId} />

      {/* Content area - offset for nav */}
      <div className="lg:pl-64 pb-24 lg:pb-0">
        <div className="min-h-screen px-4 py-6 lg:px-8 lg:py-8 max-w-5xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
