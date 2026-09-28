import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, cookieNames, sessionKey, signAccessToken, verifyAccessToken,
  type AccessClaims,
} from '@/lib/auth/tokens'
import { SessionService } from '@/lib/server/sessions'
import { SupabaseSessionRepo, supabaseAdmin } from '@/lib/server/supabaseAdmin'
import type { IssuedSession } from '@/lib/server/sessions'

export interface AuthContext {
  key: Uint8Array
  db: SupabaseClient
  sessions: SessionService
}

/** Null when SESSION_SECRET or the service-role key is missing. */
export function authContext(): AuthContext | null {
  const key = sessionKey()
  const db = supabaseAdmin()
  if (!key || !db) return null
  return { key, db, sessions: new SessionService(new SupabaseSessionRepo(db)) }
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export const notConfigured = () => json({ error: 'Login is not configured on this server.' }, 503)

const isSecure = (req: NextRequest) => req.nextUrl.protocol === 'https:'
export const cookiesFor = (req: NextRequest) => cookieNames(isSecure(req))

/**
 * Rejects cross-site POSTs (CSRF). Browsers always send Origin on POST; it
 * must match the host the request was made to.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

/** True while `key` is under `limit` hits per window. */
export async function underRateLimit(db: SupabaseClient, key: string, limit: number, windowSeconds: number) {
  const { data, error } = await db.rpc('tm_rate_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
  if (error) {
    // Migration not run yet: don't lock everyone out; any other error fails closed.
    const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message)
    if (!missing) console.error('[auth] rate limit check failed:', error.message)
    return missing
  }
  return data === true
}

export async function setSessionCookies(res: NextResponse, req: NextRequest, issued: IssuedSession, key: Uint8Array) {
  const names = cookiesFor(req)
  const secure = isSecure(req)
  const access = await signAccessToken({ sid: issued.sessionId, ms: issued.memberships }, key)
  res.cookies.set(names.access, access, {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: ACCESS_TTL_SECONDS,
  })
  if (issued.refreshToken) {
    res.cookies.set(names.refresh, issued.refreshToken, {
      httpOnly: true, secure, sameSite: 'lax', path: '/api/auth', maxAge: REFRESH_TTL_SECONDS,
    })
  }
}

// ─── Android app ──────────────────────────────────────────────────────────────
// The app has no cookie jar it controls well, so it keeps the refresh token in
// the phone's secure storage (Android Keystore) and sends tokens explicitly:
//   x-tm-client: app          marks the request as the app's
//   x-tm-access: <jwt>        the 15-minute access token, on data requests
//   { refreshToken }          in the body of /api/auth/refresh and /logout
// No browser sends these on its own, so the cookie CSRF check does not apply.

export const isAppClient = (req: NextRequest) => req.headers.get('x-tm-client') === 'app'

/** Web: same-origin check. App: allowed (it authenticates with explicit tokens, never cookies). */
export const allowedCaller = (req: NextRequest) => isAppClient(req) || isSameOrigin(req)

/** The refresh token for this caller: the app's body field or the browser's cookie. */
export function refreshTokenOf(req: NextRequest, body: any): string | undefined {
  if (isAppClient(req)) return typeof body?.refreshToken === 'string' && body.refreshToken.length <= 200 ? body.refreshToken : undefined
  return req.cookies.get(cookiesFor(req).refresh)?.value
}

/** Verified access claims from the app header or the browser cookie. */
export async function claimsOf(req: NextRequest, key: Uint8Array): Promise<AccessClaims | null> {
  const token = isAppClient(req)
    ? req.headers.get('x-tm-access') ?? undefined
    : req.cookies.get(cookiesFor(req).access)?.value
  return verifyAccessToken(token, key)
}

/**
 * Hands a session to the caller: cookies for the browser, tokens in the body
 * for the app (refreshToken null = keep the one you have).
 */
export async function issueSession(req: NextRequest, body: Record<string, unknown>, issued: IssuedSession, key: Uint8Array) {
  if (isAppClient(req)) {
    const accessToken = await signAccessToken({ sid: issued.sessionId, ms: issued.memberships }, key)
    return json({ ...body, accessToken, refreshToken: issued.refreshToken, expiresIn: ACCESS_TTL_SECONDS })
  }
  const res = json(body)
  await setSessionCookies(res, req, issued, key)
  return res
}

/** Ends the caller's session: clears cookies for the browser; the app drops its tokens. */
export function endSession(req: NextRequest, body: Record<string, unknown>, status = 200) {
  const res = json(body, status)
  if (!isAppClient(req)) clearSessionCookies(res, req)
  return res
}

export function clearSessionCookies(res: NextResponse, req: NextRequest) {
  const names = cookiesFor(req)
  const secure = isSecure(req)
  res.cookies.set(names.access, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 })
  res.cookies.set(names.refresh, '', { httpOnly: true, secure, sameSite: 'lax', path: '/api/auth', maxAge: 0 })
}

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
