// Mobile utils: money maths edge cases, formatting, invite links, UPI links.
import { describe, expect, it } from 'vitest'
import type { Expense, HotelExpense, Member, Trip } from '../types'
import {
  buildUpiLink, calculateBalances, calculateSettlements, createInviteLink, createInviteToken,
  createTripShareMessage, distributeEqually, extractJoinInput, formatCompactINR, formatIndianNumber,
  groupIndian, isValidUpiId, parseInviteToken, resolveExpenseSplits, resolveHotelSplits, roundMoney,
} from './utils'

const member = (id: string, name: string): Member => ({
  id, tripId: 't1', name, mobile: '', pin: '', avatarColor: 'hsl(262, 83%, 58%)', joinedAt: '',
})
const expense = (p: Partial<Expense>): Expense => ({
  id: 'e', tripId: 't1', title: 'x', amount: 0, paidBy: 'm1', category: 'food', participants: [],
  splitType: 'equal', splits: [], createdAt: '2026-09-23T10:00:00.000Z', ...p,
})

describe('splits', () => {
  it('splits equally to the paisa and always sums to the amount', () => {
    const shares: Record<string, number> = {}
    distributeEqually(100, ['m1', 'm2', 'm3'], shares)
    expect(shares).toEqual({ m1: 33.34, m2: 33.33, m3: 33.33 })
    expect(roundMoney(shares.m1 + shares.m2 + shares.m3)).toBe(100)
  })

  it('treats NaN and negative amounts as zero', () => {
    const nan: Record<string, number> = {}
    distributeEqually(NaN, ['a', 'b'], nan)
    expect(nan).toEqual({ a: 0, b: 0 })
    const neg: Record<string, number> = {}
    distributeEqually(-500, ['a', 'b'], neg)
    expect(neg).toEqual({ a: 0, b: 0 })
  })

  it('resolves custom splits', () => {
    const shares = resolveExpenseSplits(expense({
      amount: 1500, participants: ['m1', 'm2'], splitType: 'custom',
      splits: [{ memberId: 'm1', value: 1000 }, { memberId: 'm2', value: 500 }],
    }))
    expect(shares).toEqual({ m1: 1000, m2: 500 })
  })

  it('splits hotel rooms among their occupants only', () => {
    const hotel: HotelExpense = {
      id: 'h1', tripId: 't1', title: 'Resort', totalAmount: 5000, paidBy: 'm1', createdAt: '',
      rooms: [
        { id: 'r1', name: 'Room 1', cost: 3000, occupantIds: ['m1', 'm2', 'm3'] },
        { id: 'r2', name: 'Room 2', cost: 2000, occupantIds: ['m4', 'm5'] },
        { id: 'r3', name: 'Empty', cost: 999, occupantIds: [] },
      ],
    }
    expect(resolveHotelSplits(hotel)).toEqual({ m1: 1000, m2: 1000, m3: 1000, m4: 1000, m5: 1000 })
  })
})

describe('balances and settlements', () => {
  const members = [member('m1', 'Alice'), member('m2', 'Bob'), member('m3', 'Charlie')]

  it('nets a shared lunch into two payments to the payer', () => {
    const balances = calculateBalances([expense({ amount: 300, participants: ['m1', 'm2', 'm3'] })], [], members)
    expect(balances.map(b => b.netBalance)).toEqual([200, -100, -100])
    const routes = calculateSettlements(balances, members)
    expect(routes.map(r => [r.fromMemberId, r.toMemberId, r.amount])).toEqual([
      ['m2', 'm1', 100],
      ['m3', 'm1', 100],
    ])
  })

  it('collapses a circular debt to no payments', () => {
    const balances = calculateBalances([
      expense({ id: 'a', amount: 300, paidBy: 'm1', participants: ['m1', 'm2'] }),
      expense({ id: 'b', amount: 300, paidBy: 'm2', participants: ['m2', 'm3'] }),
      expense({ id: 'c', amount: 300, paidBy: 'm3', participants: ['m3', 'm1'] }),
    ], [], members)
    expect(balances.every(b => b.netBalance === 0)).toBe(true)
    expect(calculateSettlements(balances, members)).toHaveLength(0)
  })
})

describe('formatting', () => {
  it('groups digits the Indian way', () => {
    expect(groupIndian('1234567')).toBe('12,34,567')
    expect(formatIndianNumber(125000.5)).toBe('1,25,000.5')
    expect(formatIndianNumber(-42)).toBe('-42')
  })

  it('compacts lakhs and crores', () => {
    expect(formatCompactINR(125000)).toBe('₹1.25L')
    expect(formatCompactINR(25_000_000)).toBe('₹2.50Cr')
  })
})

describe('invites and sharing', () => {
  const trip: Trip = {
    id: '6f1c2c1e-1111-4222-8333-444455556666', tripCode: 'TRP-AB12', name: 'गोवा ट्रिप 🏖️', password: 'secret',
    creatorId: 'm1', status: 'active', createdAt: '2026-09-23T10:00:00.000Z',
  }

  it('round-trips an invite without ever containing the password', () => {
    const token = createInviteToken(trip)
    const parsed = parseInviteToken(token)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.payload.trip.name).toBe(trip.name)
      expect(JSON.stringify(parsed.payload)).not.toContain('secret')
    }
    const link = createInviteLink(trip, 'https://tripmate.example')
    expect(link.startsWith('https://tripmate.example/join-trip?invite=')).toBe(true)
    const fromLink = parseInviteToken(extractJoinInput(link).invite ?? null)
    expect(fromLink.ok && fromLink.payload.trip.tripCode).toBe('TRP-AB12')
  })

  it('pulls a code or invite out of whatever was pasted', () => {
    expect(extractJoinInput('  trp-ab12 ')).toEqual({ code: 'TRP-AB12' })
    expect(extractJoinInput('Join: https://x.app/join-trip?code=TRP-ZZ99')).toEqual({ code: 'TRP-ZZ99' })
    expect(extractJoinInput('https://x.app/join-trip?invite=abc_-123&x=1')).toEqual({ invite: 'abc_-123' })
  })

  it('writes a share message with the code and never the password', () => {
    const msg = createTripShareMessage(trip, 'https://x.app/join-trip?invite=t')
    expect(msg).toContain('TRP-AB12')
    expect(msg).toContain('https://x.app/join-trip?invite=t')
    expect(msg).not.toContain('secret')
  })
})

describe('UPI', () => {
  it('strips line breaks and clamps bad amounts', () => {
    const link = buildUpiLink('test@upi\r\nBcc: x', 'Alice\r\nSubject', 250, 'Dinner\r\nPAY')
    expect(link).not.toMatch(/[\r\n]/)
    expect(buildUpiLink('test@upi', 'Bob', -100, 'Refund')).toContain('am=0.00')
    expect(buildUpiLink('a.b@okhdfcbank', 'Ann Lee', 99.999, 'Trip')).toBe(
      'upi://pay?pa=a.b@okhdfcbank&pn=Ann%20Lee&am=100.00&tn=Trip&cu=INR'
    )
  })

  it('validates UPI IDs', () => {
    expect(isValidUpiId('rahul.k@okicici')).toBe(true)
    expect(isValidUpiId('9876543210@paytm')).toBe(true)
    expect(isValidUpiId('no-at-sign')).toBe(false)
    expect(isValidUpiId('x@1bank')).toBe(false)
  })
})
