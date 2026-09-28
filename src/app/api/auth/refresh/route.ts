import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth/tokens'
import {
  authContext, clearSessionCookies, cookiesFor, isSameOrigin, json, notConfigured, setSessionCookies,
} from '@/lib/server/authHttp'

export const runtime = 'nodejs'

/** POST → rotates the refresh token and issues a fresh access token. */
export async function POST(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()
  if (!isSameOrigin(req)) return json({ error: 'Forbidden' }, 403)

  const issued = await ctx.sessions.refresh(req.cookies.get(cookiesFor(req).refresh)?.value)
  if (!issued) {
    const res = json({ error: 'Session expired. Log in again.' }, 401)
    clearSessionCookies(res, req)
    return res
  }
  const res = json({ memberships: issued.memberships })
  await setSessionCookies(res, req, issued, ctx.key)
  return res
}

/**
 * GET ?next=/dashboard/… → used by middleware when the 15-minute access token
 * has expired: refresh silently, then continue to the page. On failure, go to
 * the login page and come back after.
 */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get('next')) ?? '/'
  const ctx = authContext()
  if (!ctx) return NextResponse.redirect(new URL(next, req.url))

  const issued = await ctx.sessions.refresh(req.cookies.get(cookiesFor(req).refresh)?.value)
  if (!issued) {
    const login = new URL('/login', req.url)
    login.searchParams.set('next', next)
    const res = NextResponse.redirect(login)
    clearSessionCookies(res, req)
    return res
  }
  const res = NextResponse.redirect(new URL(next, req.url))
  res.headers.set('Cache-Control', 'no-store')
  await setSessionCookies(res, req, issued, ctx.key)
  return res
}
