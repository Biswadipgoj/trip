'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { isRemoteEnabled, remoteFetchTripBundle } from '@/lib/remote'

const SYNC_INTERVAL_MS = 15_000

/**
 * Keeps a trip's local data in sync with Supabase — BOTH directions:
 * pulls the full trip bundle on mount, on window focus, and every 15s, then
 * uploads anything the server is missing (including the trip itself, for
 * trips created before cloud sync). No-op in localStorage-only mode.
 */
export function useTripSync(tripId: string) {
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)
  const pushTripToRemote = useStore(s => s.pushTripToRemote)
  const syncing = useRef(false)

  useEffect(() => {
    if (!isRemoteEnabled() || !tripId) return

    let cancelled = false
    const sync = async () => {
      if (syncing.current) return
      syncing.current = true
      try {
        const bundle = await remoteFetchTripBundle(tripId)
        if (cancelled) return
        if (bundle) mergeRemoteTrip(bundle)
        // Upload local-only data; when the trip is missing remotely (bundle
        // null), this provisions the trip row first — healing old trips so
        // invites attach everyone to ONE shared trip.
        await pushTripToRemote(tripId, bundle)
      } catch (err) {
        console.warn('[sync] failed:', err)
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
  }, [tripId, mergeRemoteTrip, pushTripToRemote])
}
