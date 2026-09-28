import type { NextRequest } from 'next/server'
import {
  allowedCaller, authContext, endSession, isUuid, issueSession, json, notConfigured, refreshTokenOf,
} from '@/lib/server/authHttp'

export const runtime = 'nodejs'

/** POST { tripId? } → leaves one trip, or the whole session when no trip is given. */
export async function POST(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()
  if (!allowedCaller(req)) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const tripId = isUuid(body?.tripId) ? body.tripId : undefined

  const remaining = await ctx.sessions.logout(refreshTokenOf(req, body), tripId)
  if (!remaining) return endSession(req, { memberships: [] })
  return issueSession(req, { memberships: remaining.memberships }, remaining, ctx.key)
}
