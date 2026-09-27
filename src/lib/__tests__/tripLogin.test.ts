import { describe, expect, it } from 'vitest'
import { isValidMobile, localTripChoices, mergeTripChoices, sortTripChoices, type TripChoice } from '../tripLogin'
import type { Member, Trip } from '@/types'

const choice = (tripId: string, status: 'active' | 'closed', createdAt: string, extra: Partial<TripChoice> = {}): TripChoice => ({
  tripId, tripCode: `TRP-${tripId}`, name: `Trip ${tripId}`, status, createdAt,
  memberId: `m-${tripId}`, memberName: 'Asha', memberCount: 3, ...extra,
})

describe('sortTripChoices', () => {
  it('puts live trips first, newest first within each group', () => {
    const sorted = sortTripChoices([
      choice('old-live', 'active', '2026-01-01T00:00:00Z'),
      choice('new-closed', 'closed', '2026-09-01T00:00:00Z'),
      choice('new-live', 'active', '2026-08-01T00:00:00Z'),
      choice('old-closed', 'closed', '2025-12-01T00:00:00Z'),
    ])
    expect(sorted.map(c => c.tripId)).toEqual(['new-live', 'old-live', 'new-closed', 'old-closed'])
  })
})

describe('localTripChoices', () => {
  const trips = [
    { id: 't1', tripCode: 'TRP-1', name: 'Goa', password: '', creatorId: '', status: 'active', createdAt: '2026-09-01T00:00:00Z' },
    { id: 't2', tripCode: 'TRP-2', name: 'Manali', password: '', creatorId: '', status: 'closed', createdAt: '2026-05-01T00:00:00Z' },
  ] as Trip[]
  const m = (id: string, tripId: string, mobile: string, pin: string) =>
    ({ id, tripId, name: id, mobile, pin, avatarColor: '', joinedAt: '' }) as Member
  const members = [
    m('a1', 't1', '9876543210', '1234'),
    m('b1', 't1', '9123456780', '1111'),
    m('a2', 't2', '9876543210', '5678'),
    m('manual', 't2', '9000000000', ''),
  ]

  it('finds every trip the number belongs to, with member counts', () => {
    const found = localTripChoices(trips, members, '9876543210')
    expect(found.map(c => [c.tripId, c.memberId, c.memberCount])).toEqual([['t1', 'a1', 2], ['t2', 'a2', 2]])
  })

  it('skips members without a PIN, who cannot log in', () => {
    expect(localTripChoices(trips, members, '9000000000')).toEqual([])
  })
})

describe('mergeTripChoices', () => {
  it('dedupes by trip, preferring the cloud copy, and sorts', () => {
    const merged = mergeTripChoices(
      [choice('x', 'active', '2026-01-01T00:00:00Z', { memberCount: 1 })],
      [choice('x', 'closed', '2026-01-01T00:00:00Z', { memberCount: 4 }), choice('y', 'active', '2026-02-01T00:00:00Z')],
    )
    expect(merged.map(c => [c.tripId, c.status, c.memberCount])).toEqual([['y', 'active', 3], ['x', 'closed', 4]])
  })
})

describe('isValidMobile', () => {
  it('accepts Indian 10-digit mobiles only', () => {
    expect(isValidMobile('9876543210')).toBe(true)
    expect(isValidMobile('1234567890')).toBe(false)
    expect(isValidMobile('98765')).toBe(false)
  })
})
