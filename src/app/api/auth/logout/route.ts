import type { NextRequest } from 'next/server'
import {
  authContext, clearSessionCookies, cookiesFor, isSameOrigin, isUuid, json, notConfigured, setSessionCookies,
} from '@/lib/server/authHttp'

export const runtime = 'nodejs'

/** POST { tripId? } → leaves one trip, or the whole session when no trip is given. */
export async function POST(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()
  if (!isSameOrigin(req)) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const tripId = isUuid(body?.tripId) ? body.tripId : undefined

  const remaining = await ctx.sessions.logout(req.cookies.get(cookiesFor(req).refresh)?.value, tripId)
  const res = json({ memberships: remaining?.memberships ?? [] })
  if (remaining) await setSessionCookies(res, req, remaining, ctx.key)
  else clearSessionCookies(res, req)
  return res
}
