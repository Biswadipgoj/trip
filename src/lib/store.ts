import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Trip, Member, Expense, Settlement, TripSession, PaymentStatus,
  SettlementGroup, Sponsorship, HotelExpense, Room, SplitType, ParticipantSplit
} from '@/types'
import {
  generateId, generateTripCode, getAvatarColor,
  calculateBalances, calculateSettlements, resolveHotelSplits
} from '@/lib/utils'
import {
  remoteCreateTrip, remoteCloseTrip, remoteAddManualMember, remoteUpdateMemberUpi,
  remotePushExpense, remoteDeleteExpense, remotePushHotelExpense, remoteDeleteHotelExpense,
  remotePushSettlementStatus, TripBundle,
} from '@/lib/remote'

// Remote pushes are best-effort: cloud sync must never block or break local UX.
function fireAndForget(p: Promise<unknown>) {
  p.catch(err => console.warn('[sync] push failed (local data is safe):', err))
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
  mergeRemoteTrip: (bundle: TripBundle) => void
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
        fireAndForget(remoteCloseTrip(tripId))
      },

      getTripById:   (tripId) => get().trips.find(t => t.id === tripId),
      getTripByCode: (code)   => get().trips.find(t => t.tripCode === code),

      // Upsert by trip code: refreshes an already-known trip in place (same id)
      // instead of ever creating a second copy.
      importTrip: (trip) => {
        set(s => {
          const existing = s.trips.find(t => t.tripCode === trip.tripCode)
          if (existing) {
            return {
              trips: s.trips.map(t =>
                t.tripCode === trip.tripCode ? { ...t, ...trip, budget: trip.budget ?? t.budget } : t
              ),
            }
          }
          return { trips: [...s.trips, trip] }
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
      // local store. Remote wins on shared ids; local-only items (not yet
      // pushed, e.g. created offline) are kept.
      mergeRemoteTrip: (bundle) => {
        const { trip, members, expenses, hotelExpenses, settlementStatuses } = bundle
        set(s => {
          const localTrip = s.trips.find(t => t.id === trip.id)
          const mergedTrip: Trip = { ...trip, budget: localTrip?.budget }

          // keep: everything from other trips + local-only items of this trip;
          // remote rows replace local copies with the same id
          const mergeById = <T extends { id: string }>(local: T[], remote: T[], tripScoped: (x: T) => boolean) => {
            const remoteIds = new Set(remote.map(r => r.id))
            const kept = local.filter(x => !tripScoped(x) || !remoteIds.has(x.id))
            return [...kept, ...remote]
          }

          return {
            trips: localTrip
              ? s.trips.map(t => (t.id === trip.id ? mergedTrip : t))
              : [...s.trips, mergedTrip],
            members: mergeById(s.members, members, m => m.tripId === trip.id),
            expenses: mergeById(s.expenses, expenses, e => e.tripId === trip.id),
            hotelExpenses: mergeById(s.hotelExpenses, hotelExpenses, h => h.tripId === trip.id),
          }
        })

        // Recompute settlements from the merged data, then overlay any remote
        // paid/confirmed statuses so payment state survives across devices.
        get().generateSettlements(trip.id)
        if (settlementStatuses.length > 0) {
          set(s => ({
            settlements: s.settlements.map(x => {
              if (x.tripId !== trip.id) return x
              const remote = settlementStatuses.find(
                r => r.fromMemberId === x.fromMemberId && r.toMemberId === x.toMemberId
              )
              if (!remote || remote.status === 'pending') return x
              return { ...x, status: remote.status, paidAt: remote.paidAt, confirmedAt: remote.confirmedAt }
            }),
          }))
        }
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
        const expense: Expense = { ...data, id: generateId(), createdAt: new Date().toISOString() }
        set(s => ({ expenses: [...s.expenses, expense] }))
        get().generateSettlements(data.tripId)
        fireAndForget(remotePushExpense(expense))
        return expense
      },

      deleteExpense: (expenseId) => {
        const expense = get().expenses.find(e => e.id === expenseId)
        set(s => ({ expenses: s.expenses.filter(e => e.id !== expenseId) }))
        if (expense) get().generateSettlements(expense.tripId)
        fireAndForget(remoteDeleteExpense(expenseId))
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
        fireAndForget(remotePushHotelExpense(hotel))
        return hotel
      },

      deleteHotelExpense: (id) => {
        const hotel = get().hotelExpenses.find(h => h.id === id)
        set(s => ({ hotelExpenses: s.hotelExpenses.filter(h => h.id !== id) }))
        if (hotel) get().generateSettlements(hotel.tripId)
        fireAndForget(remoteDeleteHotelExpense(id))
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
      generateSettlements: (tripId) => {
        const state = get()
        const expenses      = state.expenses.filter(e => e.tripId === tripId)
        const hotelExpenses = state.hotelExpenses.filter(h => h.tripId === tripId)
        const members       = state.members.filter(m => m.tripId === tripId)
        const groups        = state.settlementGroups.filter(g => g.tripId === tripId)
        const sponsorships  = state.sponsorships.filter(sp => sp.tripId === tripId)

        // 1. Calculate raw balances
        const balances = calculateBalances(expenses, hotelExpenses, members)

        // 2 & 3. Generate settlement routes (applies sponsorships + groups internally)
        const routes = calculateSettlements(balances, members, groups, sponsorships)

        // Preserve confirmed statuses
        const prevSettlements = state.settlements.filter(s => s.tripId === tripId)
        const confirmedMap: Record<string, Settlement> = {}
        prevSettlements
          .filter(s => s.status === 'confirmed')
          .forEach(s => {
            const key = `${s.fromMemberId}→${s.toMemberId}`
            confirmedMap[key] = s
          })
        const paidMap: Record<string, Settlement> = {}
        prevSettlements
          .filter(s => s.status === 'paid')
          .forEach(s => {
            const key = `${s.fromMemberId}→${s.toMemberId}`
            paidMap[key] = s
          })

        const newSettlements: Settlement[] = routes.map(route => {
          const key = `${route.fromMemberId}→${route.toMemberId}`
          const confirmed = confirmedMap[key]
          const paid = paidMap[key]

          return {
            id:            confirmed?.id || paid?.id || generateId(),
            tripId,
            fromMemberId:  route.fromMemberId,
            toMemberId:    route.toMemberId,
            amount:        route.amount,
            status:        confirmed?.status || paid?.status || 'pending',
            paidAt:        confirmed?.paidAt || paid?.paidAt,
            confirmedAt:   confirmed?.confirmedAt,
          }
        })

        set(s => ({
          settlements: [
            ...s.settlements.filter(x => x.tripId !== tripId),
            ...newSettlements,
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
        if (updated) fireAndForget(remotePushSettlementStatus(updated))
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
      version: 2,
      skipHydration: true, // prevent React 19 hydration mismatch (SSR vs localStorage)
      onRehydrateStorage: () => (state) => {
        // Called after localStorage data is loaded — safe to show protected routes now
        if (state) state.setHydrated(true)
      },
    }
  )
)
