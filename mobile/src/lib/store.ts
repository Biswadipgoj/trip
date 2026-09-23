// App store — a port of the web's src/lib/store.ts (same actions, same
// settlement engine, same two-way sync), persisted to AsyncStorage.
//
// Mobile hardening on top of the web version:
//  • offline outbox: deletes / UPI edits / trip close made offline are queued
//    and retried every sync, so a pull can never resurrect or revert them
//  • self-healing uploads: an expense or stay that reached the server without
//    its participants/rooms is repaired, and never allowed to clobber the
//    complete local copy
//  • attachments (bill photos, UPI screenshots) that sync with their parents
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  Trip, Member, Expense, Settlement, TripSession, PaymentStatus,
  SettlementGroup, Sponsorship, HotelExpense, Attachment, OutboxEntry, OutboxOp,
} from '../types'
import {
  generateId, generateTripCode, getAvatarColor, isUuid, sameAmount,
  calculateBalances, calculateSettlements, applyConfirmedTransfers,
} from './utils'
import {
  isRemoteEnabled, remoteCreateTrip, remoteCloseTrip, remoteEnsureTrip,
  remoteAddManualMember, remoteUpdateMemberUpi,
  remotePushExpense, remoteDeleteExpense, remotePushHotelExpense, remoteDeleteHotelExpense,
  remotePushSettlementStatus, remotePushSettlementGroup, remoteDeleteSettlementGroup,
  remotePushSponsorship, remoteDeleteSponsorship, remoteSetTripCreator,
  remoteHealExpenseParticipants, remoteHealHotelRooms,
  remoteDeleteAttachment, remoteRemoveMedia, describeError,
  type TripBundle,
} from './remote'
import { logSync, useSyncStatus } from './synclog'

// Remote pushes are best-effort: cloud sync must never block or break local UX.
function fireAndForget(p: Promise<unknown>) {
  p.catch(err => logSync('error', 'push.rejected', describeError(err)))
}

// Deleting attachments must also delete their on-device image copies. The
// file-system code lives in uploads.ts (native module), injected at startup so
// this store stays importable in node tests.
let cleanLocalFiles: (uris: string[]) => void = () => {}
export function setLocalFileCleaner(fn: (uris: string[]) => void) {
  cleanLocalFiles = fn
}

// ──────────────────────────────────────────────────────────────────────────────
// LEGACY ID MIGRATION (web parity)
// Rewrites every non-UUID id to a real UUID (keeping names and amounts
// identical) and re-links all references, so old trips can sync.
// ──────────────────────────────────────────────────────────────────────────────
export function migrateLegacyIds<T extends Record<string, any>>(s: T): T {
  const idMap: Record<string, string> = {}
  const fresh = (id: unknown) => {
    if (typeof id === 'string' && id && !isUuid(id) && !idMap[id]) idMap[id] = generateId()
  }

  ;(s.trips ?? []).forEach((t: any) => fresh(t.id))
  ;(s.members ?? []).forEach((x: any) => fresh(x.id))
  ;(s.expenses ?? []).forEach((x: any) => fresh(x.id))
  ;(s.hotelExpenses ?? []).forEach((h: any) => {
    fresh(h.id)
    ;(h.rooms ?? []).forEach((r: any) => fresh(r.id))
  })
  ;(s.settlements ?? []).forEach((x: any) => fresh(x.id))
  ;(s.settlementGroups ?? []).forEach((x: any) => fresh(x.id))
  ;(s.sponsorships ?? []).forEach((x: any) => fresh(x.id))
  ;(s.attachments ?? []).forEach((x: any) => fresh(x.id))

  if (Object.keys(idMap).length === 0) return s

  const m = (id: string) => idMap[id] ?? id
  const mOpt = (id?: string) => (id ? m(id) : id)
  const mAll = (ids?: string[]) => ids?.map(m)

  return {
    ...s,
    trips: (s.trips ?? []).map((t: Trip) => ({
      ...t, id: m(t.id), creatorId: t.creatorId ? m(t.creatorId) : t.creatorId,
    })),
    members: (s.members ?? []).map((x: Member) => ({ ...x, id: m(x.id), tripId: m(x.tripId) })),
    expenses: (s.expenses ?? []).map((e: Expense) => ({
      ...e, id: m(e.id), tripId: m(e.tripId), paidBy: m(e.paidBy),
      payers: e.payers?.map(p => ({ ...p, memberId: m(p.memberId) })),
      participants: (e.participants ?? []).map(m),
      splits: (e.splits ?? []).map(sp => ({ ...sp, memberId: m(sp.memberId) })),
    })),
    hotelExpenses: (s.hotelExpenses ?? []).map((h: HotelExpense) => ({
      ...h, id: m(h.id), tripId: m(h.tripId), paidBy: m(h.paidBy),
      rooms: (h.rooms ?? []).map(r => ({ ...r, id: m(r.id), occupantIds: (r.occupantIds ?? []).map(m) })),
    })),
    settlements: (s.settlements ?? []).map((x: Settlement) => ({
      ...x, id: m(x.id), tripId: m(x.tripId),
      fromMemberId: m(x.fromMemberId), toMemberId: m(x.toMemberId),
      fromGroupIds: mAll(x.fromGroupIds), toGroupIds: mAll(x.toGroupIds),
    })),
    settlementGroups: (s.settlementGroups ?? []).map((g: SettlementGroup) => ({
      ...g, id: m(g.id), tripId: m(g.tripId), memberIds: (g.memberIds ?? []).map(m),
    })),
    sponsorships: (s.sponsorships ?? []).map((sp: Sponsorship) => ({
      ...sp, id: m(sp.id), tripId: m(sp.tripId),
      sponsorMemberId: m(sp.sponsorMemberId), sponsoredMemberId: m(sp.sponsoredMemberId),
    })),
    attachments: (s.attachments ?? []).map((a: Attachment) => ({
      ...a, id: m(a.id), tripId: m(a.tripId),
      expenseId: mOpt(a.expenseId), hotelExpenseId: mOpt(a.hotelExpenseId),
      settlementId: mOpt(a.settlementId), fromMemberId: mOpt(a.fromMemberId),
      toMemberId: mOpt(a.toMemberId), uploadedBy: mOpt(a.uploadedBy),
    })),
    session: s.session
      ? { ...s.session, tripId: m(s.session.tripId), memberId: m(s.session.memberId) }
      : s.session,
  }
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/**
 * Upgrades persisted state from older app versions. v0 = mobile ≤ 3.4.4
 * (unversioned): no attachments/outbox/synced map, and settlements only held
 * status changes — the settlement engine regenerates dues on first use.
 */
export function migratePersisted(persisted: unknown, _version: number): unknown {
  if (!persisted || typeof persisted !== 'object') return persisted
  const s = persisted as Record<string, any>
  const normalized = {
    ...s,
    trips: arr<Trip>(s.trips),
    members: arr<Member>(s.members),
    expenses: arr<Expense>(s.expenses).map(e => ({
      ...e, participants: arr<string>(e.participants), splits: arr(e.splits),
    })),
    hotelExpenses: arr<HotelExpense>(s.hotelExpenses).map(h => ({
      ...h, rooms: arr<HotelExpense['rooms'][number]>(h.rooms).map(r => ({ ...r, occupantIds: arr<string>(r.occupantIds) })),
    })),
    settlements: arr<Settlement>(s.settlements),
    settlementGroups: arr<SettlementGroup>(s.settlementGroups).map(g => ({ ...g, memberIds: arr<string>(g.memberIds) })),
    sponsorships: arr<Sponsorship>(s.sponsorships),
    attachments: arr<Attachment>(s.attachments),
    outbox: arr<OutboxEntry>(s.outbox),
    synced: s.synced && typeof s.synced === 'object' ? s.synced : {},
    session: s.session && typeof s.session === 'object' ? s.session : null,
    language: typeof s.language === 'string' ? s.language : 'en',
  }
  return migrateLegacyIds(normalized)
}

type TripScoped = Pick<AppState,
  'trips' | 'members' | 'expenses' | 'hotelExpenses' | 'settlements' | 'settlementGroups'
  | 'sponsorships' | 'attachments' | 'outbox' | 'session' | 'language'>

// Re-points every record of a local trip onto another trip id — used when the
// server's authoritative row for a trip code differs from a local legacy/clone
// copy, so the copies MERGE instead of living as a same-named duplicate.
function relinkTripRecords(s: TripScoped, fromId: string, toId: string) {
  const re = <T extends { tripId: string }>(x: T): T => (x.tripId === fromId ? { ...x, tripId: toId } : x)
  return {
    trips: s.trips.filter(t => t.id !== fromId),
    members: s.members.map(re),
    expenses: s.expenses.map(re),
    hotelExpenses: s.hotelExpenses.map(re),
    settlements: s.settlements.map(re),
    settlementGroups: s.settlementGroups.map(re),
    sponsorships: s.sponsorships.map(re),
    attachments: s.attachments.map(re),
    outbox: s.outbox.map(re),
    session: s.session && s.session.tripId === fromId ? { ...s.session, tripId: toId } : s.session,
  }
}

// Outbox ops that failed while ONLINE this many times are dropped (with a
// logged error) so one poisoned op can't block the queue forever.
const MAX_OUTBOX_ATTEMPTS = 25

async function runOutboxOp(entry: OutboxEntry): Promise<boolean> {
  const op = entry.op
  switch (op.kind) {
    case 'delete':
      switch (op.table) {
        case 'expenses': return remoteDeleteExpense(op.rowId)
        case 'hotel_expenses': return remoteDeleteHotelExpense(op.rowId)
        case 'settlement_groups': return remoteDeleteSettlementGroup(op.rowId)
        case 'sponsorships': return remoteDeleteSponsorship(op.rowId)
        case 'attachments': return remoteDeleteAttachment(op.rowId)
      }
      return true
    case 'memberUpi':
      return remoteUpdateMemberUpi(op.memberId, op.upiId, op.upiName)
    case 'closeTrip':
      return remoteCloseTrip(entry.tripId)
    case 'removeMedia':
      return remoteRemoveMedia(op.paths)
  }
}

let flushing: Promise<void> | null = null

export interface AppState {
  // ─── Data ───────────────────────────────────────────────────────────────────
  trips:            Trip[]
  members:          Member[]
  expenses:         Expense[]
  hotelExpenses:    HotelExpense[]
  settlements:      Settlement[]
  settlementGroups: SettlementGroup[]
  sponsorships:     Sponsorship[]
  attachments:      Attachment[]
  outbox:           OutboxEntry[]
  /** Ids ever seen in a server pull. Lets the sync layer tell "created locally,
   *  not yet uploaded" apart from "deleted on another device". */
  synced:           Record<string, true>

  // ─── Hydration ──────────────────────────────────────────────────────────────
  hydrated: boolean
  setHydrated: (v: boolean) => void

  // ─── Session & Language ─────────────────────────────────────────────────────
  session: TripSession | null
  language: string
  setLanguage: (lang: string) => void

  // ─── Trip Actions ───────────────────────────────────────────────────────────
  createTrip:  (name: string, creatorName: string, mobile: string, password: string, pin: string) => { trip: Trip; member: Member }
  joinTrip:    (tripCode: string, password: string, name: string, mobile: string, pin: string) => Member | null
  closeTrip:   (tripId: string) => void
  getTripById: (tripId: string) => Trip | undefined
  getTripByCode: (code: string) => Trip | undefined
  importTrip:   (trip: Trip) => void
  setTripBudget: (tripId: string, budget: number) => void
  mergeRemoteTrip: (bundle: TripBundle) => void
  /** Uploads local-only data (and the trip itself if missing) to the server,
   *  and repairs rows the server received incompletely. */
  pushTripToRemote: (tripId: string, remote: TripBundle | null) => Promise<void>
  /** Replaces a locally-joined member with the authoritative remote one. */
  upsertMember: (member: Member) => void

  // ─── Member Actions ─────────────────────────────────────────────────────────
  getMembersByTrip: (tripId: string) => Member[]
  getMemberById:    (id: string) => Member | undefined
  addMember:        (tripId: string, name: string) => Member
  updateMemberUpi:  (memberId: string, upiId: string, upiName?: string) => void

  // ─── Expense Actions ────────────────────────────────────────────────────────
  addExpense:        (data: Omit<Expense, 'id' | 'createdAt'>) => Expense
  deleteExpense:     (expenseId: string) => void
  getExpensesByTrip: (tripId: string) => Expense[]

  // ─── Hotel / Room Actions ───────────────────────────────────────────────────
  addHotelExpense:        (data: Omit<HotelExpense, 'id' | 'createdAt'>) => HotelExpense
  deleteHotelExpense:     (id: string) => void
  getHotelExpensesByTrip: (tripId: string) => HotelExpense[]

  // ─── Settlement Group Actions ───────────────────────────────────────────────
  addSettlementGroup:    (tripId: string, name: string, memberIds: string[]) => SettlementGroup
  removeSettlementGroup: (id: string) => void
  getGroupsByTrip:       (tripId: string) => SettlementGroup[]

  // ─── Sponsorship Actions ────────────────────────────────────────────────────
  addSponsorship:     (tripId: string, sponsorId: string, sponsoredId: string) => Sponsorship
  removeSponsorship:  (id: string) => void
  getSponsorshipsByTrip: (tripId: string) => Sponsorship[]

  // ─── Settlement Actions ─────────────────────────────────────────────────────
  generateSettlements:       (tripId: string) => void
  getSettlementsByTrip:      (tripId: string) => Settlement[]
  updateSettlementStatus:    (id: string, status: PaymentStatus) => void

  // ─── Attachments (bill photos, UPI screenshots) ─────────────────────────────
  addAttachment:    (a: Omit<Attachment, 'upload' | 'createdAt'> & { createdAt?: string }) => Attachment
  updateAttachment: (id: string, patch: Partial<Attachment>) => void
  removeAttachment: (id: string) => void

  // ─── Cloud-confirmed cache updates ──────────────────────────────────────────
  // Used by lib/cloud.ts AFTER Supabase accepted a write: they update the local
  // cache without pushing again and mark the rows as known to the server.
  applyTrip:            (trip: Trip, creator: Member) => void
  applyMember:          (member: Member) => void
  applyExpense:         (expense: Expense) => void
  applyHotelExpense:    (hotel: HotelExpense) => void
  applySettlementGroup: (group: SettlementGroup) => void
  /** Removes a row (and its bill photos) from the cache; returns the storage
   *  paths of images that should now be deleted from the bucket. */
  applyRemoval:         (table: 'expenses' | 'hotel_expenses' | 'settlement_groups' | 'attachments', id: string) => string[]
  applySettlement:      (settlement: Settlement) => void
  applyMemberUpi:       (memberId: string, upiId: string, upiName?: string) => void
  applyTripClosed:      (tripId: string, closedAt: string) => void

  // ─── Offline outbox ─────────────────────────────────────────────────────────
  enqueue:     (tripId: string, op: OutboxOp) => void
  flushOutbox: (tripId?: string) => Promise<void>

  // ─── Session Actions ────────────────────────────────────────────────────────
  setSession: (session: TripSession | null) => void
  login:      (tripCode: string, mobile: string, pin: string) => Member | null
  logout:     () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated:         false,
      setHydrated:      (v) => set({ hydrated: v }),

      trips:            [],
      members:          [],
      expenses:         [],
      hotelExpenses:    [],
      settlements:      [],
      settlementGroups: [],
      sponsorships:     [],
      attachments:      [],
      outbox:           [],
      synced:           {},
      session:          null,
      language:         'en',
      setLanguage:      (lang) => set({ language: lang }),

      // ─── Trips ──────────────────────────────────────────────────────────────
      createTrip: (name, creatorName, mobile, password, pin) => {
        const tripId   = generateId()
        const tripCode = generateTripCode()
        const memberId = generateId()

        const member: Member = {
          id: memberId, tripId, name: creatorName.trim(), mobile, pin,
          avatarColor: getAvatarColor(0),
          joinedAt: new Date().toISOString(),
        }
        const trip: Trip = {
          id: tripId, tripCode, name: name.trim(), password, creatorId: memberId,
          status: 'active', createdAt: new Date().toISOString(),
        }
        set(s => ({ trips: [...s.trips, trip], members: [...s.members, member] }))
        fireAndForget(remoteCreateTrip(trip, member))
        return { trip, member }
      },

      joinTrip: (tripCode, password, name, mobile, pin) => {
        const state = get()
        const trip = state.trips.find(t => t.tripCode === tripCode)
        if (!trip || trip.password !== password) return null

        const existing = state.members.find(m => m.tripId === trip.id && m.mobile === mobile)
        if (existing) return existing

        const count = state.members.filter(m => m.tripId === trip.id).length
        const member: Member = {
          id: generateId(), tripId: trip.id, name, mobile, pin,
          avatarColor: getAvatarColor(count),
          joinedAt: new Date().toISOString(),
        }
        set(s => ({ members: [...s.members, member] }))
        return member
      },

      closeTrip: (tripId) => {
        set(s => ({
          trips: s.trips.map(t =>
            t.id === tripId
              ? { ...t, status: 'closed' as const, closedAt: new Date().toISOString() }
              : t
          ),
        }))
        get().enqueue(tripId, { kind: 'closeTrip' })
      },

      getTripById:   (tripId) => get().trips.find(t => t.id === tripId),
      getTripByCode: (code)   => get().trips.find(t => t.tripCode === code.toUpperCase()),

      // Upsert by trip code — never creates a second copy. When the incoming
      // trip (usually the server's authoritative row) has a DIFFERENT id than
      // a local copy with the same code (legacy id or an old clone), the local
      // records are re-linked onto the incoming id so the histories merge.
      importTrip: (trip) => {
        set(s => {
          // Never bring a non-UUID id into the store — the cloud can't hold it.
          const incoming: Trip = isUuid(trip.id) ? trip : { ...trip, id: generateId() }
          const existing = s.trips.find(t => t.tripCode === incoming.tripCode)
          if (!existing) return { trips: [...s.trips, incoming] }

          const merged: Trip = {
            ...existing,
            ...incoming,
            budget: incoming.budget ?? existing.budget,
            creatorId: incoming.creatorId || existing.creatorId,
          }
          if (existing.id === incoming.id) {
            return { trips: s.trips.map(t => (t.id === existing.id ? merged : t)) }
          }
          const relinked = relinkTripRecords(s, existing.id, incoming.id)
          return { ...relinked, trips: [...relinked.trips.filter(t => t.id !== incoming.id), merged] }
        })
      },

      setTripBudget: (tripId, budget) => {
        set(s => ({
          trips: s.trips.map(t => (t.id === tripId ? { ...t, budget } : t)),
        }))
      },

      upsertMember: (member) => {
        set(s => {
          const exists = s.members.some(m => m.id === member.id)
          return {
            members: exists
              ? s.members.map(m => (m.id === member.id ? { ...m, ...member } : m))
              : [...s.members, member],
          }
        })
      },

      // Pull-sync: merge the authoritative remote dataset for one trip into the
      // local store. Remote wins on shared ids. Local items never seen on the
      // server (created offline / push pending) are kept; local items that WERE
      // on the server but are now gone were deleted on another device, so they
      // are dropped — deletions propagate.
      mergeRemoteTrip: (rawBundle) => {
        // Pending offline changes win over the (older) server state: a queued
        // delete must not be resurrected, a queued UPI edit not reverted.
        const pending = get().outbox.filter(o => o.tripId === rawBundle.trip.id)
        const pendingDeletes = new Set(
          pending.flatMap(o => (o.op.kind === 'delete' ? [o.op.rowId] : []))
        )
        const pendingUpi = new Map(
          pending.flatMap(o => (o.op.kind === 'memberUpi' ? [[o.op.memberId, o.op] as const] : []))
        )
        const pendingClose = pending.some(o => o.op.kind === 'closeTrip')
        const keep = <T extends { id: string }>(xs: T[]) => xs.filter(x => !pendingDeletes.has(x.id))

        const bundle: TripBundle = {
          ...rawBundle,
          trip: pendingClose ? { ...rawBundle.trip, status: 'closed' } : rawBundle.trip,
          members: rawBundle.members.map(m => {
            const upi = pendingUpi.get(m.id)
            return upi ? { ...m, upiId: upi.upiId || undefined, upiName: upi.upiName } : m
          }),
          expenses: keep(rawBundle.expenses),
          hotelExpenses: keep(rawBundle.hotelExpenses),
          settlementGroups: keep(rawBundle.settlementGroups),
          sponsorships: keep(rawBundle.sponsorships),
          attachments: rawBundle.attachments ? keep(rawBundle.attachments) : null,
        }
        const { trip, members, expenses, hotelExpenses, settlementGroups, sponsorships, settlementStatuses } = bundle
        const orphanedFiles: string[] = []

        set(state => {
          // Adopt clones: a local trip with the SAME code but a different id
          // (legacy id or an old duplicated join) is the same real-world trip —
          // re-link its records onto the server id so the histories merge.
          let s: AppState = state
          const clones = state.trips.filter(t => t.tripCode === trip.tripCode && t.id !== trip.id)
          for (const clone of clones) {
            s = { ...s, ...relinkTripRecords(s, clone.id, trip.id) }
          }

          const localTrip = s.trips.find(t => t.id === trip.id) ?? clones[0]
          // budget is device-local; creatorId may be empty on a freshly-healed
          // remote row — never let it wipe the locally-known admin.
          const mergedTrip: Trip = {
            ...trip,
            budget: localTrip?.budget,
            creatorId: trip.creatorId || localTrip?.creatorId || '',
          }

          const mergeById = <T extends { id: string }>(
            local: T[], remote: T[], tripScoped: (x: T) => boolean, preferLocal?: (remote: T, local: T) => boolean
          ) => {
            const localById = new Map(local.map(x => [x.id, x]))
            const remoteIds = new Set(remote.map(r => r.id))
            const kept = local.filter(
              x => !tripScoped(x) || (!remoteIds.has(x.id) && !s.synced[x.id])
            )
            const incoming = remote.map(r => {
              const l = localById.get(r.id)
              return l && preferLocal?.(r, l) ? l : r
            })
            return [...kept, ...incoming]
          }

          // A row that reached the server without its children (a dropped
          // connection mid-upload) must not overwrite the complete local copy;
          // pushTripToRemote repairs the server side.
          const expenseIncomplete = (r: Expense, l: Expense) =>
            r.participants.length === 0 && l.participants.length > 0
          const hotelIncomplete = (r: HotelExpense, l: HotelExpense) =>
            r.rooms.length === 0 && l.rooms.length > 0
          const groupIncomplete = (r: SettlementGroup, l: SettlementGroup) =>
            r.memberIds.length === 0 && l.memberIds.length > 0

          // Everything in this pull is now known to live on the server
          const synced = { ...s.synced }
          ;[...members, ...expenses, ...hotelExpenses, ...settlementGroups, ...sponsorships, ...(bundle.attachments ?? [])]
            .forEach(x => { synced[x.id] = true })

          const mergedExpenses = mergeById(s.expenses, expenses, e => e.tripId === trip.id, expenseIncomplete)
          const mergedHotels = mergeById(s.hotelExpenses, hotelExpenses, h => h.tripId === trip.id, hotelIncomplete)

          // Attachments: remote rows win on metadata, but the device keeps its
          // own local image copy. Only merged when the server has the table.
          let attachments = s.attachments
          if (bundle.attachments) {
            const localById = new Map(s.attachments.map(a => [a.id, a]))
            const remote = bundle.attachments.map(r => {
              const l = localById.get(r.id)
              return l ? { ...r, localUri: l.localUri } : r
            })
            attachments = mergeById(s.attachments, remote, a => a.tripId === trip.id)
          }
          // Drop bills whose expense/stay no longer exists (deleted elsewhere).
          const expenseIds = new Set(mergedExpenses.map(e => e.id))
          const hotelIds = new Set(mergedHotels.map(h => h.id))
          attachments = attachments.filter(a => {
            if (a.tripId !== trip.id || a.kind !== 'bill') return true
            const alive = a.expenseId ? expenseIds.has(a.expenseId) : a.hotelExpenseId ? hotelIds.has(a.hotelExpenseId) : false
            if (!alive && a.localUri) orphanedFiles.push(a.localUri)
            return alive
          })
          // Attachments deleted on another device: clean their local copies.
          s.attachments.forEach(a => {
            if (a.localUri && !attachments.some(x => x.id === a.id)) orphanedFiles.push(a.localUri)
          })

          return {
            synced,
            trips: s.trips.some(t => t.id === trip.id)
              ? s.trips.map(t => (t.id === trip.id ? mergedTrip : t))
              : [...s.trips, mergedTrip],
            members: mergeById(s.members, members, m => m.tripId === trip.id),
            expenses: mergedExpenses,
            hotelExpenses: mergedHotels,
            settlementGroups: mergeById(s.settlementGroups, settlementGroups, g => g.tripId === trip.id, groupIncomplete),
            sponsorships: mergeById(s.sponsorships, sponsorships, sp => sp.tripId === trip.id),
            attachments,
            // relinkTripRecords may have re-pointed these onto the server id
            settlements: s.settlements,
            outbox: s.outbox,
            session: s.session,
          }
        })
        if (orphanedFiles.length > 0) cleanLocalFiles([...new Set(orphanedFiles)])

        // Overlay remote payment state, then recompute dues from merged data.
        // The overlay is MONOTONIC: it only advances a status (pending→paid→
        // confirmed), never rolls one back, so a stale remote row can never
        // snap a freshly-confirmed payment back to "DUE".
        //
        // CONFIRMED payments are immutable transaction records (cash actually
        // moved), so they are imported BEFORE regeneration — the settlement
        // minimizer then runs on the residual balances.
        const remoteConfirmed = settlementStatuses.filter(r => r.status === 'confirmed')
        if (remoteConfirmed.length > 0) {
          set(s => {
            let tripRows = s.settlements.filter(x => x.tripId === trip.id)
            const otherRows = s.settlements.filter(x => x.tripId !== trip.id)
            remoteConfirmed.forEach(r => {
              const match = tripRows.find(x => x.id === r.id) ?? tripRows.find(
                x =>
                  x.fromMemberId === r.fromMemberId &&
                  x.toMemberId === r.toMemberId &&
                  sameAmount(x.amount, r.amount)
              )
              if (match?.status === 'confirmed') return // already recorded
              if (match) {
                tripRows = tripRows.map(x =>
                  x === match
                    ? {
                        ...x,
                        amount: r.amount, // trust the amount that was actually paid
                        status: 'confirmed' as const,
                        paidAt: x.paidAt ?? r.paidAt,
                        confirmedAt: x.confirmedAt ?? r.confirmedAt,
                      }
                    : x
                )
              } else {
                tripRows = [...tripRows, {
                  id: r.id,
                  tripId: trip.id,
                  fromMemberId: r.fromMemberId,
                  toMemberId: r.toMemberId,
                  amount: r.amount,
                  status: 'confirmed' as const,
                  paidAt: r.paidAt,
                  confirmedAt: r.confirmedAt,
                }]
              }
            })
            return { settlements: [...otherRows, ...tripRows] }
          })
        }

        get().generateSettlements(trip.id)

        // Advance matching dues to "paid". Amount must match — a remote "paid"
        // for an outdated amount refers to a payment that no longer exists.
        const remotePaid = settlementStatuses.filter(r => r.status === 'paid')
        if (remotePaid.length > 0) {
          set(s => ({
            settlements: s.settlements.map(x => {
              if (x.tripId !== trip.id || x.status !== 'pending') return x
              const remote = remotePaid.find(
                r =>
                  (r.id === x.id ||
                    (r.fromMemberId === x.fromMemberId && r.toMemberId === x.toMemberId)) &&
                  sameAmount(r.amount, x.amount)
              )
              if (!remote) return x
              return { ...x, status: 'paid' as const, paidAt: x.paidAt ?? remote.paidAt }
            }),
          }))
        }
      },

      // Up-sync: uploads the trip row itself when absent, then every local
      // item the server doesn't have yet, and repairs incomplete rows. Items
      // already synced once are skipped, so remote deletions don't get
      // resurrected.
      pushTripToRemote: async (tripId, remote) => {
        if (!isRemoteEnabled()) return
        const s = get()
        const trip = s.trips.find(t => t.id === tripId)
        if (!trip) return

        if (!remote) {
          const ok = await remoteEnsureTrip(trip)
          if (!ok) return
        }

        const onServer = (remoteIds: Set<string>, id: string) =>
          remoteIds.has(id) || !!s.synced[id]
        const queuedDeletes = new Set(
          s.outbox.flatMap(o => (o.tripId === tripId && o.op.kind === 'delete' ? [o.op.rowId] : []))
        )

        const memberIds = new Set((remote?.members ?? []).map(x => x.id))
        const remoteExpenses = new Map((remote?.expenses ?? []).map(x => [x.id, x]))
        const remoteHotels = new Map((remote?.hotelExpenses ?? []).map(x => [x.id, x]))
        const remoteGroups = new Map((remote?.settlementGroups ?? []).map(x => [x.id, x]))
        const sponsorshipIds = new Set((remote?.sponsorships ?? []).map(x => x.id))

        // Members first — expenses/settlements reference them via foreign keys
        const newMembers = s.members.filter(m => m.tripId === tripId && !onServer(memberIds, m.id))
        for (const m of newMembers) {
          try { await remoteAddManualMember(m) } catch { /* retried next sync */ }
        }

        // A healed trip row starts with creator_id NULL — restore the admin.
        if (trip.creatorId && (!remote || !remote.trip.creatorId)) {
          fireAndForget(remoteSetTripCreator(tripId, trip.creatorId))
        }

        const jobs: Promise<unknown>[] = []
        s.expenses.filter(e => e.tripId === tripId && !queuedDeletes.has(e.id)).forEach(e => {
          const r = remoteExpenses.get(e.id)
          if (!r && !s.synced[e.id]) jobs.push(remotePushExpense(e))
          else if (r && r.participants.length === 0 && e.participants.length > 0) {
            jobs.push(remoteHealExpenseParticipants(e))
          }
        })
        s.hotelExpenses.filter(h => h.tripId === tripId && !queuedDeletes.has(h.id)).forEach(h => {
          const r = remoteHotels.get(h.id)
          if (!r && !s.synced[h.id]) jobs.push(remotePushHotelExpense(h))
          else if (r && r.rooms.length === 0 && h.rooms.length > 0) jobs.push(remoteHealHotelRooms(h))
        })
        s.settlementGroups.filter(g => g.tripId === tripId && !queuedDeletes.has(g.id)).forEach(g => {
          const r = remoteGroups.get(g.id)
          if ((!r && !s.synced[g.id]) || (r && r.memberIds.length === 0 && g.memberIds.length > 0)) {
            jobs.push(remotePushSettlementGroup(g))
          }
        })
        s.sponsorships
          .filter(sp => sp.tripId === tripId && !queuedDeletes.has(sp.id) && !onServer(sponsorshipIds, sp.id))
          .forEach(sp => jobs.push(remotePushSponsorship(sp)))

        // Payment history: confirmed payments the server is missing, and
        // "paid" marks that never reached it (made offline).
        const remoteStatuses = remote?.settlementStatuses ?? []
        const matchesRemote = (x: Settlement, status?: PaymentStatus) => remoteStatuses.some(
          r => (r.id === x.id ||
            (r.fromMemberId === x.fromMemberId && r.toMemberId === x.toMemberId && sameAmount(r.amount, x.amount)))
            && (!status || r.status === status || r.status === 'confirmed')
        )
        s.settlements
          .filter(x => x.tripId === tripId && x.status === 'confirmed' && !matchesRemote(x))
          .forEach(x => jobs.push(remotePushSettlementStatus(x)))
        s.settlements
          .filter(x => x.tripId === tripId && x.status === 'paid' && !matchesRemote(x, 'paid'))
          .forEach(x => jobs.push(remotePushSettlementStatus(x)))

        await Promise.allSettled(jobs)
      },

      // ─── Members ────────────────────────────────────────────────────────────
      getMembersByTrip: (tripId) => get().members.filter(m => m.tripId === tripId),
      getMemberById:    (id)     => get().members.find(m => m.id === id),

      // Admin adds a member by name only — they can't log in (no mobile/PIN)
      // but participate fully in expenses and settlements.
      addMember: (tripId, name) => {
        const count = get().members.filter(m => m.tripId === tripId).length
        const member: Member = {
          id: generateId(), tripId, name: name.trim(), mobile: '', pin: '',
          avatarColor: getAvatarColor(count),
          joinedAt: new Date().toISOString(),
        }
        set(s => ({ members: [...s.members, member] }))
        fireAndForget(remoteAddManualMember(member))
        return member
      },

      updateMemberUpi: (memberId, upiId, upiName) => {
        const member = get().members.find(m => m.id === memberId)
        if (!member) return
        set(s => ({
          members: s.members.map(m =>
            m.id === memberId ? { ...m, upiId: upiId || undefined, upiName } : m
          ),
        }))
        get().enqueue(member.tripId, { kind: 'memberUpi', memberId, upiId, upiName })
      },

      // ─── Expenses ───────────────────────────────────────────────────────────
      addExpense: (data) => {
        if (!Number.isFinite(data.amount) || data.amount <= 0) {
          throw new Error('Expense amount must be positive')
        }
        const expense: Expense = { ...data, id: generateId(), createdAt: new Date().toISOString() }
        set(s => ({ expenses: [...s.expenses, expense] }))
        get().generateSettlements(data.tripId)
        fireAndForget(remotePushExpense(expense))
        return expense
      },

      deleteExpense: (expenseId) => {
        const expense = get().expenses.find(e => e.id === expenseId)
        if (!expense) return
        const bills = get().attachments.filter(a => a.expenseId === expenseId)
        set(s => ({
          expenses: s.expenses.filter(e => e.id !== expenseId),
          attachments: s.attachments.filter(a => a.expenseId !== expenseId),
        }))
        get().generateSettlements(expense.tripId)
        // The server cascades the attachment rows; the images are then removed.
        get().enqueue(expense.tripId, { kind: 'delete', table: 'expenses', rowId: expenseId })
        const paths = bills.flatMap(b => (b.storagePath ? [b.storagePath] : []))
        if (paths.length > 0) get().enqueue(expense.tripId, { kind: 'removeMedia', paths })
        cleanLocalFiles(bills.flatMap(b => (b.localUri ? [b.localUri] : [])))
      },

      getExpensesByTrip: (tripId) =>
        get().expenses
          .filter(e => e.tripId === tripId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

      // ─── Hotel Expenses ─────────────────────────────────────────────────────
      addHotelExpense: (data) => {
        if (!Number.isFinite(data.totalAmount) || data.totalAmount <= 0) {
          throw new Error('Hotel totalAmount must be positive')
        }
        const hotel: HotelExpense = {
          ...data,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        set(s => ({ hotelExpenses: [...s.hotelExpenses, hotel] }))
        get().generateSettlements(data.tripId)
        fireAndForget(remotePushHotelExpense(hotel))
        return hotel
      },

      deleteHotelExpense: (id) => {
        const hotel = get().hotelExpenses.find(h => h.id === id)
        if (!hotel) return
        const bills = get().attachments.filter(a => a.hotelExpenseId === id)
        set(s => ({
          hotelExpenses: s.hotelExpenses.filter(h => h.id !== id),
          attachments: s.attachments.filter(a => a.hotelExpenseId !== id),
        }))
        get().generateSettlements(hotel.tripId)
        get().enqueue(hotel.tripId, { kind: 'delete', table: 'hotel_expenses', rowId: id })
        const paths = bills.flatMap(b => (b.storagePath ? [b.storagePath] : []))
        if (paths.length > 0) get().enqueue(hotel.tripId, { kind: 'removeMedia', paths })
        cleanLocalFiles(bills.flatMap(b => (b.localUri ? [b.localUri] : [])))
      },

      getHotelExpensesByTrip: (tripId) =>
        get().hotelExpenses
          .filter(h => h.tripId === tripId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

      // ─── Settlement Groups ──────────────────────────────────────────────────
      addSettlementGroup: (tripId, name, memberIds) => {
        const group: SettlementGroup = { id: generateId(), tripId, name, memberIds }
        set(s => ({ settlementGroups: [...s.settlementGroups, group] }))
        get().generateSettlements(tripId)
        fireAndForget(remotePushSettlementGroup(group))
        return group
      },

      removeSettlementGroup: (id) => {
        const group = get().settlementGroups.find(g => g.id === id)
        if (!group) return
        set(s => ({ settlementGroups: s.settlementGroups.filter(g => g.id !== id) }))
        get().generateSettlements(group.tripId)
        get().enqueue(group.tripId, { kind: 'delete', table: 'settlement_groups', rowId: id })
      },

      getGroupsByTrip: (tripId) =>
        get().settlementGroups.filter(g => g.tripId === tripId),

      // ─── Sponsorships ───────────────────────────────────────────────────────
      addSponsorship: (tripId, sponsorMemberId, sponsoredMemberId) => {
        if (sponsorMemberId === sponsoredMemberId) {
          throw new Error('Self-sponsorship is not allowed')
        }
        // Check for duplicate or reverse
        const existing = get().sponsorships.find(
          sp =>
            sp.tripId === tripId &&
            ((sp.sponsorMemberId === sponsorMemberId && sp.sponsoredMemberId === sponsoredMemberId) ||
             (sp.sponsorMemberId === sponsoredMemberId && sp.sponsoredMemberId === sponsorMemberId))
        )
        if (existing) return existing

        const sp: Sponsorship = { id: generateId(), tripId, sponsorMemberId, sponsoredMemberId }
        set(s => ({ sponsorships: [...s.sponsorships, sp] }))
        get().generateSettlements(tripId)
        fireAndForget(remotePushSponsorship(sp))
        return sp
      },

      removeSponsorship: (id) => {
        const sp = get().sponsorships.find(x => x.id === id)
        if (!sp) return
        set(s => ({ sponsorships: s.sponsorships.filter(x => x.id !== id) }))
        get().generateSettlements(sp.tripId)
        get().enqueue(sp.tripId, { kind: 'delete', table: 'sponsorships', rowId: id })
      },

      getSponsorshipsByTrip: (tripId) =>
        get().sponsorships.filter(sp => sp.tripId === tripId),

      // ─── Settlement Generation (web parity) ─────────────────────────────────
      // Confirmed settlements are IMMUTABLE transaction records — money that
      // actually changed hands. Dues (pending/paid) are recomputed from the
      // live residual balances: residual = expense balances − confirmed
      // transfers, so every change cascades into a fresh minimal set.
      generateSettlements: (tripId) => {
        const state = get()
        const expenses      = state.expenses.filter(e => e.tripId === tripId)
        const hotelExpenses = state.hotelExpenses.filter(h => h.tripId === tripId)
        const members       = state.members.filter(m => m.tripId === tripId)
        const groups        = state.settlementGroups.filter(g => g.tripId === tripId)
        const sponsorships  = state.sponsorships.filter(sp => sp.tripId === tripId)

        const prevSettlements  = state.settlements.filter(s => s.tripId === tripId)
        const confirmedRecords = prevSettlements.filter(s => s.status === 'confirmed')

        const balances = applyConfirmedTransfers(
          calculateBalances(expenses, hotelExpenses, members),
          confirmedRecords,
          groups,
          sponsorships
        )

        const routes = calculateSettlements(balances, members, groups, sponsorships)

        // Keep due ids stable across regenerations (background sync re-runs
        // this often — unstable ids would break "Mark Paid" taps, remote status
        // pushes and payment-proof links). The "paid" marker only survives
        // when it is the SAME payment: same direction AND same amount.
        const prevDueByKey: Record<string, Settlement> = {}
        prevSettlements.forEach(s => {
          if (s.status !== 'confirmed') prevDueByKey[`${s.fromMemberId}→${s.toMemberId}`] = s
        })

        const dues: Settlement[] = routes.map(route => {
          const prev = prevDueByKey[`${route.fromMemberId}→${route.toMemberId}`]
          const samePayment = !!prev && prev.status === 'paid' && sameAmount(prev.amount, route.amount)
          return {
            id:           prev?.id ?? generateId(),
            tripId,
            fromMemberId: route.fromMemberId,
            toMemberId:   route.toMemberId,
            amount:       route.amount,
            status:       samePayment ? ('paid' as const) : ('pending' as const),
            paidAt:       samePayment ? prev.paidAt : undefined,
            fromGroupIds: route.fromMemberIds && route.fromMemberIds.length > 1 ? route.fromMemberIds : undefined,
            toGroupIds:   route.toMemberIds && route.toMemberIds.length > 1 ? route.toMemberIds : undefined,
          }
        })

        set(s => ({
          settlements: [
            ...s.settlements.filter(x => x.tripId !== tripId),
            ...confirmedRecords,
            ...dues,
          ],
        }))
      },

      getSettlementsByTrip: (tripId) =>
        get().settlements.filter(s => s.tripId === tripId),

      updateSettlementStatus: (settlementId, status) => {
        const now = new Date().toISOString()
        set(s => ({
          settlements: s.settlements.map(x =>
            x.id === settlementId
              ? {
                  ...x,
                  status,
                  paidAt:       status === 'paid' || status === 'confirmed' ? (x.paidAt ?? now) : x.paidAt,
                  confirmedAt:  status === 'confirmed' ? now : x.confirmedAt,
                }
              : x
          ),
        }))
        const updated = get().settlements.find(x => x.id === settlementId)
        if (updated) {
          fireAndForget(remotePushSettlementStatus(updated))
          // Confirming means cash moved — recompute the residual dues so the
          // change cascades across Dashboard, Payments, Members and Report.
          if (status === 'confirmed') get().generateSettlements(updated.tripId)
        }
      },

      // ─── Attachments ────────────────────────────────────────────────────────
      addAttachment: (a) => {
        const attachment: Attachment = {
          ...a,
          createdAt: a.createdAt ?? new Date().toISOString(),
          upload: 'pending',
          attempts: 0,
        }
        set(s => ({ attachments: [...s.attachments, attachment] }))
        return attachment
      },

      updateAttachment: (id, patch) => {
        set(s => ({ attachments: s.attachments.map(a => (a.id === id ? { ...a, ...patch } : a)) }))
      },

      removeAttachment: (id) => {
        const a = get().attachments.find(x => x.id === id)
        if (!a) return
        set(s => ({ attachments: s.attachments.filter(x => x.id !== id) }))
        if (a.storagePath || get().synced[id]) {
          // Row first: storage only lets orphaned images be removed.
          get().enqueue(a.tripId, { kind: 'delete', table: 'attachments', rowId: id })
          if (a.storagePath) get().enqueue(a.tripId, { kind: 'removeMedia', paths: [a.storagePath] })
        }
        if (a.localUri) cleanLocalFiles([a.localUri])
      },

      // ─── Cloud-confirmed cache updates ──────────────────────────────────────
      applyTrip: (trip, creator) => {
        set(s => ({
          trips: [...s.trips.filter(t => t.id !== trip.id && t.tripCode !== trip.tripCode), trip],
          members: [...s.members.filter(m => m.id !== creator.id), creator],
          synced: { ...s.synced, [creator.id]: true },
        }))
      },

      applyMember: (member) => {
        set(s => ({
          members: [...s.members.filter(m => m.id !== member.id), member],
          synced: { ...s.synced, [member.id]: true },
        }))
      },

      applyExpense: (expense) => {
        set(s => ({
          expenses: [...s.expenses.filter(e => e.id !== expense.id), expense],
          synced: { ...s.synced, [expense.id]: true },
        }))
        get().generateSettlements(expense.tripId)
      },

      applyHotelExpense: (hotel) => {
        set(s => ({
          hotelExpenses: [...s.hotelExpenses.filter(h => h.id !== hotel.id), hotel],
          synced: { ...s.synced, [hotel.id]: true },
        }))
        get().generateSettlements(hotel.tripId)
      },

      applySettlementGroup: (group) => {
        set(s => ({
          settlementGroups: [...s.settlementGroups.filter(g => g.id !== group.id), group],
          synced: { ...s.synced, [group.id]: true },
        }))
        get().generateSettlements(group.tripId)
      },

      applyRemoval: (table, id) => {
        const s = get()
        let tripId: string | undefined
        let bills: Attachment[] = []
        if (table === 'expenses') {
          tripId = s.expenses.find(e => e.id === id)?.tripId
          bills = s.attachments.filter(a => a.expenseId === id)
          set(st => ({ expenses: st.expenses.filter(e => e.id !== id), attachments: st.attachments.filter(a => a.expenseId !== id) }))
        } else if (table === 'hotel_expenses') {
          tripId = s.hotelExpenses.find(h => h.id === id)?.tripId
          bills = s.attachments.filter(a => a.hotelExpenseId === id)
          set(st => ({ hotelExpenses: st.hotelExpenses.filter(h => h.id !== id), attachments: st.attachments.filter(a => a.hotelExpenseId !== id) }))
        } else if (table === 'settlement_groups') {
          tripId = s.settlementGroups.find(g => g.id === id)?.tripId
          set(st => ({ settlementGroups: st.settlementGroups.filter(g => g.id !== id) }))
        } else {
          bills = s.attachments.filter(a => a.id === id)
          set(st => ({ attachments: st.attachments.filter(a => a.id !== id) }))
        }
        // A queued delete for this row is now redundant.
        set(st => ({ outbox: st.outbox.filter(o => !(o.op.kind === 'delete' && o.op.rowId === id)) }))
        if (tripId) get().generateSettlements(tripId)
        cleanLocalFiles(bills.flatMap(b => (b.localUri ? [b.localUri] : [])))
        return bills.flatMap(b => (b.storagePath ? [b.storagePath] : []))
      },

      applySettlement: (settlement) => {
        set(s => ({ settlements: s.settlements.map(x => (x.id === settlement.id ? settlement : x)) }))
        // Confirming means cash moved — recompute the residual dues.
        if (settlement.status === 'confirmed') get().generateSettlements(settlement.tripId)
      },

      applyMemberUpi: (memberId, upiId, upiName) => {
        set(s => ({
          members: s.members.map(m => (m.id === memberId ? { ...m, upiId: upiId || undefined, upiName } : m)),
          outbox: s.outbox.filter(o => !(o.op.kind === 'memberUpi' && o.op.memberId === memberId)),
        }))
      },

      applyTripClosed: (tripId, closedAt) => {
        set(s => ({
          trips: s.trips.map(t => (t.id === tripId ? { ...t, status: 'closed' as const, closedAt } : t)),
        }))
      },

      // ─── Offline outbox ─────────────────────────────────────────────────────
      enqueue: (tripId, op) => {
        if (!isRemoteEnabled()) return
        set(s => {
          // A newer UPI edit for the same member supersedes the queued one.
          const outbox = op.kind === 'memberUpi'
            ? s.outbox.filter(o => !(o.op.kind === 'memberUpi' && o.op.memberId === op.memberId))
            : s.outbox
          return {
            outbox: [...outbox, { id: generateId(), tripId, op, attempts: 0, createdAt: new Date().toISOString() }],
          }
        })
        fireAndForget(get().flushOutbox(tripId))
      },

      flushOutbox: async (tripId) => {
        if (!isRemoteEnabled()) return
        if (flushing) return flushing
        flushing = (async () => {
          const blocked = new Set<string>() // keep per-trip order after a failure
          for (const entry of [...get().outbox]) {
            if (tripId && entry.tripId !== tripId) continue
            if (blocked.has(entry.tripId)) continue
            let ok = false
            let error: string | undefined
            try {
              ok = await runOutboxOp(entry)
            } catch (err) {
              error = describeError(err)
            }
            if (ok) {
              set(s => ({ outbox: s.outbox.filter(x => x.id !== entry.id) }))
              continue
            }
            blocked.add(entry.tripId)
            const online = useSyncStatus.getState().online
            const attempts = entry.attempts + (online ? 1 : 0)
            if (attempts >= MAX_OUTBOX_ATTEMPTS) {
              logSync('error', 'outbox.dropped', `${entry.op.kind} after ${attempts} attempts: ${error ?? 'server rejected it'}`)
              set(s => ({ outbox: s.outbox.filter(x => x.id !== entry.id) }))
            } else {
              set(s => ({
                outbox: s.outbox.map(x => (x.id === entry.id ? { ...x, attempts, lastError: error } : x)),
              }))
            }
          }
        })().finally(() => { flushing = null })
        return flushing
      },

      // ─── Session ────────────────────────────────────────────────────────────
      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),

      login: (tripCode, mobile, pin) => {
        const state = get()
        const trip = state.trips.find(t => t.tripCode === tripCode)
        if (!trip) return null
        return state.members.find(
          m => m.tripId === trip.id && !!m.mobile && m.mobile === mobile && m.pin === pin
        ) || null
      },
    }),
    {
      name: 'tripmate_mobile_storage',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        trips: s.trips,
        members: s.members,
        expenses: s.expenses,
        hotelExpenses: s.hotelExpenses,
        settlements: s.settlements,
        settlementGroups: s.settlementGroups,
        sponsorships: s.sponsorships,
        attachments: s.attachments,
        outbox: s.outbox,
        synced: s.synced,
        session: s.session,
      }),
      migrate: (persisted, version) => migratePersisted(persisted, version) as never,
      onRehydrateStorage: () => (_state, error) => {
        if (error) logSync('error', 'storage.rehydrate', describeError(error))
        // An upload interrupted by the app being killed is retried from scratch.
        const attachments = useStore.getState().attachments
        if (attachments.some(a => a.upload === 'uploading')) {
          useStore.setState({
            attachments: attachments.map(a => (a.upload === 'uploading' ? { ...a, upload: 'pending' as const } : a)),
          })
        }
        useStore.setState({ hydrated: true })
      },
    }
  )
)
