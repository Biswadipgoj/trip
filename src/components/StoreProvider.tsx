'use client'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { authSession } from '@/lib/authClient'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Trigger rehydration from localStorage.
    // The `onRehydrateStorage` callback in the store config will set `hydrated: true`
    // once the data has been loaded — ensuring layout guards don't redirect prematurely.
    Promise.resolve(useStore.persist.rehydrate())
      .then(syncSessionWithServer)
      .finally(() => useStore.getState().setAuthChecked(true))
  }, [])
  return <>{children}</>
}

/**
 * Returns true once Zustand has loaded data from localStorage AND the server
 * has said who is logged in. Use this in protected layouts to avoid false
 * redirects on first render.
 */
export function useHydrated(): boolean {
  return useStore(s => s.hydrated && s.authChecked)
}

const TRIP_PATH = /^\/(?:dashboard|expenses|members|payments|settlements|report)\/([0-9a-f-]{36})/i

/**
 * The server (httpOnly cookie) decides who is logged in. The locally
 * remembered trip is only a hint for offline use:
 * - the server says this browser isn't a member of it → drop it;
 * - there is no hint but the server has a session for the trip in the URL
 *   (browser storage cleared, or logged in from another tab) → adopt it.
 */
async function syncSessionWithServer() {
  const res = await Promise.race([
    authSession(),
    new Promise<Awaited<ReturnType<typeof authSession>>>(resolve =>
      setTimeout(() => resolve({ ok: false, status: 0, error: 'timeout' }), 5000)),
  ])
  if (!res.ok && (res.status === 0 || res.status === 503)) return // offline, slow, or auth not configured
  const { session, setSession } = useStore.getState()
  const memberships = res.ok ? res.data.memberships : []

  if (session && memberships.some(m => m.tripId === session.tripId && m.memberId === session.memberId)) return

  const urlTrip = window.location.pathname.match(TRIP_PATH)?.[1]
  const adopt = memberships.find(m => m.tripId === urlTrip) ?? null
  setSession(adopt)
}
