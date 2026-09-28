// Server session for the Android app — the same sessions the website uses,
// without cookies:
//   • the 90-day refresh token lives in the phone's secure storage (Android
//     Keystore via expo-secure-store), never in AsyncStorage;
//   • the 15-minute access token lives only in memory;
//   • every request to the TripMate server says `x-tm-client: app` and sends
//     the tokens explicitly.
// The app never talks to the database directly: all trip data goes through
// the website's /api/sb proxy, which checks the access token.
import * as SecureStore from 'expo-secure-store'
import { WEB_URL } from './config'

const REFRESH_KEY = 'tm_refresh_token'
const REQUEST_TIMEOUT_MS = 25_000

export interface Membership {
  tripId: string
  memberId: string
  tripCode: string
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string }

export const isServerConfigured = /^https?:\/\/\S+/.test(WEB_URL)

let access: { token: string; expiresAt: number } | null = null
let memberships: Membership[] = []

// ─── Secure storage (null-safe on platforms without it, e.g. web preview) ─────

async function readRefresh(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY)
  } catch {
    return null
  }
}

async function writeRefresh(token: string | null) {
  try {
    if (token) await SecureStore.setItemAsync(REFRESH_KEY, token)
    else await SecureStore.deleteItemAsync(REFRESH_KEY)
  } catch {
    // No secure storage here: the session then lasts only while the app runs.
  }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

/** POST to the TripMate server as the app. Status 0 = no connection. */
export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  if (!isServerConfigured) return { ok: false, status: 503, error: 'Cloud sync is not configured in this build.' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${WEB_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tm-client': 'app' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
  } catch {
    return { ok: false, status: 0, error: 'You appear to be offline. Connect to the internet and try again.' }
  } finally {
    clearTimeout(timer)
  }
  const data = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, data: data as T }
  return { ok: false, status: res.status, error: data?.error || 'Something went wrong. Try again.', code: data?.code }
}

interface TokenResponse {
  accessToken: string
  refreshToken: string | null
  expiresIn: number
  memberships: Membership[]
}

/** Keeps the tokens from a login, join or refresh response. */
export async function adoptSession(data: TokenResponse) {
  access = { token: data.accessToken, expiresAt: Date.now() + (data.expiresIn ?? 900) * 1000 }
  memberships = Array.isArray(data.memberships) ? data.memberships : memberships
  if (data.refreshToken) await writeRefresh(data.refreshToken)
}

let refreshing: Promise<boolean> | null = null

/** Gets a new access token with the stored refresh token. False = log in again. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await readRefresh()
    if (!refreshToken) return false
    const res = await apiPost<TokenResponse>('/api/auth/refresh', { refreshToken })
    if (res.ok) {
      await adoptSession(res.data)
      return true
    }
    // 401: the session ended on the server (logged out, expired or revoked).
    if (res.status === 401) {
      access = null
      memberships = []
      await writeRefresh(null)
    }
    return false
  })().finally(() => { refreshing = null })
  return refreshing
}

/** A valid access token, refreshed when it is about to expire; null when logged out or offline. */
export async function accessToken(): Promise<string | null> {
  if (access && access.expiresAt - Date.now() > 60_000) return access.token
  return (await refreshSession()) ? access?.token ?? null : null
}

/** Drops the in-memory access token so the next request refreshes it. */
export function expireAccessToken() {
  access = null
}

export function sessionMemberships(): Membership[] {
  return memberships
}

/** True when the server session includes this trip (refreshing if needed). */
export async function hasTripSession(tripId: string): Promise<boolean> {
  if (!memberships.length || !access) await accessToken()
  return memberships.some(m => m.tripId === tripId)
}

// ─── Auth calls ───────────────────────────────────────────────────────────────

export interface ServerTripChoice {
  tripId: string; tripCode: string; name: string; status: 'active' | 'closed'
  createdAt: string; memberId: string; memberName: string; memberCount: number
}

export const serverLookupTrips = (mobile: string) =>
  apiPost<{ trips: ServerTripChoice[] }>('/api/auth/lookup', { mobile })

/** Checks the PIN on the server and adds the trip to this phone's session. */
export async function serverLogin(memberId: string, pin: string): Promise<ApiResult<{ session: Membership }>> {
  const refreshToken = await readRefresh()
  const res = await apiPost<TokenResponse & { session: Membership }>('/api/auth/login', { memberId, pin, refreshToken })
  if (res.ok) await adoptSession(res.data)
  return res
}

/** Leaves one trip (or every trip) on the server. Works offline too: the local tokens are dropped. */
export async function serverLogout(tripId?: string) {
  const refreshToken = await readRefresh()
  if (refreshToken) {
    const res = await apiPost<TokenResponse>('/api/auth/logout', { refreshToken, ...(tripId ? { tripId } : {}) })
    if (res.ok && res.data.accessToken) {
      await adoptSession(res.data)
      return
    }
  }
  access = null
  memberships = []
  await writeRefresh(null)
}

// ─── Trips (created and joined on the server) ────────────────────────────────

export interface ServerTrip {
  id: string; tripCode: string; name: string; status: 'active' | 'closed'
  createdAt: string; closedAt?: string; creatorId: string
}
export interface ServerMember {
  id: string; tripId: string; name: string; mobile: string; avatarColor: string
  upiId?: string; upiName?: string; joinedAt: string
}

export const serverFindTrip = (tripCode: string, password: string) =>
  apiPost<{ trip: ServerTrip; memberCount: number }>('/api/trips/find', { tripCode, password })

export interface JoinRequest {
  tripCode: string
  password: string
  member: { id?: string; name: string; mobile: string; pin: string; avatarColor?: string; joinedAt?: string }
  trip?: { id: string; name: string; status?: string; createdAt?: string }
  creator?: boolean
}

/** Creates or joins a trip on the server and adds it to this phone's session. */
export async function serverJoinTrip(req: JoinRequest) {
  const refreshToken = await readRefresh()
  const res = await apiPost<TokenResponse & { trip: ServerTrip; member: ServerMember; alreadyMember: boolean; created: boolean }>(
    '/api/trips/join', { ...req, refreshToken })
  if (res.ok) await adoptSession(res.data)
  return res
}
