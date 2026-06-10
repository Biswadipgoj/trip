// ──────────────────────────────────────────────────────────────────────────────
// REMOTE SYNC LAYER (Supabase)
//
// The single source of truth for cross-device trips. The join flow validates
// the trip against this layer so joining NEVER creates a new trip — it only
// attaches a member to the existing trip row and pulls its data down.
//
// Every function is null-safe: when Supabase env vars are missing the app
// degrades to localStorage-only mode (single device) exactly as before.
// ──────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/utils'
import type {
  Trip, Member, Expense, HotelExpense, Settlement, ExpensePayer, PaymentStatus,
  ExpenseCategory, SplitType, Room, SettlementGroup, Sponsorship,
} from '@/types'

export function isRemoteEnabled(): boolean {
  return supabase !== null
}

/** Structured logging for join events — makes join failures diagnosable. */
export function joinLog(event: string, data?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.info(`[join] ${event}`, data ?? {})
}

// ─── Notes envelope ────────────────────────────────────────────────────────────
// The DB schema has no columns for multi-payer or subcategory, so that metadata
// rides inside the `notes` TEXT column as a tagged JSON envelope. The schema
// itself stays untouched.

const META_PREFIX = '@@v1@@'

function packNotes(e: { notes?: string; payers?: ExpensePayer[]; subcategory?: string }): string | null {
  const hasMeta = (e.payers && e.payers.length > 0) || !!e.subcategory
  if (!hasMeta) return e.notes || null
  return META_PREFIX + JSON.stringify({ n: e.notes || '', p: e.payers, sc: e.subcategory })
}

function unpackNotes(raw: string | null): { notes?: string; payers?: ExpensePayer[]; subcategory?: string } {
  if (!raw) return {}
  if (!raw.startsWith(META_PREFIX)) return { notes: raw }
  try {
    const meta = JSON.parse(raw.slice(META_PREFIX.length))
    return { notes: meta.n || undefined, payers: meta.p || undefined, subcategory: meta.sc || undefined }
  } catch {
    return { notes: raw }
  }
}

// ─── Row ↔ model mapping ──────────────────────────────────────────────────────

function tripFromRow(row: any): Trip {
  return {
    id: row.id,
    tripCode: row.trip_code,
    name: row.name,
    password: row.password,
    creatorId: row.creator_id || '',
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at || undefined,
  }
}

function memberFromRow(row: any): Member {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    mobile: row.mobile || '',
    pin: row.pin || '',
    upiId: row.upi_id || undefined,
    upiName: row.upi_name || undefined,
    avatarColor: row.avatar_color,
    joinedAt: row.joined_at,
  }
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function remoteFindTripByCode(tripCode: string): Promise<Trip | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('trip_code', tripCode.toUpperCase())
    .maybeSingle()
  if (error) {
    joinLog('remote.findTrip.error', { tripCode, error: error.message })
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  return data ? tripFromRow(data) : null
}

export async function remoteCreateTrip(trip: Trip, creator: Member): Promise<void> {
  if (!supabase || !isUuid(trip.id) || !isUuid(creator.id)) return
  const { error: tripErr } = await supabase.from('trips').insert({
    id: trip.id,
    trip_code: trip.tripCode,
    name: trip.name,
    password: trip.password,
    status: trip.status,
    created_at: trip.createdAt,
  })
  if (tripErr) {
    joinLog('remote.createTrip.error', { tripId: trip.id, error: tripErr.message })
    return
  }
  const { error: memErr } = await supabase.from('members').insert({
    id: creator.id,
    trip_id: trip.id,
    name: creator.name,
    mobile: creator.mobile,
    pin: creator.pin,
    avatar_color: creator.avatarColor,
    joined_at: creator.joinedAt,
  })
  if (memErr) {
    joinLog('remote.createTrip.memberError', { tripId: trip.id, error: memErr.message })
    return
  }
  await supabase.from('trips').update({ creator_id: creator.id }).eq('id', trip.id)
  joinLog('remote.createTrip.ok', { tripId: trip.id, tripCode: trip.tripCode })
}

/**
 * Guarantees a trip verified via an invite link also exists on the server —
 * WITHOUT ever creating a duplicate. It inserts the exact same trip row
 * (same id, same trip code) only when no row with that code exists yet.
 * This heals trips that were created before cloud sync was configured, so a
 * join always attaches everyone to the ONE shared trip instead of leaving
 * divergent device-local copies with the same name.
 */
export async function remoteEnsureTrip(trip: Trip): Promise<boolean> {
  if (!supabase || !isUuid(trip.id)) return false

  const { data: existing, error: findErr } = await supabase
    .from('trips')
    .select('id')
    .eq('trip_code', trip.tripCode.toUpperCase())
    .maybeSingle()
  if (findErr) {
    joinLog('remote.ensureTrip.findError', { tripCode: trip.tripCode, error: findErr.message })
    return false
  }
  if (existing) return existing.id === trip.id

  const { error } = await supabase.from('trips').insert({
    id: trip.id,
    trip_code: trip.tripCode,
    name: trip.name,
    password: trip.password,
    status: trip.status,
    created_at: trip.createdAt,
  })
  if (error) {
    joinLog('remote.ensureTrip.insertError', { tripId: trip.id, error: error.message })
    return false
  }
  joinLog('remote.ensureTrip.created', { tripId: trip.id, tripCode: trip.tripCode })
  return true
}

export async function remoteCloseTrip(tripId: string): Promise<void> {
  if (!supabase || !isUuid(tripId)) return
  await supabase.from('trips')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', tripId)
}

// ─── Members / join ───────────────────────────────────────────────────────────

export async function remoteGetMembers(tripId: string): Promise<Member[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true })
  if (error || !data) return []
  return data.map(memberFromRow)
}

/**
 * Attaches a member to an EXISTING trip. Duplicate-safe: if a member with the
 * same mobile already exists on the trip, that member is returned instead of
 * inserting a second row (also enforced by the DB UNIQUE(trip_id, mobile)).
 */
export async function remoteJoinTrip(
  trip: Trip,
  details: { name: string; mobile: string; pin: string; avatarColor: string }
): Promise<{ member: Member; alreadyMember: boolean }> {
  if (!supabase) throw new Error('Server sync is not configured.')

  const { data: existing } = await supabase
    .from('members')
    .select('*')
    .eq('trip_id', trip.id)
    .eq('mobile', details.mobile)
    .maybeSingle()

  if (existing) {
    joinLog('join.duplicatePrevented', { tripId: trip.id, tripCode: trip.tripCode, mobile: details.mobile })
    return { member: memberFromRow(existing), alreadyMember: true }
  }

  const { data, error } = await supabase
    .from('members')
    .insert({
      trip_id: trip.id,
      name: details.name,
      mobile: details.mobile,
      pin: details.pin,
      avatar_color: details.avatarColor,
    })
    .select('*')
    .single()

  if (error || !data) {
    joinLog('join.insertError', { tripId: trip.id, error: error?.message })
    throw new Error('Could not join the trip. Please try again.')
  }
  joinLog('join.memberAdded', { tripId: trip.id, tripCode: trip.tripCode, memberId: data.id })
  return { member: memberFromRow(data), alreadyMember: false }
}

export async function remoteUpdateMemberUpi(memberId: string, upiId: string, upiName?: string): Promise<void> {
  if (!supabase || !isUuid(memberId)) return
  await supabase.from('members')
    .update({ upi_id: upiId, upi_name: upiName ?? null })
    .eq('id', memberId)
}

export async function remoteAddManualMember(member: Member): Promise<void> {
  if (!supabase || !isUuid(member.id) || !isUuid(member.tripId)) return
  await supabase.from('members').insert({
    id: member.id,
    trip_id: member.tripId,
    name: member.name,
    mobile: member.mobile || `manual-${member.id.slice(0, 8)}`, // UNIQUE(trip_id, mobile) needs a placeholder
    pin: member.pin,
    avatar_color: member.avatarColor,
    joined_at: member.joinedAt,
  })
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function remotePushExpense(expense: Expense): Promise<void> {
  if (!supabase || !isUuid(expense.id) || !isUuid(expense.tripId)) return
  const { error } = await supabase.from('expenses').insert({
    id: expense.id,
    trip_id: expense.tripId,
    title: expense.title,
    amount: expense.amount,
    paid_by: expense.paidBy,
    category: expense.category,
    split_type: expense.splitType,
    notes: packNotes(expense),
    created_at: expense.createdAt,
  })
  if (error) return

  const splitMap: Record<string, { value: number; resolved: number }> = {}
  expense.splits.forEach(s => {
    splitMap[s.memberId] = { value: s.value, resolved: s.resolvedAmount ?? 0 }
  })
  const equalShare = expense.participants.length > 0 ? expense.amount / expense.participants.length : 0
  const rows = expense.participants.map(memberId => ({
    expense_id: expense.id,
    member_id: memberId,
    split_value: splitMap[memberId]?.value ?? 0,
    resolved_amount: expense.splitType === 'equal'
      ? Math.round(equalShare * 100) / 100
      : splitMap[memberId]?.resolved ?? 0,
  }))
  if (rows.length > 0) await supabase.from('expense_participants').insert(rows)
}

export async function remoteDeleteExpense(expenseId: string): Promise<void> {
  if (!supabase || !isUuid(expenseId)) return
  await supabase.from('expenses').delete().eq('id', expenseId)
}

// ─── Hotel expenses ───────────────────────────────────────────────────────────

export async function remotePushHotelExpense(hotel: HotelExpense): Promise<void> {
  if (!supabase || !isUuid(hotel.id) || !isUuid(hotel.tripId)) return
  const { error } = await supabase.from('hotel_expenses').insert({
    id: hotel.id,
    trip_id: hotel.tripId,
    title: hotel.title,
    total_amount: hotel.totalAmount,
    paid_by: hotel.paidBy,
    created_at: hotel.createdAt,
  })
  if (error) return

  for (const room of hotel.rooms) {
    const roomId = isUuid(room.id) ? room.id : undefined
    const { data } = await supabase.from('rooms').insert({
      ...(roomId ? { id: roomId } : {}),
      hotel_expense_id: hotel.id,
      trip_id: hotel.tripId,
      name: room.name,
      cost: room.cost,
    }).select('id').single()
    const finalRoomId = data?.id
    if (finalRoomId && room.occupantIds.length > 0) {
      await supabase.from('room_occupants').insert(
        room.occupantIds.map(memberId => ({ room_id: finalRoomId, member_id: memberId }))
      )
    }
  }
}

export async function remoteDeleteHotelExpense(hotelId: string): Promise<void> {
  if (!supabase || !isUuid(hotelId)) return
  await supabase.from('hotel_expenses').delete().eq('id', hotelId)
}

// ─── Settlement groups & sponsorships ─────────────────────────────────────────
// Couples/units and sponsorships affect how settlements are computed, so they
// must live on the server too — otherwise each device sees a different
// "who pays whom" for the same trip.

export async function remotePushSettlementGroup(group: SettlementGroup): Promise<void> {
  if (!supabase || !isUuid(group.id) || !isUuid(group.tripId)) return
  const { error } = await supabase.from('settlement_groups').insert({
    id: group.id,
    trip_id: group.tripId,
    name: group.name,
  })
  if (error) return
  const rows = group.memberIds.filter(isUuid).map(member_id => ({
    group_id: group.id,
    member_id,
  }))
  if (rows.length > 0) await supabase.from('settlement_group_members').insert(rows)
}

export async function remoteDeleteSettlementGroup(groupId: string): Promise<void> {
  if (!supabase || !isUuid(groupId)) return
  await supabase.from('settlement_groups').delete().eq('id', groupId)
}

export async function remotePushSponsorship(sp: Sponsorship): Promise<void> {
  if (!supabase || !isUuid(sp.id) || !isUuid(sp.tripId)) return
  await supabase.from('sponsorships').insert({
    id: sp.id,
    trip_id: sp.tripId,
    sponsor_member_id: sp.sponsorMemberId,
    sponsored_member_id: sp.sponsoredMemberId,
  })
}

export async function remoteDeleteSponsorship(sponsorshipId: string): Promise<void> {
  if (!supabase || !isUuid(sponsorshipId)) return
  await supabase.from('sponsorships').delete().eq('id', sponsorshipId)
}

// ─── Settlement status ────────────────────────────────────────────────────────

export async function remotePushSettlementStatus(s: Settlement): Promise<void> {
  if (!supabase || !isUuid(s.tripId)) return

  const patch = {
    amount: s.amount,
    status: s.status,
    paid_at: s.paidAt ?? null,
    confirmed_at: s.confirmedAt ?? null,
  }

  // 1) The same settlement already lives on the server → update it in place.
  if (isUuid(s.id)) {
    const { data: byId } = await supabase
      .from('settlements').select('id').eq('id', s.id).maybeSingle()
    if (byId) {
      await supabase.from('settlements').update(patch).eq('id', s.id)
      return
    }
  }

  // 2) Reuse an OPEN (not confirmed) legacy row for this direction. Confirmed
  //    rows are immutable payment history — a newer due between the same two
  //    people must never overwrite one.
  const { data: open } = await supabase
    .from('settlements')
    .select('id')
    .eq('trip_id', s.tripId)
    .eq('from_member_id', s.fromMemberId)
    .eq('to_member_id', s.toMemberId)
    .neq('status', 'confirmed')
    .limit(1)
    .maybeSingle()

  if (open) {
    await supabase.from('settlements').update(patch).eq('id', open.id)
    return
  }

  // 3) Brand-new payment row (keeps the local id so future pushes match).
  await supabase.from('settlements').insert({
    ...(isUuid(s.id) ? { id: s.id } : {}),
    trip_id: s.tripId,
    from_member_id: s.fromMemberId,
    to_member_id: s.toMemberId,
    ...patch,
  })
}

// ─── Full trip pull ───────────────────────────────────────────────────────────

export interface TripBundle {
  trip: Trip
  members: Member[]
  expenses: Expense[]
  hotelExpenses: HotelExpense[]
  settlementGroups: SettlementGroup[]
  sponsorships: Sponsorship[]
  settlementStatuses: Array<{
    id: string
    fromMemberId: string
    toMemberId: string
    amount: number
    status: PaymentStatus
    paidAt?: string
    confirmedAt?: string
  }>
}

/** Pulls the full trip dataset from Supabase, mapped to local model types. */
export async function remoteFetchTripBundle(tripId: string): Promise<TripBundle | null> {
  if (!supabase || !isUuid(tripId)) return null

  const [tripRes, membersRes, expensesRes, participantsRes, hotelsRes, roomsRes, occupantsRes, settlementsRes, groupsRes, groupMembersRes, sponsorshipsRes] =
    await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
      supabase.from('members').select('*').eq('trip_id', tripId).order('joined_at', { ascending: true }),
      supabase.from('expenses').select('*').eq('trip_id', tripId),
      supabase.from('expense_participants').select('*, expenses!inner(trip_id)').eq('expenses.trip_id', tripId),
      supabase.from('hotel_expenses').select('*').eq('trip_id', tripId),
      supabase.from('rooms').select('*').eq('trip_id', tripId),
      supabase.from('room_occupants').select('*, rooms!inner(trip_id)').eq('rooms.trip_id', tripId),
      supabase.from('settlements').select('*').eq('trip_id', tripId),
      supabase.from('settlement_groups').select('*').eq('trip_id', tripId),
      supabase.from('settlement_group_members').select('*, settlement_groups!inner(trip_id)').eq('settlement_groups.trip_id', tripId),
      supabase.from('sponsorships').select('*').eq('trip_id', tripId),
    ])

  if (tripRes.error || !tripRes.data) return null

  const trip = tripFromRow(tripRes.data)
  const members = (membersRes.data || []).map(memberFromRow)

  const participantsByExpense: Record<string, any[]> = {}
  ;(participantsRes.data || []).forEach((p: any) => {
    ;(participantsByExpense[p.expense_id] ||= []).push(p)
  })

  const expenses: Expense[] = (expensesRes.data || []).map((row: any) => {
    const meta = unpackNotes(row.notes)
    const parts = participantsByExpense[row.id] || []
    return {
      id: row.id,
      tripId: row.trip_id,
      title: row.title,
      amount: Number(row.amount),
      paidBy: row.paid_by,
      payers: meta.payers,
      category: row.category as ExpenseCategory,
      subcategory: meta.subcategory,
      participants: parts.map(p => p.member_id),
      splitType: row.split_type as SplitType,
      splits: parts.map(p => ({
        memberId: p.member_id,
        value: Number(p.split_value),
        resolvedAmount: Number(p.resolved_amount),
      })),
      createdAt: row.created_at,
      notes: meta.notes,
    }
  })

  const occupantsByRoom: Record<string, string[]> = {}
  ;(occupantsRes.data || []).forEach((o: any) => {
    ;(occupantsByRoom[o.room_id] ||= []).push(o.member_id)
  })
  const roomsByHotel: Record<string, Room[]> = {}
  ;(roomsRes.data || []).forEach((r: any) => {
    ;(roomsByHotel[r.hotel_expense_id] ||= []).push({
      id: r.id,
      name: r.name,
      cost: Number(r.cost),
      occupantIds: occupantsByRoom[r.id] || [],
    })
  })

  const hotelExpenses: HotelExpense[] = (hotelsRes.data || []).map((row: any) => ({
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    totalAmount: Number(row.total_amount),
    paidBy: row.paid_by,
    rooms: roomsByHotel[row.id] || [],
    createdAt: row.created_at,
  }))

  const membersByGroup: Record<string, string[]> = {}
  ;(groupMembersRes.data || []).forEach((gm: any) => {
    ;(membersByGroup[gm.group_id] ||= []).push(gm.member_id)
  })
  const settlementGroups: SettlementGroup[] = (groupsRes.data || []).map((row: any) => ({
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    memberIds: membersByGroup[row.id] || [],
  }))

  const sponsorships: Sponsorship[] = (sponsorshipsRes.data || []).map((row: any) => ({
    id: row.id,
    tripId: row.trip_id,
    sponsorMemberId: row.sponsor_member_id,
    sponsoredMemberId: row.sponsored_member_id,
  }))

  const settlementStatuses = (settlementsRes.data || []).map((row: any) => ({
    id: row.id,
    fromMemberId: row.from_member_id,
    toMemberId: row.to_member_id,
    amount: Number(row.amount),
    status: row.status as PaymentStatus,
    paidAt: row.paid_at || undefined,
    confirmedAt: row.confirmed_at || undefined,
  }))

  return { trip, members, expenses, hotelExpenses, settlementGroups, sponsorships, settlementStatuses }
}
