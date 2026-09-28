import { describe, expect, it } from 'vitest'
import { calculateBalances, calculateSettlements } from '@/lib/utils'
import { GUIDES } from '@/lib/guides'
import type { Expense, Member } from '@/types'

// The worked examples on the SEO guide pages must be exactly what TripMate computes.
describe('guide worked examples match the real settlement engine', () => {
  for (const guide of GUIDES) {
    it(`/${guide.slug}`, () => {
      const { people, expenses, settlements } = guide.example
      const members: Member[] = people.map(name => ({
        id: name, tripId: 't', name, mobile: '', pin: '', avatarColor: '', joinedAt: '',
      }))
      const rows: Expense[] = expenses.map((e, i) => ({
        id: `e${i}`, tripId: 't', title: e.what, amount: e.amount, paidBy: e.paidBy,
        category: 'food', splitType: 'equal', participants: people, splits: [], createdAt: '',
      }))
      const routes = calculateSettlements(calculateBalances(rows, [], members), members)
      const got = routes.map(r => ({ from: r.fromMemberId, to: r.toMemberId, amount: r.amount }))
      expect(got).toEqual(settlements)
    })
  }

  it('every guide has a unique slug, a title under 70 chars and a description under 170', () => {
    expect(new Set(GUIDES.map(g => g.slug)).size).toBe(GUIDES.length)
    for (const g of GUIDES) {
      expect(g.title.length).toBeLessThanOrEqual(70)
      expect(g.description.length).toBeLessThanOrEqual(170)
      expect(g.faqs.length).toBeGreaterThanOrEqual(3)
    }
  })
})
