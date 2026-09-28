import type { NextRequest } from 'next/server'
import {
  allowedCaller, authContext, clientIp, issueSession, json, notConfigured, refreshTokenOf, underRateLimit,
} from '@/lib/server/authHttp'
import { joinTrip, parseJoin } from '@/lib/server/tripJoin'

export const runtime = 'nodejs'

/**
 * POST { tripCode, password, member: { name, mobile, pin, … }, trip?, creator? }
 * Creates the trip when `trip` is given and the code is new, otherwise joins
 * the existing trip after checking its password (and, for a number that is
 * already a member, its PIN). Then logs the caller in to that trip.
 */
export async function POST(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()
  if (!allowedCaller(req)) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const input = parseJoin(body)
  if ('error' in input) return json({ error: input.error }, 400)

  // Generous per trip (a whole group joins at once, often behind one carrier IP),
  // still far too few tries to guess a trip password.
  const allowed =
    (await underRateLimit(ctx.db, `join:ip:${clientIp(req)}`, 60, 600)) &&
    (await underRateLimit(ctx.db, `join:code:${input.tripCode}`, 100, 600))
  if (!allowed) return json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429)

  const out = await joinTrip(ctx.db, input)
  if (!out.ok) return json({ error: out.error, code: out.code }, out.status)

  const membership = { tripId: out.trip.id, memberId: out.member.id, tripCode: out.trip.tripCode }
  const issued = await ctx.sessions.login(refreshTokenOf(req, body), membership, req.headers.get('user-agent'))
  return issueSession(req, {
    trip: out.trip, member: out.member, alreadyMember: out.alreadyMember, created: out.created,
    session: membership, memberships: issued.memberships,
  }, issued, ctx.key)
}
