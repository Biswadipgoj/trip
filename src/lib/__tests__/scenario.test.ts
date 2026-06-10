import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/lib/store'
import { calculateNetBalances, calculateSettlements } from '@/lib/utils'

/**
 * End-to-end mock run of the reported production scenario (screenshots):
 *
 *   1. Five members, PARIJIT pays a big expense, everyone settles up and all
 *      payments are CONFIRMED.
 *   2. Dip then adds a new "Beer" expense shared by three people.
 *
 * The bug: the Payments screen kept saying "0 due · all confirmed" and the
 * old confirmed amounts silently grew to absorb the new expense. This suite
 * recomputes what every screen derives and asserts the cascade is correct.
 */

function resetStore() {
  useStore.setState({
    trips: [], members: [], expenses: [], hotelExpenses: [],
    settlements: [], settlementGroups: [], sponsorships: [], session: null,
  })
}

beforeEach(resetStore)

describe('screenshot scenario: confirm everything, then add a new expense', () => {
  it('keeps history immutable and surfaces the new dues on every screen', () => {
    const s = useStore.getState()
    const { trip, member: dip } = s.createTrip('Goa', 'Dip', '9000000001', 'pw', '1234')
    const debneel = s.addMember(trip.id, 'Debneel')
    const manu = s.addMember(trip.id, 'Manu')
    const parijit = s.addMember(trip.id, 'PARIJIT')
    const kumaresh = s.addMember(trip.id, 'Kumaresh')
    const everyone = [dip.id, debneel.id, manu.id, parijit.id, kumaresh.id]

    // 1. PARIJIT pays ₹10,000, split equally
    useStore.getState().addExpense({
      tripId: trip.id, title: 'F', amount: 10000, paidBy: parijit.id,
      category: 'fuel', participants: everyone, splitType: 'equal', splits: [],
    })

    // Everyone owes PARIJIT ₹2,000 → 4 minimal transactions
    let dues = useStore.getState().settlements.filter(x => x.tripId === trip.id && x.status !== 'confirmed')
    expect(dues).toHaveLength(4)
    dues.forEach(d => { expect(d.toMemberId).toBe(parijit.id); expect(d.amount).toBe(2000) })

    // 2. Everyone pays and PARIJIT confirms all of it
    for (const d of [...dues]) {
      useStore.getState().updateSettlementStatus(d.id, 'paid')
      useStore.getState().updateSettlementStatus(d.id, 'confirmed')
    }

    const screens = () => {
      const state = useStore.getState()
      const tripSettlements = state.settlements.filter(x => x.tripId === trip.id)
      const members = state.members.filter(m => m.tripId === trip.id)
      const expenses = state.expenses.filter(e => e.tripId === trip.id)
      const balances = calculateNetBalances(expenses, [], members, tripSettlements) // Dashboard + Members + Payments + Report
      const routes = calculateSettlements(balances, members, [], [])                // Payments "who pays whom"
      return {
        balances,
        routes,
        dues: tripSettlements.filter(x => x.status !== 'confirmed'),
        confirmed: tripSettlements.filter(x => x.status === 'confirmed'),
      }
    }

    // Fully settled: every screen shows zero balances and zero dues
    let view = screens()
    view.balances.forEach(b => expect(Math.abs(b.netBalance)).toBeLessThan(0.01))
    expect(view.routes).toHaveLength(0)
    expect(view.dues).toHaveLength(0)
    expect(view.confirmed).toHaveLength(4)

    // 3. Dip adds Beer ₹800 shared by Dip, Debneel, Kumaresh
    useStore.getState().addExpense({
      tripId: trip.id, title: 'Beer', amount: 800, paidBy: dip.id,
      category: 'alcohol', participants: [dip.id, debneel.id, kumaresh.id],
      splitType: 'equal', splits: [],
    })

    view = screens()

    // Confirmed history is untouched — exactly the cash that moved
    expect(view.confirmed).toHaveLength(4)
    view.confirmed.forEach(c => expect(c.amount).toBe(2000))

    // The new debt is visible as fresh PENDING dues (the "0 due" bug is gone)
    expect(view.dues.length).toBeGreaterThan(0)
    view.dues.forEach(d => {
      expect(d.status).toBe('pending')
      expect(d.toMemberId).toBe(dip.id)
    })
    const totalDue = view.dues.reduce((sum, d) => sum + d.amount, 0)
    expect(totalDue).toBeCloseTo(800 - 266.67, 1) // Debneel + Kumaresh shares

    // Net balances reflect only the new expense
    const net = (id: string) => view.balances.find(b => b.memberId === id)!.netBalance
    expect(net(dip.id)).toBeCloseTo(533.33, 1)
    expect(net(debneel.id)).toBeCloseTo(-266.67, 1)
    expect(net(kumaresh.id)).toBeCloseTo(-266.67, 1) // paise remainder goes to earlier participants
    expect(net(manu.id)).toBe(0)
    expect(net(parijit.id)).toBe(0)

    // Payments screen routes mirror the stored dues 1:1
    expect(view.routes).toHaveLength(view.dues.length)
    view.routes.forEach(r => {
      const match = view.dues.find(
        d => d.fromMemberId === r.fromMemberId && Math.abs(d.amount - r.amount) < 0.01
      )
      expect(match).toBeDefined()
    })
  })
})
