// Cross-device sync — the web's useTripSync, hardened for phones:
//   flush the offline outbox → pull the trip → merge → push what the server
//   is missing → upload pending bill/UPI images.
// Runs when a trip opens, every 15 s while the app is in the foreground, on
// reconnect, and (debounced) whenever Supabase Realtime reports a change.
import { useEffect } from 'react'
import { AppState } from 'react-native'
import * as Network from 'expo-network'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useStore } from './store'
import { isRemoteEnabled, remoteFetchTripBundle, describeError } from './remote'
import { useSyncStatus, logSync } from './synclog'
import { processUploads } from './uploads'

const SYNC_INTERVAL_MS = 15_000
const RECONNECT_DELAY_MS = 700
const REALTIME_DELAY_MS = 450

// Tables with a trip_id column whose changes should refresh the open trip.
const TRIP_TABLES = ['expenses', 'hotel_expenses', 'settlements', 'members', 'settlement_groups', 'sponsorships'] as const

// ─── Network status (app-wide) ────────────────────────────────────────────────

const reconnectListeners = new Set<() => void>()
let networkStarted = false

function applyNetworkState(state: Network.NetworkState) {
  // isInternetReachable is null while unknown — only a definite "no" is offline.
  const online = state.isConnected !== false && state.isInternetReachable !== false
  const wasOnline = useSyncStatus.getState().online
  if (online === wasOnline) return
  useSyncStatus.getState().set({ online })
  logSync('info', online ? 'network.online' : 'network.offline')
  if (online) {
    reconnectListeners.forEach(fn => fn())
    void processUploads()
  }
}

/** Starts watching connectivity. Call once from the root layout. */
export function startNetworkMonitor() {
  if (networkStarted) return
  networkStarted = true
  useSyncStatus.getState().set({ remoteConfigured: isRemoteEnabled() })
  try {
    Network.getNetworkStateAsync().then(applyNetworkState).catch(() => {})
    Network.addNetworkStateListener(applyNetworkState)
  } catch {
    // No network module (e.g. an old dev client) — assume online.
  }
}

// ─── One sync pass ────────────────────────────────────────────────────────────

let running: Promise<void> | null = null
let queuedTripId: string | null = null

async function runSync(tripId: string) {
  const status = useSyncStatus.getState()
  if (!status.online) {
    status.markSync(false, 'You are offline — connect to internet to sync live trip')
    return
  }
  status.set({ syncing: true })
  try {
    await useStore.getState().flushOutbox(tripId)
    const bundle = await remoteFetchTripBundle(tripId)
    if (bundle) {
      if (bundle.mediaTableMissing) useSyncStatus.getState().set({ mediaReady: false })
      useStore.getState().mergeRemoteTrip(bundle)
    }
    // Uploads local-only data. When the pull came back empty because the trip
    // isn't on the server yet, this provisions it first.
    await useStore.getState().pushTripToRemote(tripId, bundle)
    useSyncStatus.getState().markSync(!!bundle, bundle ? undefined : 'Trip not on the server yet — uploading it')
  } catch (err) {
    useSyncStatus.getState().markSync(false, describeError(err))
  } finally {
    useSyncStatus.getState().set({ syncing: false })
  }
  void processUploads()
}

/** Syncs one trip now. Single-flight: a call made during a running pass
 *  queues one follow-up pass (the latest trip id wins). */
export function syncTrip(tripId: string | undefined): Promise<void> {
  if (!tripId || !isRemoteEnabled()) return Promise.resolve()
  if (running) {
    queuedTripId = tripId
    return running
  }
  running = runSync(tripId).finally(() => {
    running = null
    const next = queuedTripId
    queuedTripId = null
    if (next) void syncTrip(next)
  })
  return running
}

// ─── Hook: keep the open trip in sync ────────────────────────────────────────

export function useTripSync(tripId: string | undefined) {
  useEffect(() => {
    if (!tripId || !isRemoteEnabled() || !supabase) return
    const client = supabase

    let interval: ReturnType<typeof setInterval> | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let channels: RealtimeChannel[] = []

    const run = () => void syncTrip(tripId)
    const runSoon = (ms: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(run, ms)
    }

    const subscribe = () => {
      if (channels.length > 0) return
      try {
        const main = client.channel(`trip:${tripId}`)
        TRIP_TABLES.forEach(table =>
          main.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` },
            () => runSoon(REALTIME_DELAY_MS))
        )
        main.on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
          () => runSoon(REALTIME_DELAY_MS))
        main.subscribe()
        // Separate channel: the attachments table only exists once the mobile
        // migration is installed, and a failing binding must not break the rest.
        const media = client
          .channel(`trip-media:${tripId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments', filter: `trip_id=eq.${tripId}` },
            () => runSoon(REALTIME_DELAY_MS))
          .subscribe()
        channels = [main, media]
      } catch (err) {
        logSync('error', 'realtime.subscribe', describeError(err))
      }
    }
    const unsubscribe = () => {
      channels.forEach(c => { void client.removeChannel(c) })
      channels = []
    }

    const start = () => {
      run()
      if (!interval) interval = setInterval(run, SYNC_INTERVAL_MS)
      subscribe()
    }
    const stop = () => {
      if (interval) clearInterval(interval)
      interval = null
      unsubscribe()
    }

    if (AppState.currentState !== 'background') start()
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') start()
      else if (state === 'background') stop()
    })
    const onReconnect = () => runSoon(RECONNECT_DELAY_MS)
    reconnectListeners.add(onReconnect)

    return () => {
      stop()
      if (timer) clearTimeout(timer)
      appSub.remove()
      reconnectListeners.delete(onReconnect)
    }
  }, [tripId])
}
