import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Trip, Member, Expense, Settlement, TripSession, PaymentStatus,
  SettlementGroup, Sponsorship, Room, SplitType, ParticipantSplit, MemberUnit
} from '@/types'
import {
  generateId, generateTripCode, getAvatarColor,
  calculateBalances, calculateSettlements
} from '@/lib/utils'

interface AppState {
  // ─── Data ───────────────────────────────────────────────────────────────────
  trips:            Trip[]
  members:          Member[]
  expenses:         Expense[]
  settlements:      Settlement[]
  settlementGroups: SettlementGroup[]
  sponsorships:     Sponsorship[]
  memberUnits:      MemberUnit[]

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

  // ─── Member Actions ─────────────────────────────────────────────────────────
  getMembersByTrip: (tripId: string) => Member[]
  getMemberById:    (id: string) => Member | undefined
  updateMemberUpi:  (memberId: string, upiId: string, upiName?: string) => void

  // ─── Member Unit Actions ────────────────────────────────────────────────────
  addMemberUnit:    (tripId: string, name: string, memberIds: string[]) => MemberUnit
  removeMemberUnit: (id: string) => void

  // ─── Expense Actions ─────────────────────────────────────────────────────────
  addExpense:        (data: Omit<Expense, 'id' | 'createdAt'>) => Expense
  deleteExpense:     (expenseId: string) => void
  getExpensesByTrip: (tripId: string) => Expense[]

  // ─── Settlement Group Actions ────────────────────────────────────────────────
  addSettlementGroup:    (tripId: string, name: string, memberIds: string[], createdBy: string) => SettlementGroup
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
  
  // ─── Developer Tools ─────────────────────────────────────────────────────────
  clearData: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated:         false,
      setHydrated:      (v) => set({ hydrated: v }),

      trips:            [],
      members:          [],
      expenses:         [],
      settlements:      [],
      settlementGroups: [],
      sponsorships:     [],
      memberUnits:      [],
      session:          null,

      clearData: () => set({
        trips: [], members: [], expenses: [], settlements: [], settlementGroups: [], sponsorships: [], memberUnits: [], session: null
      }),

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

      importTrip: (trip) => {
        set(s => {
          if (s.trips.some(t => t.tripCode === trip.tripCode)) return s
          return { trips: [...s.trips, trip] }
        })
      },

      // ─── Members ────────────────────────────────────────────────────────────
      getMembersByTrip: (tripId) => get().members.filter(m => m.tripId === tripId),
      getMemberById:    (id)     => get().members.find(m => m.id === id),

      updateMemberUpi: (memberId, upiId, upiName) => {
        set(s => ({
          members: s.members.map(m =>
            m.id === memberId ? { ...m, upiId, upiName } : m
          ),
        }))
      },

      // ─── Member Units ───────────────────────────────────────────────────────
      addMemberUnit: (tripId, name, memberIds) => {
        const unit: MemberUnit = { id: generateId(), tripId, name, memberIds }
        set(s => ({ memberUnits: [...s.memberUnits, unit] }))
        get().generateSettlements(tripId)
        return unit
      },
      
      removeMemberUnit: (id) => {
        const unit = get().memberUnits.find(u => u.id === id)
        set(s => ({ memberUnits: s.memberUnits.filter(u => u.id !== id) }))
        if (unit) get().generateSettlements(unit.tripId)
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

      // ─── Settlement Groups ───────────────────────────────────────────────────
      addSettlementGroup: (tripId, name, memberIds, createdBy) => {
        const group: SettlementGroup = { 
          id: generateId(), tripId, name, memberIds,
          // We will temporarily cast this if the type hasn't fully updated yet or just store it.
          ...( { createdBy, createdAt: new Date().toISOString() } as any )
        }
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
        const members       = state.members.filter(m => m.tripId === tripId)
        const groups        = state.settlementGroups.filter(g => g.tripId === tripId)
        const sponsorships  = state.sponsorships.filter(sp => sp.tripId === tripId)
        const memberUnits   = state.memberUnits.filter(u => u.tripId === tripId)

        // 1. Calculate raw balances
        const balances = calculateBalances(expenses, members, memberUnits)

        // 2 & 3. Generate settlement routes (applies sponsorships + groups internally)
        const routes = calculateSettlements(balances, members, groups, sponsorships, memberUnits)

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
      version: 3, // bumped version due to paidBy schema change
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated(true)
      },
    }
  )
)
