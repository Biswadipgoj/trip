import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/lib/store'
import { calculateNetBalances } from '@/lib/utils'
import type { Expense } from '@/types'

// Supabase env vars are absent in tests, so every remote push is a no-op —
// these tests exercise the local engine that drives all screens.

function resetStore() {
  useStore.setState({
    trips: [], members: [], expenses: [], hotelExpenses: [],
    settlements: [], settlementGroups: [], sponsorships: [], synced: {}, session: null,
  })
}

function seedTrip() {
  const s = useStore.getState()
  const { trip, member: dip } = s.createTrip('Goa', 'Dip', '9000000001', 'pw', '1234')
  const manu = s.addMember(trip.id, 'Manu')
  const pari = s.addMember(trip.id, 'Parijit')
  return { trip, dip, manu, pari }
}

function addEqualExpense(tripId: string, amount: number, paidBy: string, participants: string[]): Expense {
  return useStore.getState().addExpense({
    tripId, title: 'Spend', amount, paidBy, category: 'food',
    participants, splitType: 'equal', splits: [],
  })
}

const due = (tripId: string) =>
  useStore.getState().settlements.filter(x => x.tripId === tripId && x.status !== 'confirmed')
const confirmed = (tripId: string) =>
  useStore.getState().settlements.filter(x => x.tripId === tripId && x.status === 'confirmed')

beforeEach(resetStore)

describe('settlement generation', () => {
  it('adding an expense cascades into minimal settlements', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    const dues = due(trip.id)
    expect(dues).toHaveLength(2)
    dues.forEach(d => {
      expect(d.toMemberId).toBe(dip.id)
      expect(d.amount).toBe(1000)
      expect(d.status).toBe('pending')
    })
  })

  it('deleting an expense recalculates settlements', () => {
    const { trip, dip, manu, pari } = seedTrip()
    const e = addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])
    useStore.getState().deleteExpense(e.id)
    expect(due(trip.id)).toHaveLength(0)
  })
})

describe('payment confirmation cascade (Issue A)', () => {
  it('confirming a payment freezes it as a record and re-minimizes the residual', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    const manuDue = due(trip.id).find(d => d.fromMemberId === manu.id)!
    useStore.getState().updateSettlementStatus(manuDue.id, 'paid')
    useStore.getState().updateSettlementStatus(manuDue.id, 'confirmed')

    // One immutable confirmed record, one remaining due
    const records = confirmed(trip.id)
    expect(records).toHaveLength(1)
    expect(records[0].amount).toBe(1000)
    const dues = due(trip.id)
    expect(dues).toHaveLength(1)
    expect(dues[0].fromMemberId).toBe(pari.id)

    // Net balances reflect the transferred cash on every screen
    const state = useStore.getState()
    const net = calculateNetBalances(
      state.expenses.filter(e => e.tripId === trip.id), [],
      state.members.filter(m => m.tripId === trip.id),
      state.settlements.filter(x => x.tripId === trip.id)
    )
    expect(net.find(b => b.memberId === manu.id)!.netBalance).toBe(0)
    expect(net.find(b => b.memberId === dip.id)!.netBalance).toBe(1000)
    expect(net.find(b => b.memberId === pari.id)!.netBalance).toBe(-1000)
  })

  it('a new expense after confirmation NEVER rewrites the confirmed amount (screenshot bug)', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    const manuDue = due(trip.id).find(d => d.fromMemberId === manu.id)!
    useStore.getState().updateSettlementStatus(manuDue.id, 'paid')
    useStore.getState().updateSettlementStatus(manuDue.id, 'confirmed')

    // The regression: ₹1000 confirmed silently became a bigger "confirmed" due
    addEqualExpense(trip.id, 300, dip.id, [dip.id, manu.id, pari.id])

    const records = confirmed(trip.id)
    expect(records).toHaveLength(1)
    expect(records[0].amount).toBe(1000) // immutable — the cash that actually moved

    const dues = due(trip.id)
    expect(dues.map(d => ({ from: d.fromMemberId, amount: d.amount })).sort((a, b) => a.amount - b.amount))
      .toEqual([
        { from: manu.id, amount: 100 },   // new residual due, NOT auto-confirmed
        { from: pari.id, amount: 1100 },
      ])
    dues.forEach(d => expect(d.status).toBe('pending'))
  })

  it('fully-settled trips report zero dues', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    for (const d of [...due(trip.id)]) {
      useStore.getState().updateSettlementStatus(d.id, 'paid')
      useStore.getState().updateSettlementStatus(d.id, 'confirmed')
    }
    expect(due(trip.id)).toHaveLength(0)
    expect(confirmed(trip.id)).toHaveLength(2)
    expect(useStore.getState().settlements.every(x => x.status === 'confirmed')).toBe(true)
  })
})

describe('paid-status preservation across regenerations', () => {
  it('keeps "paid" (and the id) when the amount is unchanged', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    const manuDue = due(trip.id).find(d => d.fromMemberId === manu.id)!
    useStore.getState().updateSettlementStatus(manuDue.id, 'paid')

    useStore.getState().generateSettlements(trip.id) // background sync re-run
    const after = due(trip.id).find(d => d.fromMemberId === manu.id)!
    expect(after.id).toBe(manuDue.id)
    expect(after.status).toBe('paid')
  })

  it('resets "paid" to pending when the due amount changes', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    const manuDue = due(trip.id).find(d => d.fromMemberId === manu.id)!
    useStore.getState().updateSettlementStatus(manuDue.id, 'paid')

    addEqualExpense(trip.id, 300, dip.id, [dip.id, manu.id, pari.id])
    const after = due(trip.id).find(d => d.fromMemberId === manu.id)!
    expect(after.amount).toBe(1100)
    expect(after.status).toBe('pending') // a different amount is a different payment
  })
})

describe('group joining (Issue B)', () => {
  it('joinTrip attaches the member to the EXISTING trip — never a clone', () => {
    const { trip } = seedTrip()
    const tripsBefore = useStore.getState().trips.length

    const joined = useStore.getState().joinTrip(trip.tripCode, 'pw', 'Kumaresh', '9000000002', '4321')

    expect(joined).not.toBeNull()
    expect(joined!.tripId).toBe(trip.id)
    expect(useStore.getState().trips).toHaveLength(tripsBefore) // no new trip row
    expect(useStore.getState().getMembersByTrip(trip.id).map(m => m.name)).toContain('Kumaresh')
  })

  it('rejects a wrong password and unknown trip codes', () => {
    const { trip } = seedTrip()
    expect(useStore.getState().joinTrip(trip.tripCode, 'wrong', 'X', '9000000003', '1111')).toBeNull()
    expect(useStore.getState().joinTrip('TRP-NOPE', 'pw', 'X', '9000000003', '1111')).toBeNull()
  })

  it('joining twice with the same mobile returns the existing member', () => {
    const { trip } = seedTrip()
    const first = useStore.getState().joinTrip(trip.tripCode, 'pw', 'Kumaresh', '9000000002', '4321')!
    const membersAfterFirst = useStore.getState().getMembersByTrip(trip.id).length

    const second = useStore.getState().joinTrip(trip.tripCode, 'pw', 'Kumaresh K', '9000000002', '4321')!
    expect(second.id).toBe(first.id)
    expect(useStore.getState().getMembersByTrip(trip.id)).toHaveLength(membersAfterFirst)
  })

  it('importTrip upserts by trip code instead of duplicating', () => {
    const { trip } = seedTrip()
    useStore.getState().importTrip({ ...trip, name: 'Goa (refreshed)' })
    const trips = useStore.getState().trips.filter(t => t.tripCode === trip.tripCode)
    expect(trips).toHaveLength(1)
    expect(trips[0].id).toBe(trip.id)
    expect(trips[0].name).toBe('Goa (refreshed)')
  })
})

describe('remote merge keeps confirmed payments authoritative', () => {
  it('imports remote confirmed transfers and regenerates residual dues', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])
    const state = useStore.getState()

    state.mergeRemoteTrip({
      trip,
      members: state.members.filter(m => m.tripId === trip.id),
      expenses: state.expenses.filter(e => e.tripId === trip.id),
      hotelExpenses: [],
      settlementGroups: [],
      sponsorships: [],
      settlementStatuses: [{
        id: crypto.randomUUID(),
        fromMemberId: manu.id, toMemberId: dip.id, amount: 1000,
        status: 'confirmed', confirmedAt: new Date().toISOString(),
      }],
    })

    expect(confirmed(trip.id)).toHaveLength(1)
    expect(confirmed(trip.id)[0].amount).toBe(1000)
    const dues = due(trip.id)
    expect(dues).toHaveLength(1)
    expect(dues[0].fromMemberId).toBe(pari.id)

    // A second sync of the same payload must be idempotent
    useStore.getState().mergeRemoteTrip({
      trip,
      members: useStore.getState().members.filter(m => m.tripId === trip.id),
      expenses: useStore.getState().expenses.filter(e => e.tripId === trip.id),
      hotelExpenses: [],
      settlementGroups: [],
      sponsorships: [],
      settlementStatuses: [{
        id: crypto.randomUUID(),
        fromMemberId: manu.id, toMemberId: dip.id, amount: 1000,
        status: 'confirmed', confirmedAt: new Date().toISOString(),
      }],
    })
    expect(confirmed(trip.id)).toHaveLength(1)
  })

  it('a stale remote "paid" row never downgrades or duplicates local state', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])
    const manuDue = due(trip.id).find(d => d.fromMemberId === manu.id)!
    useStore.getState().updateSettlementStatus(manuDue.id, 'paid')
    useStore.getState().updateSettlementStatus(manuDue.id, 'confirmed')

    useStore.getState().mergeRemoteTrip({
      trip,
      members: useStore.getState().members.filter(m => m.tripId === trip.id),
      expenses: useStore.getState().expenses.filter(e => e.tripId === trip.id),
      hotelExpenses: [],
      settlementGroups: [],
      sponsorships: [],
      settlementStatuses: [{
        id: manuDue.id,
        fromMemberId: manu.id, toMemberId: dip.id, amount: 1000,
        status: 'paid', paidAt: new Date().toISOString(), // stale: local already confirmed
      }],
    })

    const records = confirmed(trip.id)
    expect(records).toHaveLength(1)
    expect(records[0].status).toBe('confirmed') // monotonic — never rolled back
  })
})

describe('couple groups — confirmed payments settle the whole unit', () => {
  function seedCouple() {
    const { trip, dip, manu, pari } = seedTrip()
    useStore.getState().addSettlementGroup(trip.id, 'Manu & Parijit', [manu.id, pari.id])
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])
    return { trip, dip, manu, pari }
  }

  const liveNet = (tripId: string) => {
    const state = useStore.getState()
    return calculateNetBalances(
      state.expenses.filter(e => e.tripId === tripId), [],
      state.members.filter(m => m.tripId === tripId),
      state.settlements.filter(x => x.tripId === tripId),
      state.settlementGroups.filter(g => g.tripId === tripId),
      state.sponsorships.filter(sp => sp.tripId === tripId)
    )
  }

  it('routes the couple as ONE combined payment', () => {
    const { trip, dip } = seedCouple()
    const dues = due(trip.id)
    expect(dues).toHaveLength(1)
    expect(dues[0].amount).toBe(2000)
    expect(dues[0].toMemberId).toBe(dip.id)
    expect(dues[0].fromGroupIds).toHaveLength(2) // snapshot of both members
  })

  it('confirming the couple payment zeroes BOTH members — no phantom +/− inside the couple', () => {
    const { trip } = seedCouple()
    const d = due(trip.id)[0]
    useStore.getState().updateSettlementStatus(d.id, 'paid')
    useStore.getState().updateSettlementStatus(d.id, 'confirmed')

    liveNet(trip.id).forEach(b => expect(b.netBalance).toBe(0))
    expect(due(trip.id)).toHaveLength(0)
    expect(confirmed(trip.id)).toHaveLength(1)
  })

  it('deleting the couple AFTER settlement creates no phantom dues between them', () => {
    const { trip } = seedCouple()
    const d = due(trip.id)[0]
    useStore.getState().updateSettlementStatus(d.id, 'paid')
    useStore.getState().updateSettlementStatus(d.id, 'confirmed')

    const group = useStore.getState().settlementGroups.find(g => g.tripId === trip.id)!
    useStore.getState().removeSettlementGroup(group.id)

    expect(due(trip.id)).toHaveLength(0) // snapshot keeps the history correct
    liveNet(trip.id).forEach(b => expect(b.netBalance).toBe(0))
  })

  it('a new expense after the couple settled produces fresh dues for the couple only', () => {
    const { trip, dip, manu, pari } = seedCouple()
    const d = due(trip.id)[0]
    useStore.getState().updateSettlementStatus(d.id, 'paid')
    useStore.getState().updateSettlementStatus(d.id, 'confirmed')

    addEqualExpense(trip.id, 300, dip.id, [dip.id, manu.id, pari.id])

    expect(confirmed(trip.id)[0].amount).toBe(2000) // history untouched
    const dues = due(trip.id)
    expect(dues).toHaveLength(1)
    expect(dues[0].amount).toBe(200) // the couple's combined new share
    expect(dues[0].status).toBe('pending')
  })
})

describe('sponsorships — confirmed sponsor payments clear the sponsored member too', () => {
  it('zeroes both sponsor and sponsored after confirmation', () => {
    const { trip, dip, manu, pari } = seedTrip()
    useStore.getState().addSponsorship(trip.id, manu.id, pari.id) // Manu sponsors Parijit
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    const dues = due(trip.id)
    expect(dues).toHaveLength(1) // sponsor pays the combined 2000
    expect(dues[0].amount).toBe(2000)

    useStore.getState().updateSettlementStatus(dues[0].id, 'paid')
    useStore.getState().updateSettlementStatus(dues[0].id, 'confirmed')

    const state = useStore.getState()
    const net = calculateNetBalances(
      state.expenses.filter(e => e.tripId === trip.id), [],
      state.members.filter(m => m.tripId === trip.id),
      state.settlements.filter(x => x.tripId === trip.id),
      state.settlementGroups.filter(g => g.tripId === trip.id),
      state.sponsorships.filter(sp => sp.tripId === trip.id)
    )
    net.forEach(b => expect(b.netBalance).toBe(0))
    expect(due(trip.id)).toHaveLength(0)
  })
})

describe('remote merge syncs couples and sponsorships across devices', () => {
  it('imports remote settlement groups and uses them in the minimizer', () => {
    const { trip, dip, manu, pari } = seedTrip()
    addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])
    expect(due(trip.id)).toHaveLength(2) // no group locally yet

    const state = useStore.getState()
    state.mergeRemoteTrip({
      trip,
      members: state.members.filter(m => m.tripId === trip.id),
      expenses: state.expenses.filter(e => e.tripId === trip.id),
      hotelExpenses: [],
      settlementGroups: [{
        id: crypto.randomUUID(), tripId: trip.id,
        name: 'Manu & Parijit', memberIds: [manu.id, pari.id],
      }],
      sponsorships: [],
      settlementStatuses: [],
    })

    expect(useStore.getState().settlementGroups.filter(g => g.tripId === trip.id)).toHaveLength(1)
    const dues = due(trip.id)
    expect(dues).toHaveLength(1) // couple now pays as one entity on this device too
    expect(dues[0].amount).toBe(2000)
  })
})

describe('two-way sync semantics', () => {
  const bundleFor = (trip: any, over: Record<string, unknown> = {}) => {
    const state = useStore.getState()
    return {
      trip,
      members: state.members.filter(m => m.tripId === trip.id),
      expenses: state.expenses.filter(e => e.tripId === trip.id),
      hotelExpenses: [],
      settlementGroups: [],
      sponsorships: [],
      settlementStatuses: [],
      ...over,
    }
  }

  it('keeps local items the server has never seen (push pending)', () => {
    const { trip, dip, manu, pari } = seedTrip()
    const e = addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    // Pull arrives WITHOUT the freshly-created local expense
    useStore.getState().mergeRemoteTrip(bundleFor(trip, { expenses: [] }))

    expect(useStore.getState().expenses.find(x => x.id === e.id)).toBeDefined()
    expect(due(trip.id)).toHaveLength(2) // settlements still computed from it
  })

  it('propagates remote deletions for items previously synced', () => {
    const { trip, dip, manu, pari } = seedTrip()
    const e = addEqualExpense(trip.id, 3000, dip.id, [dip.id, manu.id, pari.id])

    // First pull contains the expense → marked as known-on-server
    useStore.getState().mergeRemoteTrip(bundleFor(trip))
    expect(useStore.getState().synced[e.id]).toBe(true)

    // Second pull no longer contains it → deleted on another device
    useStore.getState().mergeRemoteTrip(bundleFor(trip, { expenses: [] }))

    expect(useStore.getState().expenses.find(x => x.id === e.id)).toBeUndefined()
    expect(due(trip.id)).toHaveLength(0) // settlements cascade with the deletion
  })
})
