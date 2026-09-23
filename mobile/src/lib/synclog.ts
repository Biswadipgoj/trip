// Sync diagnostics (port of the web's src/lib/synclog.ts). Every remote
// operation reports here — including errors that are intentionally swallowed
// so the UI never blocks — and the trip top bar shows the live status.
import { create } from 'zustand'

export interface SyncEvent {
  at: string
  level: 'info' | 'error'
  tag: string
  detail?: string
}

interface SyncStatusState {
  remoteConfigured: boolean
  syncing: boolean
  online: boolean
  lastSyncAt: string | null
  lastSyncOk: boolean | null
  lastError: string | null
  /** Whether bill/UPI screenshot storage is set up on the server
   *  (null = not checked yet). */
  mediaReady: boolean | null
  events: SyncEvent[]
  log: (level: 'info' | 'error', tag: string, detail?: string) => void
  markSync: (ok: boolean, error?: string) => void
  set: (patch: Partial<Pick<SyncStatusState, 'remoteConfigured' | 'syncing' | 'online' | 'mediaReady'>>) => void
}

const MAX_EVENTS = 80

export const useSyncStatus = create<SyncStatusState>()(set => ({
  remoteConfigured: false,
  syncing: false,
  online: true,
  lastSyncAt: null,
  lastSyncOk: null,
  lastError: null,
  mediaReady: null,
  events: [],

  log: (level, tag, detail) =>
    set(s => ({
      events: [{ at: new Date().toISOString(), level, tag, detail }, ...s.events].slice(0, MAX_EVENTS),
      ...(level === 'error' ? { lastError: `${tag}${detail ? `: ${detail}` : ''}` } : {}),
    })),

  markSync: (ok, error) =>
    set(s => ({
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: ok,
      lastError: ok ? null : (error ?? s.lastError),
    })),

  set: patch => set(patch),
}))

/** Safe to call from non-React modules (remote.ts, store.ts). */
export function logSync(level: 'info' | 'error', tag: string, detail?: string) {
  try {
    if (level === 'error') console.warn(`[sync] ${tag}`, detail ?? '')
    useSyncStatus.getState().log(level, tag, detail)
  } catch {
    /* never let diagnostics break the app */
  }
}
