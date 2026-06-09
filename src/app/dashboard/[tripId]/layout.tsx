'use client'
import React from 'react';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { AppNav } from '@/components/shared/AppNav'

interface AppLayoutProps {
  children: React.ReactNode
  params: Promise<{ tripId: string }>
}

// This is a client component that wraps each trip sub-route
export default function AppLayout({ children, params }: AppLayoutProps) {
  const { tripId } = React.use(params);
  const router = useRouter()
  const session = useStore(s => s.session)

  useEffect(() => {
    if (!session) {
      router.replace('/login')
    }
  }, [session, router])

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
