import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/server/authHttp'

// Creating and joining trips, done on the server with the service key. The
// apps can no longer write trips or members' PINs themselves.

export const TRIP_CODE = /^[A-Z0-9-]{3,20}$/

/** Constant-time string comparison (trip passwords). */
export function samePassword(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export interface JoinInput {
  tripCode: string
  password: string
  /** Trip details when the trip may not be on the server yet: a new trip, or
   *  one created offline and shared by invite link. Ignored when it exists. */
  trip?: { id: string; name: string; status?: string; createdAt?: string }
  /** The caller created the trip: becomes its admin if it has none. */
  creator?: boolean
  member: { id?: string; name: string; mobile: string; pin: string; avatarColor?: string; joinedAt?: string }
}

export interface TripOut {
  id: string; tripCode: string; name: string; status: 'active' | 'closed'
  createdAt: string; closedAt?: string; creatorId: string
}
export interface MemberOut {
  id: string; tripId: string; name: string; mobile: string; avatarColor: string
  upiId?: string; upiName?: string; joinedAt: string
}

export type JoinOutcome =
  | { ok: true; trip: TripOut; member: MemberOut; alreadyMember: boolean; created: boolean }
  | { ok: false; status: number; error: string; code?: string }

const fail = (status: number, error: string, code?: string): JoinOutcome => ({ ok: false, status, error, code })

const TRIP_COLUMNS = 'id, trip_code, name, password, status, created_at, closed_at, creator_id'

const tripOut = (r: any): TripOut => ({
  id: r.id, tripCode: r.trip_code, name: r.name, status: r.status === 'closed' ? 'closed' : 'active',
  createdAt: r.created_at, closedAt: r.closed_at ?? undefined, creatorId: r.creator_id ?? '',
})
const memberOut = (r: any): MemberOut => ({
  id: r.id, tripId: r.trip_id, name: r.name, mobile: r.mobile, avatarColor: r.avatar_color,
  upiId: r.upi_id ?? undefined, upiName: r.upi_name ?? undefined, joinedAt: r.joined_at,
})

const isoOrNull = (s: unknown) => (typeof s === 'string' && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null)
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '')

/** Validates and normalises the request body; null when it is unusable. */
export function parseJoin(body: any): JoinInput | { error: string } {
  const tripCode = clean(body?.tripCode, 20).toUpperCase()
  const password = typeof body?.password === 'string' ? body.password : ''
  const m = body?.member
  const member = {
    id: isUuid(m?.id) ? m.id.toLowerCase() : undefined,
    name: clean(m?.name, 60),
    mobile: typeof m?.mobile === 'string' ? m.mobile : '',
    pin: typeof m?.pin === 'string' ? m.pin : '',
    avatarColor: clean(m?.avatarColor, 40) || undefined,
    joinedAt: isoOrNull(m?.joinedAt) ?? undefined,
  }
  if (!TRIP_CODE.test(tripCode)) return { error: 'Enter the trip code.' }
  if (!password || password.length > 100) return { error: 'Enter the trip password.' }
  if (!member.name) return { error: 'Your name is required.' }
  if (!/^[6-9]\d{9}$/.test(member.mobile)) return { error: 'Enter a valid 10-digit mobile number.' }
  if (!/^\d{4}$/.test(member.pin)) return { error: 'PIN must be exactly 4 digits.' }

  let trip: JoinInput['trip']
  if (body?.trip != null) {
    const t = body.trip
    if (!isUuid(t?.id) || !clean(t?.name, 80)) return { error: 'Trip details are incomplete.' }
    if (password.length < 4) return { error: 'Password must be at least 4 characters.' }
    trip = {
      id: t.id.toLowerCase(), name: clean(t.name, 80),
      status: t.status === 'closed' ? 'closed' : 'active',
      createdAt: isoOrNull(t.createdAt) ?? undefined,
    }
  }
  return { tripCode, password, trip, creator: body?.creator === true, member }
}

export async function joinTrip(db: SupabaseClient, input: JoinInput): Promise<JoinOutcome> {
  let created = false
  let { data: trip, error } = await db.from('trips').select(TRIP_COLUMNS).eq('trip_code', input.tripCode).maybeSingle()
  if (error) return fail(502, 'Could not reach the server. Try again.')

  if (!trip) {
    if (!input.trip) {
      return fail(404, 'This trip doesn’t exist. Double-check the code, or ask your friend for an invite link.')
    }
    const { data: inserted, error: insErr } = await db.from('trips').insert({
      id: input.trip.id,
      trip_code: input.tripCode,
      name: input.trip.name,
      password: input.password,
      status: input.trip.status ?? 'active',
      ...(input.trip.createdAt ? { created_at: input.trip.createdAt } : {}),
    }).select(TRIP_COLUMNS).single()
    if (insErr?.code === '23505') {
      // Same id already stored under another code, or a parallel create won.
      const again = await db.from('trips').select(TRIP_COLUMNS).eq('trip_code', input.tripCode).maybeSingle()
      if (!again.data) return fail(409, 'That trip code is taken. Please try again.', 'CODE_TAKEN')
      trip = again.data
    } else if (insErr || !inserted) {
      console.error('[trips] create failed:', insErr?.message)
      return fail(502, 'Could not save the trip on the server. Try again.')
    } else {
      trip = inserted
      created = true
    }
  }

  if (input.creator && input.trip && trip.id !== input.trip.id) {
    // A different trip already uses the code this creator generated.
    return fail(409, 'That trip code is already used by another trip.', 'CODE_TAKEN')
  }
  if (!created && !samePassword(String(trip.password ?? ''), input.password)) {
    return fail(401, 'Wrong trip password. Ask the trip creator for the correct one.')
  }

  // Already a member with this number? Prove it with the PIN chosen then.
  const { data: existing, error: memErr } = await db
    .from('members').select('*').eq('trip_id', trip.id).eq('mobile', input.member.mobile).maybeSingle()
  if (memErr) return fail(502, 'Could not reach the server. Try again.')

  let member: any = existing
  let alreadyMember = false
  if (existing) {
    const { data: ok, error: pinErr } = await db.rpc('tm_verify_member_pin', { p_member_id: existing.id, p_pin: input.member.pin })
    if (pinErr) {
      if (/PIN_LOCKED/.test(pinErr.message)) return fail(423, 'Too many wrong PINs. This member is locked for 15 minutes; try again later.')
      return fail(502, 'Could not check your PIN right now. Try again.')
    }
    if (ok !== true) {
      return fail(401, 'This mobile number has already joined the trip. Enter the PIN you chose then, or use Log in.', 'PIN_MISMATCH')
    }
    alreadyMember = true
  } else {
    let id = input.member.id
    if (id) {
      // Never let a client-chosen id land on someone else's member row.
      const { data: taken } = await db.from('members').select('id').eq('id', id).maybeSingle()
      if (taken) id = undefined
    }
    const { count } = await db.from('members').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id)
    const { data: inserted, error: insErr } = await db.from('members').insert({
      ...(id ? { id } : {}),
      trip_id: trip.id,
      name: input.member.name,
      mobile: input.member.mobile,
      pin: input.member.pin, // hashed into member_pins and blanked by the database trigger
      avatar_color: input.member.avatarColor ?? AVATAR_FALLBACK[(count ?? 0) % AVATAR_FALLBACK.length],
      ...(input.member.joinedAt ? { joined_at: input.member.joinedAt } : {}),
    }).select('*').single()
    if (insErr || !inserted) {
      if (insErr?.code === '23505') return fail(409, 'This mobile number just joined the trip. Log in with its PIN.')
      console.error('[trips] join failed:', insErr?.message)
      return fail(502, 'Could not join the trip. Please try again.')
    }
    member = inserted
  }

  if (input.creator && !trip.creator_id && (created || member.id === input.member.id)) {
    await db.from('trips').update({ creator_id: member.id }).eq('id', trip.id).is('creator_id', null)
    trip = { ...trip, creator_id: member.id }
  }

  return { ok: true, trip: tripOut(trip), member: memberOut(member), alreadyMember, created }
}

const AVATAR_FALLBACK = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
