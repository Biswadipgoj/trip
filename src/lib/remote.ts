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
import { logSync } from '@/lib/synclog'
import type {
  Trip, Member, Expense, HotelExpense, Settlement, ExpensePayer, PaymentStatus, PaymentMethod,
  ExpenseCategory, SplitType, Room, SettlementGroup, Sponsorship,
  Attachment, AttachmentKind,
} from '@/types'
import { tripsFind, tripsJoin, type ServerMember, type ServerTrip } from '@/lib/authClient'

export function isRemoteEnabled(): boolean {
  return supabase !== null
}

type PgError = { code?: string; message?: string }
const isDuplicateKey = (e: PgError | null | undefined) => e?.code === '23505'
const isMissingTable = (e: PgError | null | undefined) =>
  e?.code === 'PGRST205' || e?.code === '42P01' || /could not find the table|does not exist/i.test(e?.message ?? '')

/** Structured logging for join/sync events — makes failures diagnosable. */
export function joinLog(event: string, data?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.info(`[join] ${event}`, data ?? {})
  logSync(/error/i.test(event) ? 'error' : 'info', event, data ? JSON.stringify(data) : undefined)
}

/** Reports a swallowed push error to the Sync Doctor instead of losing it. */
function pushLog(tag: string, error: { message?: string } | null | undefined) {
  if (!error) {
    logSync('info', tag)
    return
  }
  // eslint-disable-next-line no-console
  console.warn(`[sync] ${tag} failed:`, error.message)
  logSync('error', tag, error.message)
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
    if (!meta || typeof meta !== 'object') return { notes: raw }
    const result: { notes?: string; payers?: ExpensePayer[]; subcategory?: string } = Object.create(null)
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
// Creating, finding and joining trips happens on the server (/api/trips/*),
// which checks the trip password and PINs and then logs this browser in.

function tripFromServer(t: ServerTrip, password: string): Trip {
  return { ...t, password }
}

function memberFromServer(m: ServerMember): Member {
  return { ...m, pin: '' }
}

/** The trip behind a code, once the server has checked its password. */
export async function remoteFindTrip(tripCode: string, password: string): Promise<{ trip: Trip; memberCount: number } | null> {
  if (!supabase) return null
  const res = await tripsFind(tripCode.toUpperCase(), password)
  if (res.ok) return { trip: tripFromServer(res.data.trip, password), memberCount: res.data.memberCount }
  if (res.status === 404) return null
  joinLog('remote.findTrip.error', { tripCode, status: res.status })
  throw new TripAccessError(res.error, res.status)
}

export class TripAccessError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
  }
}

/**
 * Puts a new trip on the server with its creator and logs this browser in to
 * it. Safe to repeat (e.g. after being offline): the server recognises the
 * same trip and creator.
 */
export async function remoteCreateTrip(trip: Trip, creator: Member): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!supabase || !isUuid(trip.id) || !isUuid(creator.id)) return { ok: true }
  const res = await tripsJoin({
    tripCode: trip.tripCode,
    password: trip.password,
    trip: { id: trip.id, name: trip.name, status: trip.status, createdAt: trip.createdAt },
    creator: true,
    member: {
      id: creator.id, name: creator.name, mobile: creator.mobile, pin: creator.pin,
      avatarColor: creator.avatarColor, joinedAt: creator.joinedAt,
    },
  })
  if (!res.ok) {
    joinLog('remote.createTrip.error', { tripId: trip.id, status: res.status })
    return res
  }
  joinLog('remote.createTrip.ok', { tripId: trip.id, tripCode: trip.tripCode })
  return { ok: true }
}

/**
 * True when this trip is on the server and this browser may open it. A trip
 * that only exists on this device can't be uploaded from here without its
 * creator's PIN; the create page does that while it still has the PIN.
 */
export async function remoteEnsureTrip(trip: Trip): Promise<boolean> {
  if (!supabase || !isUuid(trip.id)) return false
  const { data, error } = await supabase.from('trips').select('id').eq('id', trip.id).maybeSingle()
  if (error) {
    joinLog('remote.ensureTrip.findError', { tripId: trip.id, error: error.message })
    return false
  }
  return !!data
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

export const PIN_LOCKED_MESSAGE = 'Too many wrong PINs. This member is locked for 15 minutes; try again later.'

/**
 * Attaches a member to a trip on the server and logs this browser in to it.
 * Duplicate-safe: a number that already joined must enter the PIN chosen
 * then, and gets that same member back. `inviteTrip` lets the server create a
 * trip that so far only existed on the inviter's device.
 */
export async function remoteJoinTrip(
  trip: Trip,
  details: { name: string; mobile: string; pin: string; avatarColor: string },
  inviteTrip = false,
): Promise<{ member: Member; alreadyMember: boolean; trip: Trip }> {
  if (!supabase) throw new Error('Server sync is not configured.')
  const res = await tripsJoin({
    tripCode: trip.tripCode,
    password: trip.password,
    member: details,
    ...(inviteTrip ? { trip: { id: trip.id, name: trip.name, status: trip.status, createdAt: trip.createdAt } } : {}),
  })
  if (!res.ok) {
    joinLog('join.error', { tripId: trip.id, status: res.status })
    throw new TripAccessError(res.status === 0 ? OFFLINE_MESSAGE : res.error, res.status)
  }
  const { member, alreadyMember } = res.data
  joinLog(alreadyMember ? 'join.duplicatePrevented' : 'join.memberAdded', { tripId: res.data.trip.id, memberId: member.id })
  return { member: memberFromServer(member), alreadyMember, trip: tripFromServer(res.data.trip, trip.password) }
}

const OFFLINE_MESSAGE = 'Could not reach the server. Check your connection and try again.'

export async function remoteUpdateMemberUpi(memberId: string, upiId: string, upiName?: string): Promise<void> {
  if (!supabase || !isUuid(memberId)) return
  await supabase.from('members')
    .update({ upi_id: upiId, upi_name: upiName ?? null })
    .eq('id', memberId)
}

export async function remoteAddManualMember(member: Member): Promise<void> {
  if (!supabase || !isUuid(member.id) || !isUuid(member.tripId)) return
  const { error } = await supabase.from('members').insert({
    id: member.id,
    trip_id: member.tripId,
    name: member.name,
    mobile: member.mobile || `manual-${member.id.slice(0, 8)}`, // UNIQUE(trip_id, mobile) needs a placeholder
    // No PIN: PINs are only ever set by the server when someone joins.
    avatar_color: member.avatarColor,
    joined_at: member.joinedAt,
  })
  pushLog('push.member', error)
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
  if (error) { pushLog('push.expense', error); return }

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
  if (rows.length > 0) {
    const { error: partErr } = await supabase.from('expense_participants').insert(rows)
    if (partErr) { pushLog('push.expenseParticipants', partErr); return }
  }
  pushLog('push.expense', null)
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
  if (error) { pushLog('push.hotelExpense', error); return }

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
  if (error) { pushLog('push.settlementGroup', error); return }
  const rows = group.memberIds.filter(isUuid).map(member_id => ({
    group_id: group.id,
    member_id,
  }))
  if (rows.length > 0) {
    const { error: gmErr } = await supabase.from('settlement_group_members').insert(rows)
    if (gmErr) { pushLog('push.settlementGroupMembers', gmErr); return }
  }
  pushLog('push.settlementGroup', null)
}

export async function remoteDeleteSettlementGroup(groupId: string): Promise<void> {
  if (!supabase || !isUuid(groupId)) return
  await supabase.from('settlement_groups').delete().eq('id', groupId)
}

export async function remotePushSponsorship(sp: Sponsorship): Promise<void> {
  if (!supabase || !isUuid(sp.id) || !isUuid(sp.tripId)) return
  const { error } = await supabase.from('sponsorships').insert({
    id: sp.id,
    trip_id: sp.tripId,
    sponsor_member_id: sp.sponsorMemberId,
    sponsored_member_id: sp.sponsoredMemberId,
  })
  pushLog('push.sponsorship', error)
}

export async function remoteDeleteSponsorship(sponsorshipId: string): Promise<void> {
  if (!supabase || !isUuid(sponsorshipId)) return
  await supabase.from('sponsorships').delete().eq('id', sponsorshipId)
}

// ─── Settlement status ────────────────────────────────────────────────────────

export async function remotePushSettlementStatus(s: Settlement): Promise<void> {
  if (!supabase || !isUuid(s.tripId)) return

  const patch: Record<string, unknown> = {
    amount: s.amount,
    status: s.status,
    paid_at: s.paidAt ?? null,
    confirmed_at: s.confirmedAt ?? null,
    payment_method: s.status === 'pending' ? null : (s.method ?? null),
  }

  // 1) The same settlement already lives on the server → update it in place.
  if (isUuid(s.id)) {
    const { data: byId } = await supabase
      .from('settlements').select('id').eq('id', s.id).maybeSingle()
    if (byId) {
      const { error } = await withoutMissingMethod(patch, p => supabase!.from('settlements').update(p).eq('id', s.id))
      pushLog('push.settlementStatus', error)
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
    const { error } = await withoutMissingMethod(patch, p => supabase!.from('settlements').update(p).eq('id', open.id))
    pushLog('push.settlementStatus', error)
    return
  }

  // 3) Brand-new payment row (keeps the local id so future pushes match).
  const { error } = await withoutMissingMethod(patch, p => supabase!.from('settlements').insert({
    ...(isUuid(s.id) ? { id: s.id } : {}),
    trip_id: s.tripId,
    from_member_id: s.fromMemberId,
    to_member_id: s.toMemberId,
    ...p,
  }))
  pushLog('push.settlementStatus', error)
}

/**
 * Runs a settlements write; if the server doesn't have the payment_method
 * column yet (migration 20261001 not run), retries without it so payment
 * status still syncs.
 */
async function withoutMissingMethod(
  patch: Record<string, unknown>,
  write: (p: Record<string, unknown>) => PromiseLike<{ error: PgError | null }>,
): Promise<{ error: PgError | null }> {
  const first = await write(patch)
  const missing = first.error && (first.error.code === 'PGRST204' || /payment_method/.test(first.error.message ?? ''))
  if (!missing) return first
  const { payment_method: _dropped, ...rest } = patch
  return write(rest)
}

export async function remoteDeleteSettlementStatus(settlementId: string): Promise<boolean> {
  if (!supabase || !isUuid(settlementId)) return true
  const { error } = await supabase.from('settlements').delete().eq('id', settlementId)
  pushLog('push.deleteSettlementStatus', error)
  return !error
}

export async function remoteCleanStaleSettlements(tripId: string, validSettlementIds: string[]): Promise<boolean> {
  if (!supabase || !isUuid(tripId)) return true
  const validUuids = validSettlementIds.filter(isUuid)
  let query = supabase.from('settlements').delete().eq('trip_id', tripId)
  if (validUuids.length > 0) {
    query = query.not('id', 'in', `(${validUuids.join(',')})`)
  }
  const { error } = await query
  pushLog('push.cleanStaleSettlements', error)
  return !error
}

export async function remoteDeleteSettlementsByTrip(tripId: string): Promise<boolean> {
  if (!supabase || !isUuid(tripId)) return true
  const { error } = await supabase.from('settlements').delete().eq('trip_id', tripId)
  pushLog('push.deleteSettlementsByTrip', error)
  return !error
}

// ─── Attachments (bill photos, UPI screenshots) ───────────────────────────────

export const MEDIA_BUCKET = 'trip-media'

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

/** Paths the apps write: <trip uuid>/(bills|payments|payment_proofs)/<uuid>.<ext>.
 *  Anything else (e.g. a row pointing at '../other-trip/…') is never loaded. */
const MEDIA_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(bills|payments|payment_proofs)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/

export function isSafeMediaPath(path: string | undefined): path is string {
  return !!path && MEDIA_PATH.test(path)
}

export function mediaPublicUrl(path: string | undefined): string | null {
  if (!supabase || !isSafeMediaPath(path)) return null
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Time-limited URL — works even when the bucket is not public. */
export async function mediaSignedUrl(path: string | undefined, expiresInSeconds = 3600): Promise<string | null> {
  if (!supabase || !isSafeMediaPath(path)) return null
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresInSeconds)
  return error ? null : data?.signedUrl ?? null
}

/** Whether an image is stored at `path`; null when that can't be determined. */
export async function remoteMediaExists(path: string): Promise<boolean | null> {
  if (!supabase || !isSafeMediaPath(path)) return null
  const url = mediaPublicUrl(path)
  if (url && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) return true
      if (res.status === 404) return false
    } catch {
      // Fall through to list check
    }
  }
  const slash = path.lastIndexOf('/')
  const folder = path.slice(0, slash)
  const name = path.slice(slash + 1)
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { search: name, limit: 1 })
  if (error) return null
  return (data ?? []).some(o => o.name === name)
}

export async function remoteUploadMedia(path: string, body: ArrayBuffer | Blob, contentType: string): Promise<void> {
  if (!supabase) throw new MediaError('Cloud sync is not configured.', 'setup')
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '31536000', // paths are unique per image, so cache "forever"
  })
  if (!error) return
  const status = String((error as { statusCode?: string; status?: number }).statusCode
    ?? (error as { status?: number }).status ?? '')
  // An earlier attempt already stored this exact object.
  if (status === '409' || /already exists|duplicate/i.test(error.message)) return
  const setup = status === '404'
    || /bucket not found|row-level security|not allowed|mime type/i.test(error.message)
  throw new MediaError(error.message, setup ? 'setup' : 'transient')
}

export async function remoteInsertAttachment(a: Attachment): Promise<void> {
  if (!supabase) throw new MediaError('Cloud sync is not configured.', 'setup')
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
    method?: PaymentMethod
  }>
  /** null when the attachments table isn't available (migration not run, or
   *  a transient error) — local attachments are then left untouched. */
  attachments?: Attachment[] | null
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
  // merged — missing rows would be mistaken for remote deletions and wipe local data.
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
    method: row.payment_method === 'upi' || row.payment_method === 'cash' ? row.payment_method as PaymentMethod : undefined,
  }))

  // Attachments are optional: a server without the mobile media migration still syncs.
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

