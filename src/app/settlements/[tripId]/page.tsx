'use client'
import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SettlementsPageProps {
  params: Promise<{ tripId: string }>
}

// Settlements now live in the Payments module (settlement transactions only).
// This route is kept so old links keep working.
export default function SettlementsPage({ params }: SettlementsPageProps) {
  const { tripId } = React.use(params)
  const router = useRouter()

  useEffect(() => {
    router.replace(`/payments/${tripId}`)
  }, [router, tripId])

  return null
}
