import { describe, it, expect } from 'vitest'
import {
  calculateBalances, calculateSettlements, calculateNetBalances,
  applyConfirmedTransfers, resolveExpenseSplits, roundMoney,
  createInviteToken, parseInviteToken, inviteSignature,
} from '@/lib/utils'
import type { Expense, Member, Settlement, Trip } from '@/types'

const TRIP_ID = '00000000-0000-4000-8000-00000000aaaa'

function member(id: string, name: string): Member {
  return {
    id, tripId: TRIP_ID, name, mobile: `90000000${id.slice(-2)}`, pin: '1234',
    avatarColor: 'hsl(262, 83%, 58%)', joinedAt: new Date().toISOString(),
  }
}

function expense(over: Partial<Expense> & Pick<Expense, 'amount' | 'paidBy' | 'participants'>): Expense {
  return {
    id: crypto.randomUUID(), tripId: TRIP_ID, title: 'Test', category: 'food',
    splitType: 'equal', splits: [], createdAt: new Date().toISOString(),
    ...over,
  }
}

const dip = member('m-00000001', 'Dip')
const manu = member('m-00000002', 'Manu')
const pari = member('m-00000003', 'Parijit')
const members = [dip, manu, pari]

describe('resolveExpenseSplits', () => {
  it('splits equally with paise accuracy (shares always sum to the total)', () => {
    const shares = resolveExpenseSplits(
      expense({ amount: 100, paidBy: dip.id, participants: members.map(m => m.id) })
    )
    const total = Object.values(shares).reduce((s, v) => s + v, 0)
    expect(roundMoney(total)).toBe(100)
    expect(Object.values(shares).every(v => v === 33.33 || v === 33.34)).toBe(true)
  })

  it('respects custom split amounts', () => {
    const shares = resolveExpenseSplits(
      expense({
        amount: 1000, paidBy: dip.id, participants: [dip.id, manu.id],
        splitType: 'custom',
        splits: [{ memberId: dip.id, value: 700 }, { memberId: manu.id, value: 300 }],
      })
    )
    expect(shares[dip.id]).toBe(700)
    expect(shares[manu.id]).toBe(300)
  })
})

describe('calculateBalances', () => {
  it('credits the payer and debits each participant', () => {
    const balances = calculateBalances(
      [expense({ amount: 3000, paidBy: dip.id, participants: members.map(m => m.id) })],
      [], members
    )
    const get = (id: string) => balances.find(b => b.memberId === id)!
    expect(get(dip.id).netBalance).toBe(2000)
    expect(get(manu.id).netBalance).toBe(-1000)
    expect(get(pari.id).netBalance).toBe(-1000)
  })
})

describe('calculateSettlements (transaction minimizer)', () => {
  it('produces at most n-1 transactions that zero out all balances', () => {
    const balances = calculateBalances(
      [
        expense({ amount: 3000, paidBy: dip.id, participants: members.map(m => m.id) }),
        expense({ amount: 900, paidBy: manu.id, participants: members.map(m => m.id) }),
      ],
      [], members
    )
    const routes = calculateSettlements(balances, members, [], [])
    expect(routes.length).toBeLessThanOrEqual(members.length - 1)

    // Replaying the routes as transfers must settle everyone
    const settled = applyConfirmedTransfers(
      balances,
      routes.map(r => ({ ...r, status: 'confirmed' as const }))
    )
    settled.forEach(b => expect(Math.abs(b.netBalance)).toBeLessThan(0.01))
  })
})

describe('applyConfirmedTransfers', () => {
  const balances = calculateBalances(
    [expense({ amount: 3000, paidBy: dip.id, participants: members.map(m => m.id) })],
    [], members
  )

  const transfer = (status: Settlement['status']): Pick<
    Settlement, 'fromMemberId' | 'toMemberId' | 'amount' | 'status'
  > => ({ fromMemberId: manu.id, toMemberId: dip.id, amount: 1000, status })

  it('moves cash for confirmed payments', () => {
    const adjusted = applyConfirmedTransfers(balances, [transfer('confirmed')])
    expect(adjusted.find(b => b.memberId === manu.id)!.netBalance).toBe(0)
    expect(adjusted.find(b => b.memberId === dip.id)!.netBalance).toBe(1000)
  })

  it('ignores pending and paid (unconfirmed) settlements', () => {
    for (const status of ['pending', 'paid'] as const) {
      const adjusted = applyConfirmedTransfers(balances, [transfer(status)])
      expect(adjusted.find(b => b.memberId === manu.id)!.netBalance).toBe(-1000)
    }
  })

  it('never mutates the input balances', () => {
    const before = JSON.stringify(balances)
    applyConfirmedTransfers(balances, [transfer('confirmed')])
    expect(JSON.stringify(balances)).toBe(before)
  })
})

describe('calculateNetBalances + minimizer cascade', () => {
  it('recalculates settlements from the residual after a confirmation', () => {
    const expenses = [expense({ amount: 3000, paidBy: dip.id, participants: members.map(m => m.id) })]
    const confirmed: Settlement = {
      id: crypto.randomUUID(), tripId: TRIP_ID,
      fromMemberId: manu.id, toMemberId: dip.id, amount: 1000, status: 'confirmed',
    }
    const net = calculateNetBalances(expenses, [], members, [confirmed])
    const routes = calculateSettlements(net, members, [], [])
    // Manu already paid — only Parijit's due remains
    expect(routes).toHaveLength(1)
    expect(routes[0].fromMemberId).toBe(pari.id)
    expect(routes[0].toMemberId).toBe(dip.id)
    expect(routes[0].amount).toBe(1000)
  })
})

describe('invite tokens', () => {
  const trip: Trip = {
    id: '00000000-0000-4000-8000-00000000bbbb', tripCode: 'TRP-TEST', name: 'Goa',
    password: 'secret', creatorId: dip.id, status: 'active',
    createdAt: new Date().toISOString(),
  }

  it('round-trips a trip through the invite link without leaking the password', () => {
    const token = createInviteToken(trip)
    expect(token).not.toContain('secret')
    const parsed = parseInviteToken(token)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.payload.trip.id).toBe(trip.id)
      expect(parsed.payload.trip.tripCode).toBe('TRP-TEST')
      expect('password' in parsed.payload.trip).toBe(false)
      // Signature validates the real password, rejects a wrong one
      expect(inviteSignature('TRP-TEST', 'secret')).toBe(parsed.payload.sig)
      expect(inviteSignature('TRP-TEST', 'wrong')).not.toBe(parsed.payload.sig)
    }
  })

  it('rejects garbage tokens', () => {
    expect(parseInviteToken('not-a-token').ok).toBe(false)
    expect(parseInviteToken(null).ok).toBe(false)
  })
})
