import { describe, it, expect } from 'vitest'
import {
  distributeEqually,
  roundMoney,
  buildUpiLink,
  createInviteToken,
  parseInviteToken,
  calculateBalances,
  calculateSettlements,
  resolveExpenseSplits,
  inviteSignature,
} from '../utils'
import type { Trip, Member, Expense } from '@/types'

describe('Adversarial & Security Gate Audits', () => {
  // ─── GATE 01: Secrets Containment ──────────────────────────────────────────
  it('Gate 01: Invite token never exposes raw password in encoded payload', () => {
    const rawTrip: Trip = {
      id: 'trip-1',
      tripCode: 'TRP-SAFE',
      name: 'Goa Holiday',
      password: 'SUPER_SECRET_PLAINTEXT_PASSWORD_123',
      creatorId: 'member-1',
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    const token = createInviteToken(rawTrip)
    const result = parseInviteToken(token)

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Trip payload must not contain plaintext password
      expect((result.payload.trip as any).password).toBeUndefined()
      // Signature exists and verifies correctly without storing password
      expect(result.payload.sig).toBe(inviteSignature(rawTrip.tripCode, 'SUPER_SECRET_PLAINTEXT_PASSWORD_123'))
      // Must not match wrong password
      expect(result.payload.sig).not.toBe(inviteSignature(rawTrip.tripCode, 'WRONG_PASSWORD'))
    }
  })

  // ─── GATE 02: Authentication & Token Tampering ─────────────────────────────
  it('Gate 02: Rejects tampered, corrupt, and forged invite tokens', () => {
    // Empty / null tokens
    expect(parseInviteToken(null).ok).toBe(false)
    expect(parseInviteToken('').ok).toBe(false)
    expect(parseInviteToken('    ').ok).toBe(false)

    // Malicious corrupt base64
    expect(parseInviteToken('not-valid-base64!@#$%^&*()').ok).toBe(false)
    expect(parseInviteToken('e30=').ok).toBe(false) // empty JSON object {}

    // Forged payload with missing signature
    const forgedNoSig = Buffer.from(JSON.stringify({
      v: 2,
      trip: { id: 'fake', tripCode: 'TRP-FAKE' }
    })).toString('base64')
    expect(parseInviteToken(forgedNoSig).ok).toBe(false)

    // Expired token
    const expiredPayload = Buffer.from(JSON.stringify({
      v: 2,
      trip: { id: 'fake', tripCode: 'TRP-FAKE' },
      sig: 'abcdef1234567890',
      exp: Date.now() - 10000, // expired in the past
    })).toString('base64')
    const expiredResult = parseInviteToken(expiredPayload)
    expect(expiredResult.ok).toBe(false)
    if (!expiredResult.ok) {
      expect(expiredResult.reason).toBe('expired')
    }
  })

  // ─── GATE 03: Input Validation & Boundary Hardening ───────────────────────
  it('Gate 03: distributeEqually safely handles NaN, Infinity, negative values, and zero participants', () => {
    const outNaN: Record<string, number> = {}
    distributeEqually(NaN, ['m1', 'm2'], outNaN)
    expect(outNaN['m1']).toBe(0)
    expect(outNaN['m2']).toBe(0)

    const outInf: Record<string, number> = {}
    distributeEqually(Infinity, ['m1', 'm2'], outInf)
    expect(outInf['m1']).toBe(0)
    expect(outInf['m2']).toBe(0)

    const outNeg: Record<string, number> = {}
    distributeEqually(-500, ['m1', 'm2'], outNeg)
    expect(outNeg['m1']).toBe(0)
    expect(outNeg['m2']).toBe(0)

    const outZero: Record<string, number> = {}
    distributeEqually(100, [], outZero)
    expect(Object.keys(outZero).length).toBe(0)
  })

  it('Gate 03: roundMoney neutralizes NaN and non-finite floats', () => {
    expect(roundMoney(NaN)).toBe(0)
    expect(roundMoney(Infinity)).toBe(0)
    expect(roundMoney(-Infinity)).toBe(0)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(123.456)).toBe(123.46)
  })

  // ─── GATE 05: UPI Payment Link & CRLF Injection Hardening ──────────────────
  it('Gate 05: buildUpiLink strips CRLF and sanitizes amounts against negative/NaN manipulation', () => {
    // CRLF header injection attempt
    const maliciousUpi = 'alice@upi\r\nBcc: evil@hacker.com'
    const maliciousName = 'Alice\r\nSubject: Fake Subject'
    const maliciousNote = 'Lunch payment\r\nSET-COOKIE: admin=1'

    const upiUri = buildUpiLink(maliciousUpi, maliciousName, 150, maliciousNote)

    // Verify newline injection was completely stripped
    expect(upiUri).not.toContain('\r')
    expect(upiUri).not.toContain('\n')
    expect(upiUri).toContain('pa=alice%40upiBcc%3A+evil%40hacker.com')

    // Negative amount injection
    const negativeUpi = buildUpiLink('bob@upi', 'Bob', -100, 'Refund')
    expect(negativeUpi).toContain('am=0.00')

    // NaN amount injection
    const nanUpi = buildUpiLink('bob@upi', 'Bob', NaN, 'Test')
    expect(nanUpi).toContain('am=0.00')
  })

  // ─── GATE 08 & 09: Financial Precision & Circular Debt Resolution ──────────
  it('Gate 08 & 09: 3-way split of 100.00 preserves exact 100.00 paise without drift', () => {
    const out: Record<string, number> = {}
    distributeEqually(100, ['m1', 'm2', 'm3'], out)

    expect(out['m1']).toBe(33.34)
    expect(out['m2']).toBe(33.33)
    expect(out['m3']).toBe(33.33)

    const sum = roundMoney(out['m1'] + out['m2'] + out['m3'])
    expect(sum).toBe(100.00)
  })

  it('Gate 08 & 09: Micro-splits (₹0.05 across 10 participants) sum to exact amount', () => {
    const participants = Array.from({ length: 10 }, (_, i) => `p${i}`)
    const out: Record<string, number> = {}
    distributeEqually(0.05, participants, out)

    // Exactly 5 members receive 0.01 and 5 receive 0.00
    const total = participants.reduce((acc, p) => acc + out[p], 0)
    expect(roundMoney(total)).toBe(0.05)
  })

  it('Gate 08 & 09: Circular debt cycle (A->B, B->C, C->A) resolves to zero settlements', () => {
    const members: Member[] = [
      { id: 'A', tripId: 't1', name: 'Alice', mobile: '1111111111', pin: '1111', avatarColor: '#8B5CF6', joinedAt: '' },
      { id: 'B', tripId: 't1', name: 'Bob', mobile: '2222222222', pin: '2222', avatarColor: '#EC4899', joinedAt: '' },
      { id: 'C', tripId: 't1', name: 'Charlie', mobile: '3333333333', pin: '3333', avatarColor: '#10B981', joinedAt: '' },
    ]

    // A pays 300 for A and B (B owes A 150)
    // B pays 300 for B and C (C owes B 150)
    // C pays 300 for C and A (A owes C 150)
    const expenses: Expense[] = [
      {
        id: 'e1', tripId: 't1', title: 'A pays for B', amount: 300, paidBy: 'A',
        category: 'food', splitType: 'equal', participants: ['A', 'B'], splits: [], createdAt: '',
      },
      {
        id: 'e2', tripId: 't1', title: 'B pays for C', amount: 300, paidBy: 'B',
        category: 'food', splitType: 'equal', participants: ['B', 'C'], splits: [], createdAt: '',
      },
      {
        id: 'e3', tripId: 't1', title: 'C pays for A', amount: 300, paidBy: 'C',
        category: 'food', splitType: 'equal', participants: ['C', 'A'], splits: [], createdAt: '',
      },
    ]

    const balances = calculateBalances(expenses, [], members)
    // Everyone paid 300 and owes 300 -> netBalance is 0
    balances.forEach(b => {
      expect(b.netBalance).toBe(0)
    })

    const settlements = calculateSettlements(balances)
    // Minimizer correctly simplifies cycle to 0 transactions
    expect(settlements.length).toBe(0)
  })

  it('Gate 08 & 09: Self-payment expense does not create circular settlements or phantom debt', () => {
    const members: Member[] = [
      { id: 'A', tripId: 't1', name: 'Alice', mobile: '1111111111', pin: '1111', avatarColor: '#8B5CF6', joinedAt: '' },
      { id: 'B', tripId: 't1', name: 'Bob', mobile: '2222222222', pin: '2222', avatarColor: '#EC4899', joinedAt: '' },
    ]

    // Alice pays 500 solely for herself
    const expenses: Expense[] = [
      {
        id: 'e1', tripId: 't1', title: 'Alice Solo Meal', amount: 500, paidBy: 'A',
        category: 'food', splitType: 'equal', participants: ['A'], splits: [], createdAt: '',
      },
    ]

    const balances = calculateBalances(expenses, [], members)
    const aliceBalance = balances.find(b => b.memberId === 'A')
    const bobBalance = balances.find(b => b.memberId === 'B')

    expect(aliceBalance?.netBalance).toBe(0)
    expect(bobBalance?.netBalance).toBe(0)

    const settlements = calculateSettlements(balances)
    expect(settlements.length).toBe(0)
  })
})
