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

// ─── Trips (create / join, checked on the server) ────────────────────────────

export interface ServerTrip {
  id: string; tripCode: string; name: string; status: 'active' | 'closed'
  createdAt: string; closedAt?: string; creatorId: string
}
export interface ServerMember {
  id: string; tripId: string; name: string; mobile: string; avatarColor: string
  upiId?: string; upiName?: string; joinedAt: string
}

/** Checks the trip password on the server; the trip's details come back only when it matches. */
export const tripsFind = (tripCode: string, password: string) =>
  post<{ trip: ServerTrip; memberCount: number }>('/api/trips/find', { tripCode, password })

export interface JoinRequest {
  tripCode: string
  password: string
  member: { id?: string; name: string; mobile: string; pin: string; avatarColor?: string; joinedAt?: string }
  /** Send when the trip may not be on the server yet (new trip, or offline-created via invite link). */
  trip?: { id: string; name: string; status?: string; createdAt?: string }
  creator?: boolean
}

/** Creates or joins a trip and logs this browser in to it (httpOnly cookies). */
export const tripsJoin = (req: JoinRequest) =>
  post<{ trip: ServerTrip; member: ServerMember; alreadyMember: boolean; created: boolean; session: TripSession; memberships: TripSession[] }>(
    '/api/trips/join', req)
