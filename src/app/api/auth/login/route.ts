import type { NextRequest } from 'next/server'
import {
  allowedCaller, authContext, clientIp, isUuid, issueSession, json, notConfigured, refreshTokenOf, underRateLimit,
} from '@/lib/server/authHttp'

export const runtime = 'nodejs'

/**
 * POST { memberId, pin } → checks the PIN on the server and issues the session
 * cookies. Logging into another trip from the same browser adds that trip to
 * the existing session.
 */
export async function POST(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()
  if (!allowedCaller(req)) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const memberId = body?.memberId
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  if (!isUuid(memberId) || !/^\d{4}$/.test(pin)) return json({ error: 'Enter your 4-digit PIN.' }, 400)

  if (!(await underRateLimit(ctx.db, `login:ip:${clientIp(req)}`, 30, 600))) {
    return json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429)
  }

  const { data: ok, error } = await ctx.db.rpc('tm_verify_member_pin', { p_member_id: memberId, p_pin: pin })
  if (error) {
    if (/PIN_LOCKED/.test(error.message)) {
      return json({ error: 'Too many wrong PINs. This member is locked for 15 minutes; try again later.' }, 423)
    }
    console.error('[auth] pin check failed:', error.message)
    return json({ error: 'Could not check your PIN right now. Try again.' }, 502)
  }
  if (ok !== true) return json({ error: 'That PIN doesn’t match this trip. Try again.' }, 401)

  // Two plain queries: members↔trips has two foreign keys (trip_id, creator_id), so an embedded select is ambiguous.
  const { data: member } = await ctx.db.from('members').select('trip_id').eq('id', memberId).maybeSingle()
  const { data: trip } = member
    ? await ctx.db.from('trips').select('id, trip_code').eq('id', member.trip_id).maybeSingle()
    : { data: null }
  if (!member || !trip) return json({ error: 'This trip no longer exists.' }, 404)

  const membership = { tripId: trip.id as string, memberId, tripCode: trip.trip_code as string }
  const issued = await ctx.sessions.login(refreshTokenOf(req, body), membership, req.headers.get('user-agent'))
  return issueSession(req, { session: membership, memberships: issued.memberships }, issued, ctx.key)
}
