// Derived trip data shared by every screen. All figures come from one
// memoized pipeline (expenses → balances → confirmed transfers → minimal
// settlement routes), so Dashboard, Members, Payments and Report can never
// disagree — the same guarantee the web app gives.
//
// Raw store arrays are selected and filtered in useMemo: a selector that
// returns a freshly-filtered array would re-render forever (zustand v5).
import { useMemo } from 'react'
import { useStore } from './store'
import { calculateNetBalances, calculateSettlements, sameAmount } from './utils'
import type { Attachment, Member, Settlement, SettlementRoute } from '../types'

const newestFirst = <T extends { createdAt: string }>(a: T, b: T) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

/** Stable React key for a settlement route (route ids are regenerated on every
 *  recompute; direction is unique within a trip). */
export const routeKey = (r: Pick<SettlementRoute, 'fromMemberId' | 'toMemberId'>) => `${r.fromMemberId}→${r.toMemberId}`

/** Payment screenshots that belong to a payment. Ids differ across devices,
 *  so direction + amount is the fallback match. */
export function proofsFor(attachments: Attachment[], s: Pick<Settlement, 'id' | 'fromMemberId' | 'toMemberId' | 'amount'>) {
  return attachments.filter(
    a =>
      a.kind === 'payment_proof' &&
      (a.settlementId === s.id ||
        (a.fromMemberId === s.fromMemberId && a.toMemberId === s.toMemberId && a.amount !== undefined && sameAmount(a.amount, s.amount)))
  )
}

export interface Due {
  key: string
  route: SettlementRoute
  /** The stored due for this route (same direction AND amount), if any. */
  settlement?: Settlement
  status: Settlement['status']
}

export function useTripData(tripId: string | undefined) {
  const trips = useStore(s => s.trips)
  const allMembers = useStore(s => s.members)
  const allExpenses = useStore(s => s.expenses)
  const allHotels = useStore(s => s.hotelExpenses)
  const allSettlements = useStore(s => s.settlements)
  const allGroups = useStore(s => s.settlementGroups)
  const allSponsorships = useStore(s => s.sponsorships)
  const allAttachments = useStore(s => s.attachments)
  const session = useStore(s => s.session)

  const trip = useMemo(() => trips.find(t => t.id === tripId), [trips, tripId])
  const members = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses = useMemo(() => allExpenses.filter(e => e.tripId === tripId).sort(newestFirst), [allExpenses, tripId])
  const hotelExpenses = useMemo(() => allHotels.filter(h => h.tripId === tripId).sort(newestFirst), [allHotels, tripId])
  const settlements = useMemo(() => allSettlements.filter(s => s.tripId === tripId), [allSettlements, tripId])
  const groups = useMemo(() => allGroups.filter(g => g.tripId === tripId), [allGroups, tripId])
  const sponsorships = useMemo(() => allSponsorships.filter(s => s.tripId === tripId), [allSponsorships, tripId])
  const attachments = useMemo(() => allAttachments.filter(a => a.tripId === tripId), [allAttachments, tripId])

  const balances = useMemo(
    () => calculateNetBalances(expenses, hotelExpenses, members, settlements, groups, sponsorships),
    [expenses, hotelExpenses, members, settlements, groups, sponsorships]
  )
  const routes = useMemo(
    () => calculateSettlements(balances, members, groups, sponsorships),
    [balances, members, groups, sponsorships]
  )

  const derived = useMemo(() => {
    const memberMap: Record<string, Member> = {}
    members.forEach(m => { memberMap[m.id] = m })

    const totalSpent =
      expenses.reduce((sum, e) => sum + e.amount, 0) + hotelExpenses.reduce((sum, h) => sum + h.totalAmount, 0)

    // Each route paired with its stored due — only the SAME payment (direction
    // and amount) counts, exactly as on the web Payments page.
    const dues: Due[] = routes.map(route => {
      const settlement = settlements.find(
        s =>
          s.status !== 'confirmed' &&
          s.fromMemberId === route.fromMemberId &&
          s.toMemberId === route.toMemberId &&
          sameAmount(s.amount, route.amount)
      )
      return { key: routeKey(route), route, settlement, status: settlement?.status ?? 'pending' }
    })

    const confirmed = settlements
      .filter(s => s.status === 'confirmed')
      .sort((a, b) => (b.confirmedAt || '').localeCompare(a.confirmedAt || ''))

    const billsByParent: Record<string, Attachment[]> = {}
    attachments.forEach(a => {
      if (a.kind !== 'bill') return
      const parent = a.expenseId ?? a.hotelExpenseId
      if (parent) (billsByParent[parent] ||= []).push(a)
    })

    return { memberMap, totalSpent, dues, confirmed, billsByParent }
  }, [members, expenses, hotelExpenses, routes, settlements, attachments])

  const isMine = !!session && session.tripId === tripId
  const me = isMine ? derived.memberMap[session!.memberId] : undefined
  const isAdmin = !!trip && isMine && session!.memberId === trip.creatorId

  return {
    trip, members, expenses, hotelExpenses, settlements, groups, sponsorships, attachments,
    balances, routes, session, me, isAdmin, ...derived,
  }
}

export type TripData = ReturnType<typeof useTripData>
