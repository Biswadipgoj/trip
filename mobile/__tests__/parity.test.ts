// Web ↔ mobile parity: both clients read and write the same trips, so their
// money maths must agree exactly. Hundreds of seeded random trips (equal /
// custom / percentage / quantity splits, multi-payer expenses, hotel rooms,
// couples, sponsorships and confirmed payments) are run through both.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as web from '../../src/lib/utils'
import * as mob from '../src/lib/utils'
import type {
  Expense, HotelExpense, Member, Settlement, SettlementGroup, SettlementRoute, Sponsorship, Trip,
} from '../src/types'

// Deterministic PRNG (mulberry32) so failures are reproducible by seed.
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function scenario(seed: number) {
  const r = prng(seed)
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
  const money = (lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 100) / 100
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const subset = <T,>(xs: T[], min = 1) => {
    const out = xs.filter(() => r() < 0.6)
    while (out.length < min) {
      const x = pick(xs)
      if (!out.includes(x)) out.push(x)
    }
    return out
  }

  const members: Member[] = Array.from({ length: int(2, 8) }, (_, i) => ({
    id: `m${i}`, tripId: 't', name: `Member ${i}`, mobile: `98765000${i}0`, pin: '1234',
    avatarColor: mob.getAvatarColor(i), joinedAt: '2026-09-01T00:00:00.000Z',
    upiId: r() < 0.5 ? `m${i}@okaxis` : undefined,
  }))
  const ids = members.map(m => m.id)

  const expenses: Expense[] = Array.from({ length: int(0, 22) }, (_, i) => {
    const amount = money(1, 20000)
    const participants = subset(ids)
    const kind = r()
    const base: Expense = {
      id: `e${i}`, tripId: 't', title: `E${i}`, amount, paidBy: pick(ids), category: 'food',
      participants, splitType: 'equal', splits: [], createdAt: `2026-09-${String(int(1, 28)).padStart(2, '0')}T10:00:00.000Z`,
    }
    if (kind < 0.15) {
      // custom: a random partition of the amount
      let left = amount
      base.splitType = 'custom'
      base.splits = participants.map((id, k) => {
        const v = k === participants.length - 1 ? Math.round(left * 100) / 100 : Math.round(left * r() * 100) / 100
        left = Math.round((left - v) * 100) / 100
        return { memberId: id, value: v }
      })
    } else if (kind < 0.22) {
      base.splitType = 'percentage'
      base.splits = participants.map(id => ({ memberId: id, value: int(0, 100) }))
    } else if (kind < 0.29) {
      base.splitType = 'quantity'
      base.splits = participants.map(id => ({ memberId: id, value: int(0, 6) }))
    }
    if (r() < 0.12 && ids.length > 1) {
      const payers = subset(ids, 2)
      const share = Math.round((amount / payers.length) * 100) / 100
      base.payers = payers.map((memberId, k) => ({
        memberId,
        amount: k === payers.length - 1 ? Math.round((amount - share * (payers.length - 1)) * 100) / 100 : share,
      }))
      base.paidBy = payers[0]
    }
    return base
  })

  const hotelExpenses: HotelExpense[] = Array.from({ length: int(0, 3) }, (_, i) => {
    const rooms = Array.from({ length: int(1, 3) }, (_, k) => ({
      id: `r${i}${k}`, name: `Room ${k + 1}`, cost: money(500, 9000), occupantIds: r() < 0.1 ? [] : subset(ids),
    }))
    return {
      id: `h${i}`, tripId: 't', title: `Hotel ${i}`, paidBy: pick(ids), rooms,
      totalAmount: Math.round(rooms.reduce((s, x) => s + x.cost, 0) * 100) / 100, createdAt: '2026-09-05T10:00:00.000Z',
    }
  })

  // Disjoint couples, and at most one sponsorship between members outside them.
  const shuffled = [...ids].sort(() => r() - 0.5)
  const groups: SettlementGroup[] = []
  let cursor = 0
  for (let g = 0; g < int(0, 2) && cursor + 1 < shuffled.length; g++) {
    const size = Math.min(int(2, 3), shuffled.length - cursor)
    groups.push({ id: `g${g}`, tripId: 't', name: `Unit ${g}`, memberIds: shuffled.slice(cursor, cursor + size) })
    cursor += size
  }
  const loose = shuffled.slice(cursor)
  const sponsorships: Sponsorship[] = loose.length >= 2 && r() < 0.4
    ? [{ id: 's0', tripId: 't', sponsorMemberId: loose[0], sponsoredMemberId: loose[1] }]
    : []

  return { r, members, expenses, hotelExpenses, groups, sponsorships }
}

/** Route ids are random per call — compare everything else. */
const stable = (routes: SettlementRoute[]) => routes.map(({ id: _id, ...rest }) => rest)

describe('money maths parity (web ↔ mobile)', () => {
  it('agrees on balances, confirmed transfers and settlements for 400 random trips', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const s = scenario(seed)
      const label = `seed ${seed}`

      const wb = web.calculateBalances(s.expenses, s.hotelExpenses, s.members)
      const mb = mob.calculateBalances(s.expenses, s.hotelExpenses, s.members)
      expect(mb, `${label}: balances`).toEqual(wb)

      const routes = web.calculateSettlements(wb, s.members, s.groups, s.sponsorships)
      expect(stable(mob.calculateSettlements(mb, s.members, s.groups, s.sponsorships)), `${label}: routes`).toEqual(stable(routes))

      // Confirm a random subset of the payments (with the group snapshot the
      // store records), then everything downstream must still match.
      const confirmed: Settlement[] = routes
        .filter(() => s.r() < 0.5)
        .map((rt, k) => ({
          id: `c${k}`, tripId: 't', fromMemberId: rt.fromMemberId, toMemberId: rt.toMemberId, amount: rt.amount,
          status: 'confirmed' as const,
          fromGroupIds: rt.fromMemberIds && rt.fromMemberIds.length > 1 ? rt.fromMemberIds : undefined,
          toGroupIds: rt.toMemberIds && rt.toMemberIds.length > 1 ? rt.toMemberIds : undefined,
        }))

      const wn = web.calculateNetBalances(s.expenses, s.hotelExpenses, s.members, confirmed, s.groups, s.sponsorships)
      const mn = mob.calculateNetBalances(s.expenses, s.hotelExpenses, s.members, confirmed, s.groups, s.sponsorships)
      expect(mn, `${label}: net balances`).toEqual(wn)
      expect(
        stable(mob.calculateSettlements(mn, s.members, s.groups, s.sponsorships)),
        `${label}: residual routes`
      ).toEqual(stable(web.calculateSettlements(wn, s.members, s.groups, s.sponsorships)))
    }
  })

  it('never leaves money unaccounted for (net balances sum to zero)', () => {
    for (let seed = 500; seed < 700; seed++) {
      const s = scenario(seed)
      const sum = mob.calculateBalances(s.expenses, s.hotelExpenses, s.members).reduce((t, b) => t + b.netBalance, 0)
      // percentage/quantity splits may leave a remainder by design (web parity)
      const exact = s.expenses.every(e => e.splitType === 'equal' || e.splitType === 'custom')
        && s.hotelExpenses.every(h => h.rooms.every(r => r.occupantIds.length > 0))
      if (exact) expect(Math.abs(sum), `seed ${seed}`).toBeLessThan(0.05)
    }
  })
})

describe('invite links (web ↔ mobile)', () => {
  const trip: Trip = {
    id: '6f1c2c1e-1111-4222-8333-444455556666', tripCode: 'TRP-AB12', name: 'गोवा ट्रिप 🏖️ “Monsoon”',
    password: 'p@ss wörd', creatorId: 'c1', status: 'active', createdAt: '2026-09-23T10:00:00.000Z',
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T12:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('produces byte-identical tokens and signatures', () => {
    expect(mob.createInviteToken(trip)).toBe(web.createInviteToken(trip))
    expect(mob.inviteSignature('trp-ab12', 'p@ss wörd')).toBe(web.inviteSignature('trp-ab12', 'p@ss wörd'))
    for (const s of ['', 'a', 'TRP-ZZZZ|pass', '✈️🏖️', 'x'.repeat(500)]) {
      expect(mob.hashInviteSecret(s)).toBe(web.hashInviteSecret(s))
    }
  })

  it('parses links created by the other client', () => {
    const fromWeb = mob.parseInviteToken(web.createInviteToken(trip))
    const fromMobile = web.parseInviteToken(mob.createInviteToken(trip))
    expect(fromWeb.ok && fromWeb.payload.trip.name).toBe(trip.name)
    expect(fromMobile.ok && fromMobile.payload.trip.name).toBe(trip.name)
    expect(fromWeb.ok && fromWeb.payload.sig).toBe(web.inviteSignature(trip.tripCode, trip.password))
  })

  it('rejects expired and mangled links the same way', () => {
    const token = mob.createInviteToken(trip)
    vi.setSystemTime(new Date('2026-12-31T00:00:00.000Z'))
    expect(mob.parseInviteToken(token)).toEqual(web.parseInviteToken(token))
    expect(mob.parseInviteToken(token)).toEqual({ ok: false, reason: 'expired' })
    expect(mob.parseInviteToken('not a token')).toEqual({ ok: false, reason: 'invalid' })
  })
})
