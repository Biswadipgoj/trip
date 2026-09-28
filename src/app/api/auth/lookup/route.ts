import type { NextRequest } from 'next/server'
import { authContext, clientIp, isSameOrigin, json, notConfigured, underRateLimit } from '@/lib/server/authHttp'

export const runtime = 'nodejs'

/** POST { mobile } → the trips that number can log in to. Never returns PIN data. */
export async function POST(req: NextRequest) {
  const ctx = authContext()
  if (!ctx) return notConfigured()
  if (!isSameOrigin(req)) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => null)
  const mobile = typeof body?.mobile === 'string' ? body.mobile : ''
  if (!/^[6-9]\d{9}$/.test(mobile)) return json({ error: 'Enter a valid 10-digit mobile number.' }, 400)

  const ip = clientIp(req)
  const allowed =
    (await underRateLimit(ctx.db, `lookup:ip:${ip}`, 30, 600)) &&
    (await underRateLimit(ctx.db, `lookup:mobile:${mobile}`, 10, 600))
  if (!allowed) return json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429)

  const { data, error } = await ctx.db.rpc('tm_find_trips_by_mobile', { p_mobile: mobile })
  if (error) {
    console.error('[auth] lookup failed:', error.message)
    return json({ error: 'Could not look up trips right now. Try again.' }, 502)
  }
  const trips = ((data ?? []) as any[]).map(r => ({
    tripId: r.trip_id,
    tripCode: r.trip_code,
    name: r.trip_name,
    status: r.status === 'closed' ? 'closed' : 'active',
    createdAt: r.created_at,
    memberId: r.member_id,
    memberName: r.member_name,
    memberCount: r.member_count ?? 0,
  }))
  return json({ trips })
}
