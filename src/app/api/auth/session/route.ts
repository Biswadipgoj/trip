import type { NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/tokens'
import {
  authContext, clearSessionCookies, cookiesFor, json, notConfigured, setSessionCookies,
} from '@/lib/server/authHttp'

export const runtime = 'nodejs'

/** GET → the trips this browser is logged in to (refreshing the access token if it expired). */
export async function GET(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()

  const names = cookiesFor(req)
  const claims = await verifyAccessToken(req.cookies.get(names.access)?.value, ctx.key)
  if (claims) return json({ memberships: claims.ms })

  const issued = await ctx.sessions.refresh(req.cookies.get(names.refresh)?.value)
  if (!issued) {
    const res = json({ memberships: [] }, 401)
    clearSessionCookies(res, req)
    return res
  }
  const res = json({ memberships: issued.memberships })
  await setSessionCookies(res, req, issued, ctx.key)
  return res
}
