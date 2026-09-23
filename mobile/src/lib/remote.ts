// ──────────────────────────────────────────────────────────────────────────────
// REMOTE SYNC LAYER (Supabase) — port of the web's src/lib/remote.ts
//
// The single source of truth for cross-device trips. Joining NEVER creates a
// trip — it only attaches a member to the existing trip row.
//
// Mobile hardening on top of the web version:
//  • push/delete functions report success, so the store can retry failures
//  • when supabase/migrations/20260923_mobile_media.sql is installed, writes go
//    through atomic + idempotent server functions (tm_push_*), so a dropped
//    connection can never leave an expense without its participants
//  • bill photos / UPI screenshots: Storage uploads + the `attachments` table
//
// Every function is null-safe: without Supabase credentials the app runs in
// local-only mode (single device), exactly like the web app.
// ──────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import { isUuid } from './utils'
import { MEDIA_BUCKET } from './config'
import { logSync } from './synclog'
import type {
  Trip, Member, Expense, HotelExpense, Settlement, ExpensePayer, PaymentStatus,
  ExpenseCategory, SplitType, Room, SettlementGroup, Sponsorship, Attachment,
} from '../types'

export function isRemoteEnabled(): boolean {
  return supabase !== null
}

/** Structured logging for join/sync events — makes failures diagnosable. */
export function joinLog(event: string, data?: Record<string, unknown>) {
  logSync(/error|fail|wrong|unavailable/i.test(event) ? 'error' : 'info', event, data ? JSON.stringify(data) : undefined)
}

interface PgError { message?: string; code?: string; details?: string; hint?: string }

/** Reports a swallowed push error instead of losing it. */
function pushLog(tag: string, error: PgError | null | undefined) {
  if (!error) {
    logSync('info', tag)
    return
  }
  logSync('error', tag, error.message)
}

const isDuplicateKey = (e: PgError | null | undefined) => e?.code === '23505'
/** PostgREST: function/table missing from the schema cache (migration not run). */
const isMissingFunction = (e: PgError | null | undefined) =>
  e?.code === 'PGRST202' || /could not find the function/i.test(e?.message ?? '')
const isMissingTable = (e: PgError | null | undefined) =>
  e?.code === 'PGRST205' || e?.code === '42P01' || /could not find the table|does not exist/i.test(e?.message ?? '')

/** Human-readable message for any thrown value. */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'The request timed out. Check your connection.'
    if (/network request failed|failed to fetch/i.test(err.message)) return 'You appear to be offline.'
    return err.message
  }
  return String(err)
}

// Server-side atomic write functions (tm_push_*). null = not probed yet.
let atomicRpc: boolean | null = null

async function callAtomic(fn: string, args: Record<string, unknown>): Promise<'ok' | 'missing' | 'failed'> {
  if (!supabase || atomicRpc === false) return 'missing'
  const { error } = await supabase.rpc(fn, args)
  if (!error) {
    atomicRpc = true
    return 'ok'
  }
  if (isMissingFunction(error)) {
    atomicRpc = false
    logSync('info', 'rpc.unavailable', `${fn} — using multi-step inserts (run the mobile migration for atomic writes)`)
    return 'missing'
  }
  pushLog(`push.${fn}`, error)
  return 'failed'
}

// ─── Notes envelope ────────────────────────────────────────────────────────────
// The DB schema has no columns for multi-payer or subcategory, so that metadata
// rides inside the `notes` TEXT column as a tagged JSON envelope (web format).

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
    if (!meta || typeof meta !== 'object') return { notes: raw }
    const result: { notes?: string; payers?: ExpensePayer[]; subcategory?: string } = {}
    if (typeof meta.n === 'string') result.notes = meta.n
    if (Array.isArray(meta.p)) {
      result.payers = meta.p.filter((x: any) => x && typeof x.memberId === 'string' && Number.isFinite(x.amount))
    }
    if (typeof meta.sc === 'string') result.subcategory = meta.sc
    return result
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

function attachmentFromRow(row: any): Attachment {
  return {
    id: row.id,
    tripId: row.trip_id,
    kind: row.kind === 'payment_proof' ? 'payment_proof' : 'bill',
    expenseId: row.expense_id || undefined,
    hotelExpenseId: row.hotel_expense_id || undefined,
    settlementId: row.settlement_id || undefined,
    fromMemberId: row.from_member_id || undefined,
    toMemberId: row.to_member_id || undefined,
    amount: row.amount != null ? Number(row.amount) : undefined,
    storagePath: row.storage_path,
    mimeType: row.mime_type || 'image/jpeg',
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    uploadedBy: row.uploaded_by || undefined,
    createdAt: row.created_at,
    upload: 'uploaded',
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

export async function remoteCreateTrip(trip: Trip, creator: Member): Promise<boolean> {
  if (!supabase || !isUuid(trip.id) || !isUuid(creator.id)) return false
  const { error: tripErr } = await supabase.from('trips').insert({
    id: trip.id,
    trip_code: trip.tripCode,
    name: trip.name,
    password: trip.password,
    status: trip.status,
    created_at: trip.createdAt,
  })
  if (tripErr && !isDuplicateKey(tripErr)) {
    joinLog('remote.createTrip.error', { tripId: trip.id, error: tripErr.message })
    return false
  }
  const { error: memErr } = await supabase.from('members').insert({
    id: creator.id,
    trip_id: trip.id,
    name: creator.name,
    mobile: creator.mobile,
    pin: creator.pin,
    upi_id: creator.upiId ?? null,
    upi_name: creator.upiName ?? null,
    avatar_color: creator.avatarColor,
    joined_at: creator.joinedAt,
  })
  if (memErr && !isDuplicateKey(memErr)) {
    joinLog('remote.createTrip.memberError', { tripId: trip.id, error: memErr.message })
    return false
  }
  await supabase.from('trips').update({ creator_id: creator.id }).eq('id', trip.id)
  joinLog('remote.createTrip.ok', { tripId: trip.id, tripCode: trip.tripCode })
  return true
}

/**
 * Guarantees a trip verified via an invite link also exists on the server —
 * WITHOUT ever creating a duplicate. It inserts the exact same trip row
 * (same id, same trip code) only when no row with that code exists yet.
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

/** Sets trips.creator_id when it is still NULL (healed/legacy trip rows). */
export async function remoteSetTripCreator(tripId: string, creatorId: string): Promise<void> {
  if (!supabase || !isUuid(tripId) || !isUuid(creatorId)) return
  const { error } = await supabase
    .from('trips')
    .update({ creator_id: creatorId })
    .eq('id', tripId)
    .is('creator_id', null)
  if (error) pushLog('push.tripCreator', error)
}

export async function remoteCloseTrip(tripId: string): Promise<boolean> {
  if (!supabase || !isUuid(tripId)) return true
  const { error } = await supabase.from('trips')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', tripId)
  pushLog('push.closeTrip', error)
  return !error
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

  const { data: existing, error: findErr } = await supabase
    .from('members')
    .select('*')
    .eq('trip_id', trip.id)
    .eq('mobile', details.mobile)
    .maybeSingle()
  if (findErr) {
    joinLog('join.lookupError', { tripId: trip.id, error: findErr.message })
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  if (existing) {
    joinLog('join.duplicatePrevented', { tripId: trip.id, tripCode: trip.tripCode })
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

export async function remoteUpdateMemberUpi(memberId: string, upiId: string, upiName?: string): Promise<boolean> {
  if (!supabase || !isUuid(memberId)) return true
  const { error } = await supabase.from('members')
    .update({ upi_id: upiId || null, upi_name: upiName ?? null })
    .eq('id', memberId)
  pushLog('push.memberUpi', error)
  return !error
}

export async function remoteAddManualMember(member: Member): Promise<boolean> {
  if (!supabase || !isUuid(member.id) || !isUuid(member.tripId)) return false
  const { error } = await supabase.from('members').insert({
    id: member.id,
    trip_id: member.tripId,
    name: member.name,
    mobile: member.mobile || `manual-${member.id.slice(0, 8)}`, // UNIQUE(trip_id, mobile) needs a placeholder
    pin: member.pin,
    upi_id: member.upiId ?? null,
    upi_name: member.upiName ?? null,
    avatar_color: member.avatarColor,
    joined_at: member.joinedAt,
  })
  if (isDuplicateKey(error)) return true
  pushLog('push.member', error)
  return !error
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

function participantRows(expense: Expense) {
  const splitMap: Record<string, { value: number; resolved: number }> = {}
  expense.splits.forEach(s => {
    splitMap[s.memberId] = { value: s.value, resolved: s.resolvedAmount ?? 0 }
  })
  const equalShare = expense.participants.length > 0 ? expense.amount / expense.participants.length : 0
  return expense.participants.map(memberId => ({
    expense_id: expense.id,
    member_id: memberId,
    split_value: splitMap[memberId]?.value ?? 0,
    resolved_amount: expense.splitType === 'equal'
      ? Math.round(equalShare * 100) / 100
      : splitMap[memberId]?.resolved ?? 0,
  }))
}

function expenseRow(expense: Expense) {
  return {
    id: expense.id,
    trip_id: expense.tripId,
    title: expense.title,
    amount: expense.amount,
    paid_by: expense.paidBy,
    category: expense.category,
    split_type: expense.splitType,
    notes: packNotes(expense),
    created_at: expense.createdAt,
  }
}

/** Uploads an expense with its participants. Idempotent: safe to retry. */
export async function remotePushExpense(expense: Expense): Promise<boolean> {
  if (!supabase || !isUuid(expense.id) || !isUuid(expense.tripId)) return false
  const rows = participantRows(expense)

  const atomic = await callAtomic('tm_push_expense', {
    p_expense: expenseRow(expense),
    p_participants: rows.map(({ expense_id: _e, ...r }) => r),
  })
  if (atomic === 'ok') return true
  if (atomic === 'failed') return false

  // Multi-step fallback. A duplicate expense row means an earlier attempt got
  // half-way — carry on and (re)insert any missing participants.
  const { error } = await supabase.from('expenses').insert(expenseRow(expense))
  if (error && !isDuplicateKey(error)) { pushLog('push.expense', error); return false }
  return remoteHealExpenseParticipants(expense)
}

/** Inserts any participant rows the server is missing (ignores existing ones). */
export async function remoteHealExpenseParticipants(expense: Expense): Promise<boolean> {
  if (!supabase || !isUuid(expense.id)) return false
  const rows = participantRows(expense)
  if (rows.length === 0) return true
  const { error } = await supabase
    .from('expense_participants')
    .upsert(rows, { onConflict: 'expense_id,member_id', ignoreDuplicates: true })
  pushLog('push.expenseParticipants', error)
  return !error
}

export async function remoteDeleteExpense(expenseId: string): Promise<boolean> {
  if (!supabase || !isUuid(expenseId)) return true
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  pushLog('push.deleteExpense', error)
  return !error
}

// ─── Hotel expenses ───────────────────────────────────────────────────────────

function hotelRow(hotel: HotelExpense) {
  return {
    id: hotel.id,
    trip_id: hotel.tripId,
    title: hotel.title,
    total_amount: hotel.totalAmount,
    paid_by: hotel.paidBy,
    created_at: hotel.createdAt,
  }
}

/** Uploads a hotel stay with its rooms + occupants. Idempotent: safe to retry. */
export async function remotePushHotelExpense(hotel: HotelExpense): Promise<boolean> {
  if (!supabase || !isUuid(hotel.id) || !isUuid(hotel.tripId)) return false

  const atomic = await callAtomic('tm_push_hotel_expense', {
    p_hotel: hotelRow(hotel),
    p_rooms: hotel.rooms.map(r => ({ id: r.id, name: r.name, cost: r.cost, occupant_ids: r.occupantIds })),
  })
  if (atomic === 'ok') return true
  if (atomic === 'failed') return false

  const { error } = await supabase.from('hotel_expenses').insert(hotelRow(hotel))
  if (error && !isDuplicateKey(error)) { pushLog('push.hotelExpense', error); return false }
  return remoteHealHotelRooms(hotel)
}

/** Inserts any rooms/occupants the server is missing (ignores existing ones). */
export async function remoteHealHotelRooms(hotel: HotelExpense): Promise<boolean> {
  if (!supabase || !isUuid(hotel.id)) return false
  for (const room of hotel.rooms) {
    const roomId = isUuid(room.id) ? room.id : undefined
    let finalRoomId = roomId
    if (roomId) {
      const { error } = await supabase.from('rooms').upsert({
        id: roomId,
        hotel_expense_id: hotel.id,
        trip_id: hotel.tripId,
        name: room.name,
        cost: room.cost,
      }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) { pushLog('push.room', error); return false }
    } else {
      const { data, error } = await supabase.from('rooms').insert({
        hotel_expense_id: hotel.id,
        trip_id: hotel.tripId,
        name: room.name,
        cost: room.cost,
      }).select('id').single()
      if (error) { pushLog('push.room', error); return false }
      finalRoomId = data?.id
    }
    if (finalRoomId && room.occupantIds.length > 0) {
      const { error } = await supabase.from('room_occupants').upsert(
        room.occupantIds.map(memberId => ({ room_id: finalRoomId, member_id: memberId })),
        { onConflict: 'room_id,member_id', ignoreDuplicates: true }
      )
      if (error) { pushLog('push.roomOccupants', error); return false }
    }
  }
  return true
}

export async function remoteDeleteHotelExpense(hotelId: string): Promise<boolean> {
  if (!supabase || !isUuid(hotelId)) return true
  const { error } = await supabase.from('hotel_expenses').delete().eq('id', hotelId)
  pushLog('push.deleteHotel', error)
  return !error
}

// ─── Settlement groups & sponsorships ─────────────────────────────────────────
// Couples/units and sponsorships affect how settlements are computed, so they
// must live on the server too — otherwise each device sees a different
// "who pays whom" for the same trip.

export async function remotePushSettlementGroup(group: SettlementGroup): Promise<boolean> {
  if (!supabase || !isUuid(group.id) || !isUuid(group.tripId)) return false
  const memberIds = group.memberIds.filter(isUuid)

  const atomic = await callAtomic('tm_push_settlement_group', {
    p_group: { id: group.id, trip_id: group.tripId, name: group.name },
    p_member_ids: memberIds,
  })
  if (atomic === 'ok') return true
  if (atomic === 'failed') return false

  const { error } = await supabase.from('settlement_groups').insert({
    id: group.id,
    trip_id: group.tripId,
    name: group.name,
  })
  if (error && !isDuplicateKey(error)) { pushLog('push.settlementGroup', error); return false }
  if (memberIds.length > 0) {
    const { error: gmErr } = await supabase.from('settlement_group_members').upsert(
      memberIds.map(member_id => ({ group_id: group.id, member_id })),
      { onConflict: 'group_id,member_id', ignoreDuplicates: true }
    )
    if (gmErr) { pushLog('push.settlementGroupMembers', gmErr); return false }
  }
  pushLog('push.settlementGroup', null)
  return true
}

export async function remoteDeleteSettlementGroup(groupId: string): Promise<boolean> {
  if (!supabase || !isUuid(groupId)) return true
  const { error } = await supabase.from('settlement_groups').delete().eq('id', groupId)
  pushLog('push.deleteGroup', error)
  return !error
}

export async function remotePushSponsorship(sp: Sponsorship): Promise<boolean> {
  if (!supabase || !isUuid(sp.id) || !isUuid(sp.tripId)) return false
  const { error } = await supabase.from('sponsorships').insert({
    id: sp.id,
    trip_id: sp.tripId,
    sponsor_member_id: sp.sponsorMemberId,
    sponsored_member_id: sp.sponsoredMemberId,
  })
  if (isDuplicateKey(error)) return true
  pushLog('push.sponsorship', error)
  return !error
}

export async function remoteDeleteSponsorship(sponsorshipId: string): Promise<boolean> {
  if (!supabase || !isUuid(sponsorshipId)) return true
  const { error } = await supabase.from('sponsorships').delete().eq('id', sponsorshipId)
  pushLog('push.deleteSponsorship', error)
  return !error
}

// ─── Settlement status ────────────────────────────────────────────────────────

export async function remotePushSettlementStatus(s: Settlement): Promise<boolean> {
  if (!supabase || !isUuid(s.tripId)) return false

  const patch = {
    amount: s.amount,
    status: s.status,
    paid_at: s.paidAt ?? null,
    confirmed_at: s.confirmedAt ?? null,
  }

  // 1) The same settlement already lives on the server → update it in place.
  if (isUuid(s.id)) {
    const { data: byId, error: findErr } = await supabase
      .from('settlements').select('id').eq('id', s.id).maybeSingle()
    if (findErr) { pushLog('push.settlementStatus', findErr); return false }
    if (byId) {
      const { error } = await supabase.from('settlements').update(patch).eq('id', s.id)
      pushLog('push.settlementStatus', error)
      return !error
    }
  }

  // 2) Reuse an OPEN (not confirmed) legacy row for this direction. Confirmed
  //    rows are immutable payment history — a newer due between the same two
  //    people must never overwrite one.
  const { data: open, error: openErr } = await supabase
    .from('settlements')
    .select('id')
    .eq('trip_id', s.tripId)
    .eq('from_member_id', s.fromMemberId)
    .eq('to_member_id', s.toMemberId)
    .neq('status', 'confirmed')
    .limit(1)
    .maybeSingle()
  if (openErr) { pushLog('push.settlementStatus', openErr); return false }

  if (open) {
    const { error } = await supabase.from('settlements').update(patch).eq('id', open.id)
    pushLog('push.settlementStatus', error)
    return !error
  }

  // 3) Brand-new payment row (keeps the local id so future pushes match).
  const { error } = await supabase.from('settlements').insert({
    ...(isUuid(s.id) ? { id: s.id } : {}),
    trip_id: s.tripId,
    from_member_id: s.fromMemberId,
    to_member_id: s.toMemberId,
    ...patch,
  })
  pushLog('push.settlementStatus', error)
  return !error
}

// ─── Attachments (bill photos, UPI screenshots) ───────────────────────────────

export type MediaErrorKind = 'setup' | 'transient'

/** Upload failure. 'setup' = the server isn't configured for media (bucket
 *  or policies missing) — retrying won't help until the migration is run. */
export class MediaError extends Error {
  kind: MediaErrorKind
  constructor(message: string, kind: MediaErrorKind) {
    super(message)
    this.kind = kind
  }
}

export function mediaPublicUrl(path: string | undefined): string | null {
  if (!supabase || !path) return null
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function remoteUploadMedia(path: string, body: ArrayBuffer, contentType: string): Promise<void> {
  if (!supabase) throw new MediaError('Cloud sync is not configured in this build.', 'setup')
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl: '31536000', // paths are unique per image, so cache "forever"
  })
  if (!error) return
  const status = String((error as { statusCode?: string; status?: number }).statusCode
    ?? (error as { status?: number }).status ?? '')
  // An earlier attempt already stored this exact object.
  if (status === '409' || /already exists|duplicate/i.test(error.message)) return
  const setup = status === '404' || status === '403' || status === '400'
    || /bucket not found|row-level security|not allowed|mime type/i.test(error.message)
  throw new MediaError(error.message, setup ? 'setup' : 'transient')
}

export async function remoteInsertAttachment(a: Attachment): Promise<void> {
  if (!supabase) throw new MediaError('Cloud sync is not configured in this build.', 'setup')
  const { error } = await supabase.from('attachments').insert({
    id: a.id,
    trip_id: a.tripId,
    kind: a.kind,
    expense_id: a.expenseId ?? null,
    hotel_expense_id: a.hotelExpenseId ?? null,
    settlement_id: a.settlementId && isUuid(a.settlementId) ? a.settlementId : null,
    from_member_id: a.fromMemberId ?? null,
    to_member_id: a.toMemberId ?? null,
    amount: a.amount ?? null,
    storage_path: a.storagePath,
    mime_type: a.mimeType,
    width: a.width ?? null,
    height: a.height ?? null,
    size_bytes: a.sizeBytes ?? null,
    uploaded_by: a.uploadedBy && isUuid(a.uploadedBy) ? a.uploadedBy : null,
    created_at: a.createdAt,
  })
  if (!error || isDuplicateKey(error)) return
  if (isMissingTable(error)) throw new MediaError('Bill storage is not set up on the server yet.', 'setup')
  // Foreign key: the expense/payment isn't on the server yet — retry later.
  throw new MediaError(error.message, 'transient')
}

export async function remoteDeleteAttachment(id: string): Promise<boolean> {
  if (!supabase || !isUuid(id)) return true
  const { error } = await supabase.from('attachments').delete().eq('id', id)
  if (error && isMissingTable(error)) return true
  pushLog('push.deleteAttachment', error)
  return !error
}

/** Removes stored images. Only orphaned objects (no attachments row) may be
 *  removed, so callers delete the row first. */
export async function remoteRemoveMedia(paths: string[]): Promise<boolean> {
  if (!supabase || paths.length === 0) return true
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths)
  if (error && /bucket not found/i.test(error.message)) return true
  pushLog('push.removeMedia', error ? { message: error.message } : null)
  return !error
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
  /** null when the attachments table isn't available (migration not run, or
   *  a transient error) — local attachments are then left untouched. */
  attachments: Attachment[] | null
  /** True when the server has no attachments table (mobile migration not run). */
  mediaTableMissing?: boolean
}

/** Pulls the full trip dataset from Supabase, mapped to local model types. */
export async function remoteFetchTripBundle(tripId: string): Promise<TripBundle | null> {
  if (!supabase || !isUuid(tripId)) return null

  const [tripRes, membersRes, expensesRes, participantsRes, hotelsRes, roomsRes, occupantsRes, settlementsRes, groupsRes, groupMembersRes, sponsorshipsRes, attachmentsRes] =
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
      supabase.from('attachments').select('*').eq('trip_id', tripId),
    ])

  // All-or-nothing for the core tables: a partially-failed pull must never be
  // merged — missing rows would be mistaken for remote deletions.
  const resByTable: Record<string, { error: { message: string } | null }> = {
    trips: tripRes, members: membersRes, expenses: expensesRes,
    expense_participants: participantsRes, hotel_expenses: hotelsRes, rooms: roomsRes,
    room_occupants: occupantsRes, settlements: settlementsRes,
    settlement_groups: groupsRes, settlement_group_members: groupMembersRes,
    sponsorships: sponsorshipsRes,
  }
  const failedTable = Object.entries(resByTable).find(([, r]) => r.error)
  if (failedTable) {
    pushLog(`pull.${failedTable[0]}`, failedTable[1].error)
    return null
  }
  if (!tripRes.data) return null

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

  // Attachments are optional: a server without the mobile migration still syncs.
  let attachments: Attachment[] | null = null
  let mediaTableMissing = false
  if (attachmentsRes.error) {
    if (isMissingTable(attachmentsRes.error)) mediaTableMissing = true
    else pushLog('pull.attachments', attachmentsRes.error)
  } else {
    attachments = (attachmentsRes.data || []).map(attachmentFromRow)
  }

  return {
    trip, members, expenses, hotelExpenses, settlementGroups, sponsorships, settlementStatuses,
    attachments, mediaTableMissing,
  }
}
