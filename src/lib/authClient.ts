// Browser-side calls to /api/auth/*. Tokens live only in httpOnly cookies the
// browser sends automatically; this code never sees or stores them.

import type { TripChoice } from '@/lib/tripLogin'
import type { TripSession } from '@/types'

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

const OFFLINE = 'You appear to be offline. Connect to the internet to log in.'

async function call<T>(path: string, init?: RequestInit): Promise<AuthResult<T>> {
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    return { ok: false, status: 0, error: OFFLINE }
  }
  const body = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, data: body as T }
  return { ok: false, status: res.status, error: body?.error || 'Something went wrong. Try again.' }
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const authLookupTrips = (mobile: string) =>
  post<{ trips: TripChoice[] }>('/api/auth/lookup', { mobile })

export const authLogin = (memberId: string, pin: string) =>
  post<{ session: TripSession; memberships: TripSession[] }>('/api/auth/login', { memberId, pin })

export const authSession = () => call<{ memberships: TripSession[] }>('/api/auth/session')

export const authLogout = (tripId?: string) =>
  post<{ memberships: TripSession[] }>('/api/auth/logout', tripId ? { tripId } : {})

/** 503: the server has no auth secrets configured (local dev), so run without cookies. */
export const authUnavailable = (r: AuthResult<unknown>) => !r.ok && r.status === 503
