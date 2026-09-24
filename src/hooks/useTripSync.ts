'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { isRemoteEnabled, remoteFetchTripBundle } from '@/lib/remote'
import { useSyncStatus } from '@/lib/synclog'

// 5 minutes interval for background sync as requested by user
const SYNC_INTERVAL_MS = 5 * 60 * 1000

function computeBundleSignature(bundle: any): string {
  if (!bundle) return ''
  const t = bundle.trip ? `${bundle.trip.id}:${bundle.trip.status}:${bundle.trip.name}:${bundle.trip.budget || ''}` : ''
  const m = (bundle.members || []).map((x: any) => `${x.id}:${x.name}:${x.upiId || ''}`).join(';')
  const e = (bundle.expenses || []).map((x: any) => `${x.id}:${x.amount}:${x.paidBy}:${x.category}`).join(';')
  const h = (bundle.hotelExpenses || []).map((x: any) => `${x.id}:${x.totalAmount}`).join(';')
  const s = (bundle.settlementStatuses || []).map((x: any) => `${x.id}:${x.status}:${x.amount}`).join(';')
  const g = (bundle.settlementGroups || []).map((x: any) => x.id).join(';')
  const sp = (bundle.sponsorships || []).map((x: any) => x.id).join(';')
  const a = (bundle.attachments || []).map((x: any) => x.id).join(';')
  return `${t}#${m}#${e}#${h}#${s}#${g}#${sp}#${a}`
}

/**
 * Keeps a trip's local data in sync with Supabase:
 * pulls the full trip bundle on initial mount and every 5 minutes in the background.
 * Uses bundle signature comparison to avoid freezing the UI when data is unchanged.
 */
export function useTripSync(tripId: string) {
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)
  const pushTripToRemote = useStore(s => s.pushTripToRemote)
  const syncing = useRef(false)
  const lastSignature = useRef<string>('')
  const lastSyncTime = useRef<number>(0)

  useEffect(() => {
    useSyncStatus.getState().setRemoteConfigured(isRemoteEnabled())
    if (!isRemoteEnabled() || !tripId) return

    let cancelled = false
    const sync = async () => {
      if (syncing.current) return
      syncing.current = true
      lastSyncTime.current = Date.now()

      try {
        const bundle = await remoteFetchTripBundle(tripId)
        if (cancelled) return

        if (bundle) {
          const sig = computeBundleSignature(bundle)
          // Only trigger state updates and debt re-generation if remote data actually changed
          if (sig !== lastSignature.current) {
            lastSignature.current = sig
            mergeRemoteTrip(bundle)
          }
        }

        // Upload local-only data if needed
        await pushTripToRemote(tripId, bundle)
        useSyncStatus.getState().markSync(!!bundle, bundle ? undefined : 'Trip not on server yet — uploading')
      } catch (err) {
        console.warn('[sync] failed:', err)
        useSyncStatus.getState().markSync(false, err instanceof Error ? err.message : String(err))
      } finally {
        syncing.current = false
      }
    }

    // Initial sync
    sync()

    // 5-minute interval
    const interval = setInterval(sync, SYNC_INTERVAL_MS)

    // Debounced window focus sync (minimum 60s since last sync)
    const onFocus = () => {
      if (Date.now() - lastSyncTime.current > 60_000) {
        sync()
      }
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [tripId, mergeRemoteTrip, pushTripToRemote])
}
