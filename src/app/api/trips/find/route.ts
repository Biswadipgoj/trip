import type { NextRequest } from 'next/server'
import { allowedCaller, authContext, clientIp, json, notConfigured, underRateLimit } from '@/lib/server/authHttp'
import { TRIP_CODE, samePassword } from '@/lib/server/tripJoin'

export const runtime = 'nodejs'

/**
 * POST { tripCode, password } → the trip's public details once the password
 * matches. The password is checked here, never in the browser or app.
 */
export async function POST(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()
  if (!allowedCaller(req)) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const code = typeof body?.tripCode === 'string' ? body.tripCode.trim().toUpperCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!TRIP_CODE.test(code)) return json({ error: 'Enter the trip code.' }, 400)

  // Generous per trip (a whole group joins at once, often behind one carrier IP),
  // still far too few tries to guess a trip password.
  const allowed =
    (await underRateLimit(ctx.db, `find:ip:${clientIp(req)}`, 60, 600)) &&
    (await underRateLimit(ctx.db, `find:code:${code}`, 100, 600))
  if (!allowed) return json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429)

  const { data: trip, error } = await ctx.db
    .from('trips').select('id, trip_code, name, password, status, created_at, closed_at, creator_id')
    .eq('trip_code', code).maybeSingle()
  if (error) {
    console.error('[trips] find failed:', error.message)
    return json({ error: 'Could not reach the server. Check your connection and try again.' }, 502)
  }
  if (!trip) return json({ error: 'This trip doesn’t exist. Double-check the code, or ask your friend for an invite link.' }, 404)
  if (!samePassword(String(trip.password ?? ''), password)) {
    return json({ error: 'Wrong trip password. Ask the trip creator for the correct one.' }, 401)
  }

  const { count } = await ctx.db.from('members').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id)
  return json({
    trip: {
      id: trip.id, tripCode: trip.trip_code, name: trip.name, status: trip.status,
      createdAt: trip.created_at, closedAt: trip.closed_at ?? undefined, creatorId: trip.creator_id ?? '',
    },
    memberCount: count ?? 0,
  })
}
