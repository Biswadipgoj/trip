'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { isRemoteEnabled, remoteFetchTripBundle } from '@/lib/remote'

const SYNC_INTERVAL_MS = 15_000

/**
 * Keeps a trip's local data in sync with Supabase: pulls the full trip bundle
 * on mount, on window focus, and every 15s. No-op in localStorage-only mode.
 */
export function useTripSync(tripId: string) {
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)
  const syncing = useRef(false)

  useEffect(() => {
    if (!isRemoteEnabled() || !tripId) return

    let cancelled = false
    const sync = async () => {
      if (syncing.current) return
      syncing.current = true
      try {
        const bundle = await remoteFetchTripBundle(tripId)
        if (bundle && !cancelled) mergeRemoteTrip(bundle)
      } catch (err) {
        console.warn('[sync] pull failed:', err)
      } finally {
        syncing.current = false
      }
    }

    sync()
    const interval = setInterval(sync, SYNC_INTERVAL_MS)
    const onFocus = () => sync()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [tripId, mergeRemoteTrip])
}
