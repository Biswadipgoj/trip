// The Android login lists and orders trips exactly like the website.
import { describe, expect, it } from 'vitest'
import * as web from '../../src/lib/tripLogin'
import * as mob from '../src/lib/tripLogin'

const trips = [
  { id: 't1', tripCode: 'TRP-1', name: 'Goa', password: '', creatorId: '', status: 'active', createdAt: '2026-09-01T00:00:00Z' },
  { id: 't2', tripCode: 'TRP-2', name: 'Manali', password: '', creatorId: '', status: 'closed', createdAt: '2026-05-01T00:00:00Z' },
  { id: 't3', tripCode: 'TRP-3', name: 'Ooty', password: '', creatorId: '', status: 'active', createdAt: '2026-07-01T00:00:00Z' },
] as any[]
const m = (id: string, tripId: string, mobile: string, pin: string) => ({ id, tripId, name: id, mobile, pin, avatarColor: '', joinedAt: '' })
const members = [
  m('a1', 't1', '9876543210', '1234'), m('b1', 't1', '9123456780', '1111'),
  m('a2', 't2', '9876543210', '5678'), m('a3', 't3', '9876543210', '4321'), m('x', 't3', '9000000000', ''),
] as any[]

describe('trip login parity (web ↔ Android)', () => {
  it('finds the same trips for a number and orders them the same way', () => {
    for (const mobile of ['9876543210', '9123456780', '9000000000', '9999999999']) {
      const w = web.sortTripChoices(web.localTripChoices(trips, members, mobile))
      const a = mob.sortTripChoices(mob.localTripChoices(trips, members, mobile))
      expect(a).toEqual(w)
    }
    expect(mob.sortTripChoices(mob.localTripChoices(trips, members, '9876543210')).map(c => c.tripId)).toEqual(['t1', 't3', 't2'])
  })

  it('merges cloud and device results the same way', () => {
    const local = mob.localTripChoices(trips, members, '9876543210')
    const cloud = [{ ...local[0], status: 'closed' as const, memberCount: 9 }]
    expect(mob.mergeTripChoices(local, cloud)).toEqual(web.mergeTripChoices(local, cloud))
  })

  it('normalises and validates numbers the same way', () => {
    for (const raw of ['+91 98765 43210', '09876543210', '98765-43210', '98765432109', '123']) {
      expect(mob.normalizeMobileInput(raw)).toBe(web.normalizeMobileInput(raw))
      expect(mob.isValidMobile(mob.normalizeMobileInput(raw))).toBe(web.isValidMobile(web.normalizeMobileInput(raw)))
    }
  })
})
