import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Trip, Member, Expense, Settlement, TripSession, PaymentStatus,
  SettlementGroup, Sponsorship, HotelExpense, Room, SplitType, ParticipantSplit
} from '@/types'
import {
  generateId, generateTripCode, getAvatarColor, isUuid,
  calculateBalances, calculateSettlements, applyConfirmedTransfers
} from '@/lib/utils'
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
  s: Pick<AppState, 'trips' | 'members' | 'expenses' | 'hotelExpenses' | 'settlements' | 'settlementGroups' | 'sponsorships' | 'session'>,
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
        return member
      },

      updateMemberUpi: (memberId, upiId, upiName) => {
        set(s => ({
          members: s.members.map(m =>
            m.id === memberId ? { ...m, upiId, upiName } : m
          ),
        }))
      },

      // ─── Expenses ───────────────────────────────────────────────────────────
      addExpense: (data) => {
        const expense: Expense = { ...data, id: generateId(), createdAt: new Date().toISOString() }
        set(s => ({ expenses: [...s.expenses, expense] }))
        get().generateSettlements(data.tripId)
        return expense
      },

      deleteExpense: (expenseId) => {
        const expense = get().expenses.find(e => e.id === expenseId)
        set(s => ({ expenses: s.expenses.filter(e => e.id !== expenseId) }))
        if (expense) get().generateSettlements(expense.tripId)
      },

      getExpensesByTrip: (tripId) =>
        get().expenses
          .filter(e => e.tripId === tripId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

      // ─── Hotel Expenses ──────────────────────────────────────────────────────
      addHotelExpense: (data) => {
        const hotel: HotelExpense = {
          ...data,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        set(s => ({ hotelExpenses: [...s.hotelExpenses, hotel] }))
        get().generateSettlements(data.tripId)
        return hotel
      },

      deleteHotelExpense: (id) => {
        const hotel = get().hotelExpenses.find(h => h.id === id)
        set(s => ({ hotelExpenses: s.hotelExpenses.filter(h => h.id !== id) }))
        if (hotel) get().generateSettlements(hotel.tripId)
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
        return group
      },

      removeSettlementGroup: (id) => {
        const group = get().settlementGroups.find(g => g.id === id)
        set(s => ({ settlementGroups: s.settlementGroups.filter(g => g.id !== id) }))
        if (group) get().generateSettlements(group.tripId)
      },

      getGroupsByTrip: (tripId) =>
        get().settlementGroups.filter(g => g.tripId === tripId),

      // ─── Sponsorships ────────────────────────────────────────────────────────
      addSponsorship: (tripId, sponsorMemberId, sponsoredMemberId) => {
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
        return sp
      },

      removeSponsorship: (id) => {
        const sp = get().sponsorships.find(s => s.id === id)
        set(s => ({ sponsorships: s.sponsorships.filter(x => x.id !== id) }))
        if (sp) get().generateSettlements(sp.tripId)
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

        // Keep due ids stable across regenerations so "Mark Paid" clicks survive.
        // The "paid" marker only survives when it is
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
        if (updated && status === 'confirmed') get().generateSettlements(updated.tripId)
      },

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
