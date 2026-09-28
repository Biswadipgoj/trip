import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, cookieNames, sessionKey, signAccessToken,
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

export function clearSessionCookies(res: NextResponse, req: NextRequest) {
  const names = cookiesFor(req)
  const secure = isSecure(req)
  res.cookies.set(names.access, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 })
  res.cookies.set(names.refresh, '', { httpOnly: true, secure, sameSite: 'lax', path: '/api/auth', maxAge: 0 })
}

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
