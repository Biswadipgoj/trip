import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Trip, Member, Expense, Settlement, TripSession, PaymentStatus,
  SettlementGroup, Sponsorship, HotelExpense, Room, SplitType, ParticipantSplit,
  MemberBalance, SettlementRoute
} from '../types'
import {
  generateId, generateTripCode, getAvatarColor,
  calculateBalances, calculateSettlements, applyConfirmedTransfers
} from './utils'

export interface AppState {
  // Data
  trips:            Trip[]
  members:          Member[]
  expenses:         Expense[]
  hotelExpenses:    HotelExpense[]
  settlements:      Settlement[]
  settlementGroups: SettlementGroup[]
  sponsorships:     Sponsorship[]
  session:          TripSession | null

  // Core Actions
  createTrip: (params: {
    name: string
    password: string
    creatorName: string
    creatorMobile: string
    creatorPin: string
    creatorUpi?: string
    budget?: number
  }) => { trip: Trip; member: Member }

  joinTrip: (params: {
    tripCode: string
    password: string
    name: string
    mobile: string
    pin: string
    upiId?: string
  }) => { ok: boolean; error?: string; trip?: Trip; member?: Member }

  addMember: (params: {
    tripId: string
    name: string
    mobile: string
    pin: string
    upiId?: string
  }) => Member

  updateMemberUpi: (memberId: string, upiId: string) => void

  addExpense: (params: {
    tripId: string
    title: string
    amount: number
    paidBy: string
    payers?: { memberId: string; amount: number }[]
    category: Expense['category']
    subcategory?: string
    participants: string[]
    splitType: SplitType
    splits?: ParticipantSplit[]
    notes?: string
  }) => Expense

  deleteExpense: (id: string) => void

  addHotelExpense: (params: {
    tripId: string
    title: string
    paidBy: string
    rooms: { name: string; cost: number; occupantIds: string[] }[]
  }) => HotelExpense

  deleteHotelExpense: (id: string) => void

  addSettlementGroup: (tripId: string, name: string, memberIds: string[]) => SettlementGroup
  deleteSettlementGroup: (id: string) => void

  addSponsorship: (tripId: string, sponsorMemberId: string, sponsoredMemberId: string) => Sponsorship
  deleteSponsorship: (id: string) => void

  updateSettlementStatus: (
    route: SettlementRoute,
    tripId: string,
    status: PaymentStatus
  ) => void

  setSession: (session: TripSession | null) => void
  logout: () => void

  // Selectors
  getActiveTrip: () => Trip | undefined
  getCurrentMember: () => Member | undefined
  getTripMembers: (tripId: string) => Member[]
  getTripExpenses: (tripId: string) => Expense[]
  getTripHotelExpenses: (tripId: string) => HotelExpense[]
  getTripSettlements: (tripId: string) => Settlement[]
  getTripBalances: (tripId: string) => MemberBalance[]
  getTripSettlementRoutes: (tripId: string) => SettlementRoute[]
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      trips: [],
      members: [],
      expenses: [],
      hotelExpenses: [],
      settlements: [],
      settlementGroups: [],
      sponsorships: [],
      session: null,

      createTrip: ({ name, password, creatorName, creatorMobile, creatorPin, creatorUpi, budget }) => {
        const tripId = generateId()
        const creatorId = generateId()
        const tripCode = generateTripCode()
        const now = new Date().toISOString()

        const trip: Trip = {
          id: tripId,
          tripCode,
          name: name.trim(),
          password,
          creatorId,
          status: 'active',
          createdAt: now,
          budget: budget ? Number(budget) : undefined,
        }

        const member: Member = {
          id: creatorId,
          tripId,
          name: creatorName.trim(),
          mobile: creatorMobile.trim(),
          pin: creatorPin.trim(),
          upiId: creatorUpi?.trim() || undefined,
          avatarColor: getAvatarColor(0),
          joinedAt: now,
        }

        set(state => ({
          trips: [trip, ...state.trips],
          members: [member, ...state.members],
          session: { tripId, memberId: creatorId, tripCode },
        }))

        return { trip, member }
      },

      joinTrip: ({ tripCode, password, name, mobile, pin, upiId }) => {
        const state = get()
        const codeUpper = tripCode.trim().toUpperCase()
        const trip = state.trips.find(t => t.tripCode.toUpperCase() === codeUpper)

        if (!trip) {
          return { ok: false, error: 'Trip not found with this code' }
        }

        if (trip.password !== password) {
          return { ok: false, error: 'Incorrect trip password' }
        }

        // Check if member with this phone or name already exists in this trip
        const existing = state.members.find(
          m => m.tripId === trip.id && (m.mobile === mobile.trim() || m.name.toLowerCase() === name.trim().toLowerCase())
        )

        let memberToUse: Member

        if (existing) {
          if (existing.pin && existing.pin !== pin.trim()) {
            return { ok: false, error: 'Incorrect member PIN' }
          }
          memberToUse = existing
          if (upiId && !existing.upiId) {
            get().updateMemberUpi(existing.id, upiId)
          }
        } else {
          const newMemberId = generateId()
          const tripMembers = state.members.filter(m => m.tripId === trip.id)
          memberToUse = {
            id: newMemberId,
            tripId: trip.id,
            name: name.trim(),
            mobile: mobile.trim(),
            pin: pin.trim(),
            upiId: upiId?.trim() || undefined,
            avatarColor: getAvatarColor(tripMembers.length),
            joinedAt: new Date().toISOString(),
          }

          set(s => ({
            members: [...s.members, memberToUse]
          }))
        }

        set({
          session: { tripId: trip.id, memberId: memberToUse.id, tripCode: trip.tripCode }
        })

        return { ok: true, trip, member: memberToUse }
      },

      addMember: ({ tripId, name, mobile, pin, upiId }) => {
        const tripMembers = get().members.filter(m => m.tripId === tripId)
        const newMember: Member = {
          id: generateId(),
          tripId,
          name: name.trim(),
          mobile: mobile.trim(),
          pin: pin.trim(),
          upiId: upiId?.trim() || undefined,
          avatarColor: getAvatarColor(tripMembers.length),
          joinedAt: new Date().toISOString(),
        }

        set(state => ({
          members: [...state.members, newMember]
        }))

        return newMember
      },

      updateMemberUpi: (memberId, upiId) => {
        set(state => ({
          members: state.members.map(m =>
            m.id === memberId ? { ...m, upiId: upiId.trim() } : m
          )
        }))
      },

      addExpense: ({
        tripId, title, amount, paidBy, payers, category, subcategory,
        participants, splitType, splits = [], notes
      }) => {
        const numericAmount = Number(amount)
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
          throw new Error('Expense amount must be positive')
        }
        const expense: Expense = {
          id: generateId(),
          tripId,
          title: title.trim(),
          amount: numericAmount,
          paidBy,
          payers,
          category,
          subcategory,
          participants,
          splitType,
          splits,
          createdAt: new Date().toISOString(),
          notes: notes?.trim() || undefined,
        }

        set(state => ({
          expenses: [expense, ...state.expenses]
        }))

        return expense
      },

      deleteExpense: (id) => {
        set(state => ({
          expenses: state.expenses.filter(e => e.id !== id)
        }))
      },

      addHotelExpense: ({ tripId, title, paidBy, rooms }) => {
        const totalAmount = rooms.reduce((sum, r) => sum + Number(r.cost), 0)
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          throw new Error('Hotel total amount must be positive')
        }
        const hotel: HotelExpense = {
          id: generateId(),
          tripId,
          title: title.trim(),
          totalAmount,
          paidBy,
          rooms: rooms.map(r => ({
            id: generateId(),
            name: r.name.trim(),
            cost: Number(r.cost),
            occupantIds: r.occupantIds,
          })),
          createdAt: new Date().toISOString(),
        }

        set(state => ({
          hotelExpenses: [hotel, ...state.hotelExpenses]
        }))

        return hotel
      },

      deleteHotelExpense: (id) => {
        set(state => ({
          hotelExpenses: state.hotelExpenses.filter(h => h.id !== id)
        }))
      },

      addSettlementGroup: (tripId, name, memberIds) => {
        const group: SettlementGroup = {
          id: generateId(),
          tripId,
          name: name.trim(),
          memberIds,
        }

        set(state => ({
          settlementGroups: [...state.settlementGroups, group]
        }))

        return group
      },

      deleteSettlementGroup: (id) => {
        set(state => ({
          settlementGroups: state.settlementGroups.filter(g => g.id !== id)
        }))
      },

      addSponsorship: (tripId, sponsorMemberId, sponsoredMemberId) => {
        if (sponsorMemberId === sponsoredMemberId) {
          throw new Error('Self-sponsorship is not allowed')
        }
        const sponsorship: Sponsorship = {
          id: generateId(),
          tripId,
          sponsorMemberId,
          sponsoredMemberId,
        }

        set(state => ({
          sponsorships: [...state.sponsorships, sponsorship]
        }))

        return sponsorship
      },

      deleteSponsorship: (id) => {
        set(state => ({
          sponsorships: state.sponsorships.filter(s => s.id !== id)
        }))
      },

      updateSettlementStatus: (route, tripId, status) => {
        const state = get()
        const now = new Date().toISOString()
        const existing = state.settlements.find(
          s => s.tripId === tripId &&
               s.fromMemberId === route.fromMemberId &&
               s.toMemberId === route.toMemberId
        )

        if (existing) {
          set(s => ({
            settlements: s.settlements.map(item =>
              item.id === existing.id
                ? {
                    ...item,
                    status,
                    paidAt: status === 'paid' ? now : item.paidAt,
                    confirmedAt: status === 'confirmed' ? now : item.confirmedAt,
                  }
                : item
            )
          }))
        } else {
          const newSettlement: Settlement = {
            id: generateId(),
            tripId,
            fromMemberId: route.fromMemberId,
            toMemberId: route.toMemberId,
            amount: route.amount,
            status,
            paidAt: status === 'paid' ? now : undefined,
            confirmedAt: status === 'confirmed' ? now : undefined,
            fromGroupIds: route.fromMemberIds,
            toGroupIds: route.toMemberIds,
          }

          set(s => ({
            settlements: [...s.settlements, newSettlement]
          }))
        }
      },

      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),

      // Computed Selectors
      getActiveTrip: () => {
        const state = get()
        if (!state.session) return state.trips[0]
        return state.trips.find(t => t.id === state.session?.tripId) || state.trips[0]
      },

      getCurrentMember: () => {
        const state = get()
        if (!state.session) return undefined
        return state.members.find(m => m.id === state.session?.memberId)
      },

      getTripMembers: (tripId) => {
        return get().members.filter(m => m.tripId === tripId)
      },

      getTripExpenses: (tripId) => {
        return get().expenses.filter(e => e.tripId === tripId)
      },

      getTripHotelExpenses: (tripId) => {
        return get().hotelExpenses.filter(h => h.id === tripId || h.tripId === tripId)
      },

      getTripSettlements: (tripId) => {
        return get().settlements.filter(s => s.tripId === tripId)
      },

      getTripBalances: (tripId) => {
        const state = get()
        const members = state.members.filter(m => m.tripId === tripId)
        const expenses = state.expenses.filter(e => e.tripId === tripId)
        const hotelExpenses = state.hotelExpenses.filter(h => h.tripId === tripId)
        const rawBalances = calculateBalances(expenses, hotelExpenses, members)
        const confirmed = state.settlements.filter(s => s.tripId === tripId && s.status === 'confirmed')
        return applyConfirmedTransfers(rawBalances, confirmed)
      },

      getTripSettlementRoutes: (tripId) => {
        const state = get()
        const balances = state.getTripBalances(tripId)
        const sponsorships = state.sponsorships.filter(s => s.tripId === tripId)
        const groups = state.settlementGroups.filter(g => g.tripId === tripId)
        return calculateSettlements(balances, sponsorships, groups)
      },
    }),
    {
      name: 'tripmate_mobile_storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
