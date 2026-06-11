'use client'

import { create } from 'zustand'

// ──────────────────────────────────────────────────────────────────────────────
// SYNC DIAGNOSTICS
// Every remote operation reports here — including errors that are intentionally
// swallowed so the UX never blocks. The Sync Doctor page (/debug) and the
// AppNav status pill read from this store, turning invisible production
// failures (bad env vars, missing tables, RLS errors) into visible ones.
// ──────────────────────────────────────────────────────────────────────────────

export interface SyncEvent {
  at: string
  level: 'info' | 'error'
  tag: string
  detail?: string
}

interface SyncStatusState {
  remoteConfigured: boolean
  lastSyncAt: string | null
  lastSyncOk: boolean | null
  lastError: string | null
  events: SyncEvent[]
  log: (level: 'info' | 'error', tag: string, detail?: string) => void
  markSync: (ok: boolean, error?: string) => void
  setRemoteConfigured: (v: boolean) => void
}

const MAX_EVENTS = 80

export const useSyncStatus = create<SyncStatusState>()((set) => ({
  remoteConfigured: false,
  lastSyncAt: null,
  lastSyncOk: null,
  lastError: null,
  events: [],

  log: (level, tag, detail) =>
    set(s => ({
      events: [
        { at: new Date().toISOString(), level, tag, detail },
        ...s.events,
      ].slice(0, MAX_EVENTS),
      ...(level === 'error' ? { lastError: `${tag}${detail ? `: ${detail}` : ''}` } : {}),
    })),

  markSync: (ok, error) =>
    set(s => ({
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: ok,
      lastError: ok ? null : (error ?? s.lastError),
    })),

  setRemoteConfigured: (v) => set({ remoteConfigured: v }),
}))

/** Safe to call from non-React modules (remote.ts, store.ts). */
export function logSync(level: 'info' | 'error', tag: string, detail?: string) {
  try {
    useSyncStatus.getState().log(level, tag, detail)
  } catch {
    /* never let diagnostics break the app */
  }
}
