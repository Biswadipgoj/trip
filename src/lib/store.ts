import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Trip, Member, Expense, Settlement, TripSession, PaymentStatus,
  SettlementGroup, Sponsorship, HotelExpense, Room, SplitType, ParticipantSplit,
  Attachment, AttachmentKind,
} from '@/types'
import {
  generateId, generateTripCode, getAvatarColor, isUuid,
  calculateBalances, calculateSettlements, applyConfirmedTransfers
} from '@/lib/utils'
import {
  isRemoteEnabled, remoteCreateTrip, remoteCloseTrip, remoteEnsureTrip,
  remoteAddManualMember, remoteUpdateMemberUpi,
  remotePushExpense, remoteDeleteExpense, remotePushHotelExpense, remoteDeleteHotelExpense,
  remotePushSettlementStatus, remotePushSettlementGroup, remoteDeleteSettlementGroup,
  remotePushSponsorship, remoteDeleteSponsorship, remoteSetTripCreator, TripBundle,
  remoteUploadMedia, remoteInsertAttachment, remoteDeleteAttachment, remoteRemoveMedia,
} from '@/lib/remote'
import { logSync } from '@/lib/synclog'

// Remote pushes are best-effort: cloud sync must never block or break local UX.
// Failures are reported to the Sync Doctor (/debug) so they stay diagnosable.
function fireAndForget(p: Promise<unknown>) {
  p.catch(err => {
    console.warn('[sync] push failed (local data is safe):', err)
    logSync('error', 'push.rejected', err instanceof Error ? err.message : String(err))
  })
}

// Two paise-tolerant amounts are "the same payment".
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.01

// ──────────────────────────────────────────────────────────────────────────────
// LEGACY ID MIGRATION
// Trips created before cloud sync used short non-UUID ids that Supabase's UUID
// columns can't store — every upload silently no-oped, so those trips could
// never sync or be joined. This rewrites every non-UUID id to a real UUID
// (keeping the trip code, names and amounts identical) and re-links all
// references. After migration the normal two-way sync uploads the whole trip.
// Runs once via the persist `migrate` hook (version 2 → 3).
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
  ;(s.attachments ?? []).forEach((a: any) => fresh(a.id))

  if (Object.keys(idMap).length === 0) return s

  const m = (id: string) => idMap[id] ?? id
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
      ...a,
      id: m(a.id),
      tripId: m(a.tripId),
      expenseId: a.expenseId ? m(a.expenseId) : undefined,
      hotelExpenseId: a.hotelExpenseId ? m(a.hotelExpenseId) : undefined,
      settlementId: a.settlementId ? m(a.settlementId) : undefined,
      fromMemberId: a.fromMemberId ? m(a.fromMemberId) : undefined,
      toMemberId: a.toMemberId ? m(a.toMemberId) : undefined,
      uploadedBy: a.uploadedBy ? m(a.uploadedBy) : undefined,
    })),
    session: s.session
      ? { ...s.session, tripId: m(s.session.tripId), memberId: m(s.session.memberId) }
      : s.session,
  }
}

// Re-points every record of a local trip onto another trip id — used when the
// server's authoritative row for a trip code differs from a local legacy/clone
// copy, so the copies MERGE instead of living as a same-named duplicate. The
// old trip row itself is dropped; the caller inserts/updates the new one.
function relinkTripRecords(
  s: Pick<AppState, 'trips' | 'members' | 'expenses' | 'hotelExpenses' | 'settlements' | 'settlementGroups' | 'sponsorships' | 'attachments' | 'session'>,
  fromId: string,
  toId: string
) {
  return {
    trips: s.trips.filter(t => t.id !== fromId),
    members: s.members.map(x => (x.tripId === fromId ? { ...x, tripId: toId } : x)),
    expenses: s.expenses.map(x => (x.tripId === fromId ? { ...x, tripId: toId } : x)),
    hotelExpenses: s.hotelExpenses.map(x => (x.tripId === fromId ? { ...x, tripId: toId } : x)),
    settlements: s.settlements.map(x => (x.tripId === fromId ? { ...x, tripId: toId } : x)),
    settlementGroups: s.settlementGroups.map(x => (x.tripId === fromId ? { ...x, tripId: toId } : x)),
    sponsorships: s.sponsorships.map(x => (x.tripId === fromId ? { ...x, tripId: toId } : x)),
    attachments: (s.attachments ?? []).map(x => (x.tripId === fromId ? { ...x, tripId: toId } : x)),
    session: s.session && s.session.tripId === fromId ? { ...s.session, tripId: toId } : s.session,
  }
}

interface AppState {
  // ─── Data ───────────────────────────────────────────────────────────────────
  trips:            Trip[]
  members:          Member[]
  expenses:         Expense[]
  hotelExpenses:    HotelExpense[]
  settlements:      Settlement[]
  settlementGroups: SettlementGroup[]
  sponsorships:     Sponsorship[]
  attachments:      Attachment[]
  /** Ids ever seen in a server pull. Lets the sync layer tell "created locally,
   *  not yet uploaded" apart from "deleted on another device". */
  synced:           Record<string, true>

  // ─── Hydration ──────────────────────────────────────────────────────────────
  hydrated: boolean
  setHydrated: (v: boolean) => void

  // ─── Session ────────────────────────────────────────────────────────────────
  session: TripSession | null

  // ─── Trip Actions ────────────────────────────────────────────────────────────
  createTrip:  (name: string, creatorName: string, mobile: string, password: string, pin: string) => { trip: Trip; member: Member }
  joinTrip:    (tripCode: string, password: string, name: string, mobile: string, pin: string) => Member | null
  closeTrip:   (tripId: string) => void
  getTripById: (tripId: string) => Trip | undefined
  getTripByCode: (code: string) => Trip | undefined
  importTrip:   (trip: Trip) => void
  setTripBudget: (tripId: string, budget: number) => void
  mergeRemoteTrip: (bundle: TripBundle) => void
  /** Uploads local-only data (and the trip itself if missing) to the server,
   *  so a trip created before cloud sync becomes fully shared. */
  pushTripToRemote: (tripId: string, remote: TripBundle | null) => Promise<void>
  /** Replaces a locally-joined member with the authoritative remote one. */
  upsertMember: (member: Member) => void

  // ─── Member Actions ─────────────────────────────────────────────────────────
  getMembersByTrip: (tripId: string) => Member[]
  getMemberById:    (id: string) => Member | undefined
  addMember:        (tripId: string, name: string) => Member
  updateMemberUpi:  (memberId: string, upiId: string, upiName?: string) => void

  // ─── Expense Actions ─────────────────────────────────────────────────────────
  addExpense:        (data: Omit<Expense, 'id' | 'createdAt'>) => Expense
  deleteExpense:     (expenseId: string) => void
  getExpensesByTrip: (tripId: string) => Expense[]

  // ─── Hotel / Room Actions ────────────────────────────────────────────────────
  addHotelExpense:        (data: Omit<HotelExpense, 'id' | 'createdAt'>) => HotelExpense
  deleteHotelExpense:     (id: string) => void
  getHotelExpensesByTrip: (tripId: string) => HotelExpense[]

  // ─── Settlement Group Actions ────────────────────────────────────────────────
  addSettlementGroup:    (tripId: string, name: string, memberIds: string[]) => SettlementGroup
  removeSettlementGroup: (id: string) => void
  getGroupsByTrip:       (tripId: string) => SettlementGroup[]

  // ─── Sponsorship Actions ─────────────────────────────────────────────────────
  addSponsorship:     (tripId: string, sponsorId: string, sponsoredId: string) => Sponsorship
  removeSponsorship:  (id: string) => void
  getSponsorshipsByTrip: (tripId: string) => Sponsorship[]

  // ─── Settlement Actions ──────────────────────────────────────────────────────
  generateSettlements:       (tripId: string) => void
  getSettlementsByTrip:      (tripId: string) => Settlement[]
  updateSettlementStatus:    (id: string, status: PaymentStatus) => void

  // ─── Attachment / Media Actions ──────────────────────────────────────────────
  addAttachment: (data: Omit<Attachment, 'id' | 'createdAt' | 'upload'> & { file?: File | Blob }) => Promise<Attachment>
  deleteAttachment: (id: string) => Promise<void>
  getAttachmentsByTrip: (tripId: string) => Attachment[]
  getAttachmentsByExpense: (expenseId: string) => Attachment[]
  getAttachmentsByHotelExpense: (hotelExpenseId: string) => Attachment[]
  getAttachmentsBySettlement: (opts: { settlementId?: string; fromMemberId?: string; toMemberId?: string }) => Attachment[]

  // ─── Session Actions ─────────────────────────────────────────────────────────
  setSession: (session: TripSession | null) => void
  login:      (tripCode: string, mobile: string, pin: string) => Member | null
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
      synced:           {},
      session:          null,


      // ─── Trips ──────────────────────────────────────────────────────────────
      createTrip: (name, creatorName, mobile, password, pin) => {
        const tripId   = generateId()
        const tripCode = generateTripCode()
        const memberId = generateId()

        const member: Member = {
          id: memberId, tripId, name: creatorName, mobile, pin,
          avatarColor: getAvatarColor(0),
          joinedAt: new Date().toISOString(),
        }
        const trip: Trip = {
          id: tripId, tripCode, name, password, creatorId: memberId,
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
          attachments: s.attachments.filter(a => a.tripId !== tripId),
        }))
        fireAndForget(remoteCloseTrip(tripId))
      },

      getTripById:   (tripId) => get().trips.find(t => t.id === tripId),
      getTripByCode: (code)   => get().trips.find(t => t.tripCode === code),

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
      mergeRemoteTrip: (bundle) => {
        const { trip, members, expenses, hotelExpenses, settlementGroups, sponsorships, settlementStatuses } = bundle
        set(state => {
          let s = state
          const clones = state.trips.filter(t => t.tripCode === trip.tripCode && t.id !== trip.id)
          for (const clone of clones) {
            s = { ...s, ...relinkTripRecords(s, clone.id, trip.id) }
          }

          const localTrip = s.trips.find(t => t.id === trip.id) ?? clones[0]
          const mergedTrip: Trip = {
            ...trip,
            budget: localTrip?.budget,
            creatorId: trip.creatorId || localTrip?.creatorId || '',
          }

          const mergeById = <T extends { id: string }>(local: T[], remote: T[], tripScoped: (x: T) => boolean) => {
            const remoteIds = new Set(remote.map(r => r.id))
            const kept = local.filter(
              x => !tripScoped(x) || (!remoteIds.has(x.id) && !s.synced[x.id])
            )
            return [...kept, ...remote]
          }

          const synced = { ...s.synced }
          ;[...members, ...expenses, ...hotelExpenses, ...settlementGroups, ...sponsorships]
            .forEach(x => { synced[x.id] = true })

          const rawBundle = bundle as any
          const remoteAttachments = rawBundle.attachments as Attachment[] | null | undefined
          let attachments = s.attachments
          if (remoteAttachments && Array.isArray(remoteAttachments)) {
            attachments = mergeById(s.attachments, remoteAttachments, a => a.tripId === trip.id)
            remoteAttachments.forEach(a => { synced[a.id] = true })
          }

          const mergedMembers = mergeById(s.members, members, m => m.tripId === trip.id)
          const mergedExpenses = mergeById(s.expenses, expenses, e => e.tripId === trip.id)
          const mergedHotels = mergeById(s.hotelExpenses, hotelExpenses, h => h.tripId === trip.id)
          const mergedGroups = mergeById(s.settlementGroups, settlementGroups, g => g.tripId === trip.id)
          const mergedSponsorships = mergeById(s.sponsorships, sponsorships, sp => sp.tripId === trip.id)

          // 1. Incorporate remote confirmed payments
          let tripRows = s.settlements.filter(x => x.tripId === trip.id)
          const otherRows = s.settlements.filter(x => x.tripId !== trip.id)
          const remoteConfirmed = settlementStatuses.filter(r => r.status === 'confirmed')

          remoteConfirmed.forEach(r => {
            const match = tripRows.find(x => x.id === r.id) ?? tripRows.find(
              x =>
                x.fromMemberId === r.fromMemberId &&
                x.toMemberId === r.toMemberId &&
                sameAmount(x.amount, r.amount)
            )
            if (match?.status === 'confirmed') return
            if (match) {
              tripRows = tripRows.map(x =>
                x === match
                  ? {
                      ...x,
                      amount: r.amount,
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

          // 2. Generate minimal settlements directly in memory
          const confirmedRecords = tripRows.filter(s => s.status === 'confirmed')
          const tripExp = mergedExpenses.filter(e => e.tripId === trip.id)
          const tripHot = mergedHotels.filter(h => h.tripId === trip.id)
          const tripMem = mergedMembers.filter(m => m.tripId === trip.id)
          const tripGrp = mergedGroups.filter(g => g.tripId === trip.id)
          const tripSp  = mergedSponsorships.filter(sp => sp.tripId === trip.id)

          const balances = applyConfirmedTransfers(
            calculateBalances(tripExp, tripHot, tripMem),
            confirmedRecords,
            tripGrp,
            tripSp
          )
          const routes = calculateSettlements(balances, tripMem, tripGrp, tripSp)

          const prevDueByKey: Record<string, Settlement> = {}
          tripRows.forEach(row => {
            if (row.status !== 'confirmed') prevDueByKey[`${row.fromMemberId}→${row.toMemberId}`] = row
          })

          const remotePaid = settlementStatuses.filter(r => r.status === 'paid')
          const dues: Settlement[] = routes.map(route => {
            const prev = prevDueByKey[`${route.fromMemberId}→${route.toMemberId}`]
            const samePayment = !!prev && prev.status === 'paid' && sameAmount(prev.amount, route.amount)
            const remote = remotePaid.find(
              r =>
                (r.id === prev?.id || (r.fromMemberId === route.fromMemberId && r.toMemberId === route.toMemberId)) &&
                sameAmount(r.amount, route.amount)
            )
            const isPaid = samePayment || !!remote
            return {
              id: prev?.id ?? generateId(),
              tripId: trip.id,
              fromMemberId: route.fromMemberId,
              toMemberId: route.toMemberId,
              amount: route.amount,
              status: isPaid ? ('paid' as const) : ('pending' as const),
              paidAt: isPaid ? (prev?.paidAt ?? remote?.paidAt) : undefined,
              fromGroupIds: route.fromMemberIds && route.fromMemberIds.length > 1 ? route.fromMemberIds : undefined,
              toGroupIds: route.toMemberIds && route.toMemberIds.length > 1 ? route.toMemberIds : undefined,
            }
          })

          return {
            synced,
            trips: s.trips.some(t => t.id === trip.id)
              ? s.trips.map(t => (t.id === trip.id ? mergedTrip : t))
              : [...s.trips, mergedTrip],
            members: mergedMembers,
            expenses: mergedExpenses,
            hotelExpenses: mergedHotels,
            settlementGroups: mergedGroups,
            sponsorships: mergedSponsorships,
            attachments,
            settlements: [...otherRows, ...confirmedRecords, ...dues],
            session: s.session,
          }
        })
      },

      // Up-sync: the missing half of cross-device linking. A trip created
      // before cloud sync (or while offline) only exists locally — joiners
      // would get an empty shell with the same name. This uploads the trip row
      // itself when absent, then every local item the server doesn't have yet.
      // Items already synced once are skipped, so remote deletions don't get
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

        const memberIds = new Set((remote?.members ?? []).map(x => x.id))
        const expenseIds = new Set((remote?.expenses ?? []).map(x => x.id))
        const hotelIds = new Set((remote?.hotelExpenses ?? []).map(x => x.id))
        const groupIds = new Set((remote?.settlementGroups ?? []).map(x => x.id))
        const sponsorshipIds = new Set((remote?.sponsorships ?? []).map(x => x.id))

        // Members first — expenses/settlements reference them via foreign keys
        const newMembers = s.members.filter(m => m.tripId === tripId && !onServer(memberIds, m.id))
        for (const m of newMembers) {
          try { await remoteAddManualMember(m) } catch { /* retried next sync */ }
        }

        // A healed trip row starts with creator_id NULL — restore the admin
        // once their member row exists, or the creator loses admin controls
        // on the next pull.
        if (trip.creatorId && (!remote || !remote.trip.creatorId)) {
          fireAndForget(remoteSetTripCreator(tripId, trip.creatorId))
        }

        s.expenses
          .filter(e => e.tripId === tripId && !onServer(expenseIds, e.id))
          .forEach(e => fireAndForget(remotePushExpense(e)))
        s.hotelExpenses
          .filter(h => h.tripId === tripId && !onServer(hotelIds, h.id))
          .forEach(h => fireAndForget(remotePushHotelExpense(h)))
        s.settlementGroups
          .filter(g => g.tripId === tripId && !onServer(groupIds, g.id))
          .forEach(g => fireAndForget(remotePushSettlementGroup(g)))
        s.sponsorships
          .filter(sp => sp.tripId === tripId && !onServer(sponsorshipIds, sp.id))
          .forEach(sp => fireAndForget(remotePushSponsorship(sp)))

        // Confirmed payments are part of the trip's history — upload any the
        // server is missing so balances agree everywhere.
        const remoteStatuses = remote?.settlementStatuses ?? []
        s.settlements
          .filter(x => x.tripId === tripId && x.status === 'confirmed')
          .filter(x => !remoteStatuses.some(
            r => r.id === x.id ||
              (r.fromMemberId === x.fromMemberId && r.toMemberId === x.toMemberId && sameAmount(r.amount, x.amount))
          ))
          .forEach(x => fireAndForget(remotePushSettlementStatus(x)))

        // Attachments
        const rawRemote = remote as any
        const remoteAtts = (rawRemote?.attachments ?? []) as Attachment[]
        const attachmentIds = new Set(remoteAtts.map(x => x.id))
        s.attachments
          .filter(a => a.tripId === tripId && !onServer(attachmentIds, a.id))
          .forEach(a => fireAndForget(remoteInsertAttachment(a)))
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
        set(s => ({
          members: s.members.map(m =>
            m.id === memberId ? { ...m, upiId, upiName } : m
          ),
        }))
        fireAndForget(remoteUpdateMemberUpi(memberId, upiId, upiName))
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
        const relatedAtts = get().attachments.filter(a => a.expenseId === expenseId)
        set(s => ({
          expenses: s.expenses.filter(e => e.id !== expenseId),
          attachments: s.attachments.filter(a => a.expenseId !== expenseId),
        }))
        if (expense) get().generateSettlements(expense.tripId)
        fireAndForget(remoteDeleteExpense(expenseId))
        relatedAtts.forEach(a => {
          fireAndForget(remoteDeleteAttachment(a.id))
          if (a.storagePath) fireAndForget(remoteRemoveMedia([a.storagePath]))
        })
      },

      getExpensesByTrip: (tripId) =>
        get().expenses
          .filter(e => e.tripId === tripId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

      // ─── Hotel Expenses ──────────────────────────────────────────────────────
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
        const relatedAtts = get().attachments.filter(a => a.hotelExpenseId === id)
        set(s => ({
          hotelExpenses: s.hotelExpenses.filter(h => h.id !== id),
          attachments: s.attachments.filter(a => a.hotelExpenseId !== id),
        }))
        if (hotel) get().generateSettlements(hotel.tripId)
        fireAndForget(remoteDeleteHotelExpense(id))
        relatedAtts.forEach(a => {
          fireAndForget(remoteDeleteAttachment(a.id))
          if (a.storagePath) fireAndForget(remoteRemoveMedia([a.storagePath]))
        })
      },

      getHotelExpensesByTrip: (tripId) =>
        get().hotelExpenses
          .filter(h => h.tripId === tripId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

      // ─── Settlement Groups ───────────────────────────────────────────────────
      addSettlementGroup: (tripId, name, memberIds) => {
        const group: SettlementGroup = { id: generateId(), tripId, name, memberIds }
        set(s => ({ settlementGroups: [...s.settlementGroups, group] }))
        get().generateSettlements(tripId)
        fireAndForget(remotePushSettlementGroup(group))
        return group
      },

      removeSettlementGroup: (id) => {
        const group = get().settlementGroups.find(g => g.id === id)
        set(s => ({ settlementGroups: s.settlementGroups.filter(g => g.id !== id) }))
        if (group) get().generateSettlements(group.tripId)
        fireAndForget(remoteDeleteSettlementGroup(id))
      },

      getGroupsByTrip: (tripId) =>
        get().settlementGroups.filter(g => g.tripId === tripId),

      // ─── Sponsorships ────────────────────────────────────────────────────────
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
        const sp = get().sponsorships.find(s => s.id === id)
        set(s => ({ sponsorships: s.sponsorships.filter(x => x.id !== id) }))
        if (sp) get().generateSettlements(sp.tripId)
        fireAndForget(remoteDeleteSponsorship(id))
      },

      getSponsorshipsByTrip: (tripId) =>
        get().sponsorships.filter(sp => sp.tripId === tripId),

      // ─── Settlement Generation ───────────────────────────────────────────────
      // Confirmed settlements are IMMUTABLE transaction records — money that
      // actually changed hands. They are never re-amounted or regenerated.
      // Dues (pending/paid) are recomputed from the live residual balances:
      //   residual = expense balances − confirmed transfers
      // so adding/editing/deleting an expense or confirming a payment always
      // cascades into a fresh minimal-transaction set.
      generateSettlements: (tripId) => {
        const state = get()
        const expenses      = state.expenses.filter(e => e.tripId === tripId)
        const hotelExpenses = state.hotelExpenses.filter(h => h.tripId === tripId)
        const members       = state.members.filter(m => m.tripId === tripId)
        const groups        = state.settlementGroups.filter(g => g.tripId === tripId)
        const sponsorships  = state.sponsorships.filter(sp => sp.tripId === tripId)

        const prevSettlements  = state.settlements.filter(s => s.tripId === tripId)
        const confirmedRecords = prevSettlements.filter(s => s.status === 'confirmed')

        // 1. Raw expense balances, minus cash already moved by confirmed
        //    payments. Groups/sponsorships are passed so a couple's combined
        //    payment clears BOTH members' balances, not just the payer's.
        const balances = applyConfirmedTransfers(
          calculateBalances(expenses, hotelExpenses, members),
          confirmedRecords,
          groups,
          sponsorships
        )

        // 2. Minimal-transaction routes over the residual debt
        //    (applies sponsorships + settlement groups internally)
        const routes = calculateSettlements(balances, members, groups, sponsorships)

        // Keep due ids stable across regenerations (background sync re-runs
        // this every 15s — unstable ids would break "Mark Paid" clicks and
        // remote status pushes). The "paid" marker only survives when it is
        // the SAME payment: same direction AND same amount. If the amount
        // changed, it is a different due and returns to pending.
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
            // Snapshot the members behind each side so a confirmed couple
            // payment keeps settling everyone even if the group is deleted.
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
                  paidAt:       status === 'paid'      ? now : x.paidAt,
                  confirmedAt:  status === 'confirmed'  ? now : x.confirmedAt,
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

      // ─── Attachments ──────────────────────────────────────────────────────────
      addAttachment: async (data) => {
        const id = generateId()
        const tripId = data.tripId
        const now = new Date().toISOString()
        const file = data.file
        const ext = data.mimeType.includes('/') ? data.mimeType.split('/')[1].replace('jpeg', 'jpg') : 'jpg'
        const storagePath = `${tripId}/${data.kind}s/${id}.${ext}`

        let localUri = data.localUri
        if (!localUri && file && typeof window !== 'undefined' && window.URL) {
          try {
            localUri = URL.createObjectURL(file)
          } catch { /* ignore */ }
        }

        const attachment: Attachment = {
          id,
          tripId,
          kind: data.kind,
          expenseId: data.expenseId,
          hotelExpenseId: data.hotelExpenseId,
          settlementId: data.settlementId,
          fromMemberId: data.fromMemberId,
          toMemberId: data.toMemberId,
          amount: data.amount,
          storagePath,
          localUri,
          mimeType: data.mimeType,
          width: data.width,
          height: data.height,
          sizeBytes: data.sizeBytes ?? (file ? file.size : undefined),
          uploadedBy: data.uploadedBy,
          createdAt: now,
          upload: file ? 'uploading' : 'uploaded',
        }

        set(s => ({ attachments: [...s.attachments, attachment] }))

        if (file) {
          try {
            const buf = await file.arrayBuffer()
            await remoteUploadMedia(storagePath, buf, data.mimeType)
            await remoteInsertAttachment({ ...attachment, upload: 'uploaded' })
            set(s => ({
              attachments: s.attachments.map(a =>
                a.id === id ? { ...a, upload: 'uploaded', uploadError: undefined } : a
              ),
              synced: { ...s.synced, [id]: true },
            }))
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            set(s => ({
              attachments: s.attachments.map(a =>
                a.id === id ? { ...a, upload: 'failed', uploadError: msg } : a
              ),
            }))
          }
        } else if (isRemoteEnabled()) {
          fireAndForget(remoteInsertAttachment(attachment))
        }

        return attachment
      },

      deleteAttachment: async (id) => {
        const a = get().attachments.find(x => x.id === id)
        set(s => ({ attachments: s.attachments.filter(x => x.id !== id) }))
        if (a) {
          fireAndForget(remoteDeleteAttachment(id))
          if (a.storagePath) {
            fireAndForget(remoteRemoveMedia([a.storagePath]))
          }
        }
      },

      getAttachmentsByTrip: (tripId) =>
        get().attachments.filter(a => a.tripId === tripId),

      getAttachmentsByExpense: (expenseId) =>
        get().attachments.filter(a => a.expenseId === expenseId),

      getAttachmentsByHotelExpense: (hotelExpenseId) =>
        get().attachments.filter(a => a.hotelExpenseId === hotelExpenseId),

      getAttachmentsBySettlement: ({ settlementId, fromMemberId, toMemberId }) =>
        get().attachments.filter(a =>
          a.kind === 'payment_proof' &&
          (
            (settlementId && a.settlementId === settlementId) ||
            (fromMemberId && toMemberId && a.fromMemberId === fromMemberId && a.toMemberId === toMemberId)
          )
        ),

      // ─── Session ─────────────────────────────────────────────────────────────
      setSession: (session) => set({ session }),

      login: (tripCode, mobile, pin) => {
        const state = get()
        const trip = state.trips.find(t => t.tripCode === tripCode)
        if (!trip) return null
        return state.members.find(
          m => m.tripId === trip.id && m.mobile === mobile && m.pin === pin
        ) || null
      },
    }),
    {
      name: 'trip-expense-store',
      version: 3,
      skipHydration: true, // prevent React 19 hydration mismatch (SSR vs localStorage)
      // v3: rewrite legacy non-UUID ids to UUIDs so old trips become
      // cloud-compatible and upload via the normal two-way sync.
      migrate: (persisted, version) => {
        if (persisted && version < 3) return migrateLegacyIds(persisted as Record<string, unknown>)
        return persisted
      },
      onRehydrateStorage: () => (state) => {
        // Called after localStorage data is loaded — safe to show protected routes now
        if (state) state.setHydrated(true)
      },
    }
  )
)
