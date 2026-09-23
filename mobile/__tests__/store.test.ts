// Store rules that keep offline edits and cloud sync safe. Remote calls and
// AsyncStorage are mocked; everything else is the real store.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = vi.hoisted(() => new Map<string, string>())
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => memory.get(k) ?? null,
    setItem: async (k: string, v: string) => void memory.set(k, v),
    removeItem: async (k: string) => void memory.delete(k),
  },
}))

// Remote layer: off by default; individual tests switch it on and decide
// whether pushes succeed.
const remote = vi.hoisted(() => ({ enabled: false, ok: true }))
vi.mock('../src/lib/remote', () => {
  const push = vi.fn(async () => remote.ok)
  return {
    isRemoteEnabled: () => remote.enabled,
    describeError: (e: unknown) => String(e),
    remoteCreateTrip: push, remoteCloseTrip: push, remoteEnsureTrip: push, remoteAddManualMember: push,
    remoteUpdateMemberUpi: push, remotePushExpense: push, remoteDeleteExpense: push, remotePushHotelExpense: push,
    remoteDeleteHotelExpense: push, remotePushSettlementStatus: push, remotePushSettlementGroup: push,
    remoteDeleteSettlementGroup: push, remotePushSponsorship: push, remoteDeleteSponsorship: push,
    remoteSetTripCreator: push, remoteHealExpenseParticipants: push, remoteHealHotelRooms: push,
    remoteDeleteAttachment: push, remoteRemoveMedia: push,
  }
})

import { migratePersisted, setLocalFileCleaner, useStore } from '../src/lib/store'
import type { TripBundle } from '../src/lib/remote'
import { isUuid } from '../src/lib/utils'

const initial = useStore.getState()

function reset() {
  useStore.setState({
    ...initial,
    trips: [], members: [], expenses: [], hotelExpenses: [], settlements: [], settlementGroups: [],
    sponsorships: [], attachments: [], outbox: [], synced: {}, session: null,
  })
  remote.enabled = false
  remote.ok = true
}

/** Trip with Asha (creator), Bala and Chetan. */
function setupTrip() {
  const s = useStore.getState()
  const { trip, member: asha } = s.createTrip('Goa', 'Asha', '9876500001', 'pass', '1111')
  const bala = s.addMember(trip.id, 'Bala')
  const chetan = s.addMember(trip.id, 'Chetan')
  return { trip, asha, bala, chetan }
}

function bundleFor(tripId: string, patch: Partial<TripBundle> = {}): TripBundle {
  const s = useStore.getState()
  return {
    trip: s.trips.find(t => t.id === tripId)!,
    members: s.members.filter(m => m.tripId === tripId),
    expenses: [],
    hotelExpenses: [],
    settlementGroups: [],
    sponsorships: [],
    settlementStatuses: [],
    attachments: [],
    ...patch,
  }
}

beforeEach(reset)

describe('settlements', () => {
  it('turns a shared expense into minimal dues and cascades a confirmed payment', () => {
    const { trip, asha, bala, chetan } = setupTrip()
    const s = useStore.getState()
    s.addExpense({
      tripId: trip.id, title: 'Dinner', amount: 900, paidBy: asha.id, category: 'food',
      participants: [asha.id, bala.id, chetan.id], splitType: 'equal', splits: [],
    })
    let dues = useStore.getState().settlements.filter(x => x.status !== 'confirmed')
    expect(dues.map(d => [d.fromMemberId, d.toMemberId, d.amount]).sort()).toEqual(
      [[bala.id, asha.id, 300], [chetan.id, asha.id, 300]].sort()
    )

    const balaDue = dues.find(d => d.fromMemberId === bala.id)!
    s.updateSettlementStatus(balaDue.id, 'paid')
    expect(useStore.getState().settlements.find(x => x.id === balaDue.id)?.status).toBe('paid')

    s.updateSettlementStatus(balaDue.id, 'confirmed')
    const after = useStore.getState().settlements
    expect(after.filter(x => x.status === 'confirmed')).toHaveLength(1)
    dues = after.filter(x => x.status !== 'confirmed')
    expect(dues.map(d => [d.fromMemberId, d.amount])).toEqual([[chetan.id, 300]])
  })

  it('keeps due ids stable across recalculations', () => {
    const { trip, asha, bala } = setupTrip()
    const s = useStore.getState()
    s.addExpense({ tripId: trip.id, title: 'Cab', amount: 400, paidBy: asha.id, category: 'travel', participants: [asha.id, bala.id], splitType: 'equal', splits: [] })
    const id = useStore.getState().settlements[0].id
    s.generateSettlements(trip.id)
    s.generateSettlements(trip.id)
    expect(useStore.getState().settlements[0].id).toBe(id)
  })
})

describe('merging the cloud copy', () => {
  it('does not resurrect an expense deleted offline', async () => {
    const { trip, asha, bala } = setupTrip()
    remote.enabled = true
    remote.ok = false // offline: the delete stays queued
    const s = useStore.getState()
    const e = s.addExpense({ tripId: trip.id, title: 'Snacks', amount: 200, paidBy: asha.id, category: 'food', participants: [asha.id, bala.id], splitType: 'equal', splits: [] })
    useStore.setState(st => ({ synced: { ...st.synced, [e.id]: true } }))
    s.deleteExpense(e.id)
    await s.flushOutbox(trip.id)
    expect(useStore.getState().outbox.some(o => o.op.kind === 'delete')).toBe(true)

    s.mergeRemoteTrip(bundleFor(trip.id, { expenses: [e] }))
    expect(useStore.getState().expenses.find(x => x.id === e.id)).toBeUndefined()
  })

  it('does not revert a UPI ID edited offline', async () => {
    const { trip, bala } = setupTrip()
    remote.enabled = true
    remote.ok = false
    useStore.getState().updateMemberUpi(bala.id, 'bala@okaxis')
    const stale = useStore.getState().members.filter(m => m.tripId === trip.id).map(m => ({ ...m, upiId: undefined }))
    useStore.getState().mergeRemoteTrip(bundleFor(trip.id, { members: stale }))
    expect(useStore.getState().members.find(m => m.id === bala.id)?.upiId).toBe('bala@okaxis')
  })

  it('keeps local participants when the server copy arrived incomplete', () => {
    const { trip, asha, bala } = setupTrip()
    const e = useStore.getState().addExpense({ tripId: trip.id, title: 'Fuel', amount: 1000, paidBy: asha.id, category: 'fuel', participants: [asha.id, bala.id], splitType: 'equal', splits: [] })
    useStore.getState().mergeRemoteTrip(bundleFor(trip.id, { expenses: [{ ...e, participants: [], splits: [] }] }))
    expect(useStore.getState().expenses.find(x => x.id === e.id)?.participants).toEqual([asha.id, bala.id])
  })

  it('drops rows deleted on another device but keeps never-uploaded ones', () => {
    const { trip, asha, bala } = setupTrip()
    const s = useStore.getState()
    const old = s.addExpense({ tripId: trip.id, title: 'Old', amount: 100, paidBy: asha.id, category: 'misc', participants: [asha.id, bala.id], splitType: 'equal', splits: [] })
    const fresh = s.addExpense({ tripId: trip.id, title: 'New', amount: 50, paidBy: bala.id, category: 'misc', participants: [asha.id, bala.id], splitType: 'equal', splits: [] })
    useStore.setState(st => ({ synced: { ...st.synced, [old.id]: true } }))
    s.mergeRemoteTrip(bundleFor(trip.id))
    const ids = useStore.getState().expenses.map(e => e.id)
    expect(ids).not.toContain(old.id)
    expect(ids).toContain(fresh.id)
  })

  it('imports payments confirmed elsewhere and never rolls a status back', () => {
    const { trip, asha, bala } = setupTrip()
    const s = useStore.getState()
    s.addExpense({ tripId: trip.id, title: 'Tickets', amount: 600, paidBy: asha.id, category: 'tickets', participants: [asha.id, bala.id], splitType: 'equal', splits: [] })
    const due = useStore.getState().settlements[0]
    s.mergeRemoteTrip(bundleFor(trip.id, {
      settlementStatuses: [{ id: 'remote-1', fromMemberId: bala.id, toMemberId: asha.id, amount: 300, status: 'confirmed', confirmedAt: '2026-09-23T10:00:00.000Z' }],
    }))
    const rows = useStore.getState().settlements
    expect(rows.find(x => x.id === due.id)?.status).toBe('confirmed')
    expect(rows.filter(x => x.status !== 'confirmed')).toHaveLength(0)

    // A stale "pending" from the server must not undo the confirmation.
    s.mergeRemoteTrip(bundleFor(trip.id, {
      settlementStatuses: [{ id: due.id, fromMemberId: bala.id, toMemberId: asha.id, amount: 300, status: 'pending' }],
    }))
    expect(useStore.getState().settlements.find(x => x.id === due.id)?.status).toBe('confirmed')
  })
})

describe('attachments', () => {
  it('removes bill photos (and their files) with their expense', () => {
    const cleaned: string[] = []
    setLocalFileCleaner(uris => cleaned.push(...uris))
    const { trip, asha, bala } = setupTrip()
    const s = useStore.getState()
    const e = s.addExpense({ tripId: trip.id, title: 'Lunch', amount: 400, paidBy: asha.id, category: 'food', participants: [asha.id, bala.id], splitType: 'equal', splits: [] })
    s.addAttachment({ id: 'a1', tripId: trip.id, kind: 'bill', expenseId: e.id, mimeType: 'image/jpeg', localUri: 'file:///x/tripmate-media/a1.jpg' })
    expect(useStore.getState().attachments).toHaveLength(1)
    s.deleteExpense(e.id)
    expect(useStore.getState().attachments).toHaveLength(0)
    expect(cleaned).toContain('file:///x/tripmate-media/a1.jpg')
  })
})

describe('migrating data from older app versions', () => {
  it('normalises v0 state and rewrites legacy ids to UUIDs', () => {
    const migrated = migratePersisted({
      trips: [{ id: 'trip-1', tripCode: 'TRP-OLD1', name: 'Old', password: 'x', creatorId: 'mem-1', status: 'active', createdAt: '' }],
      members: [{ id: 'mem-1', tripId: 'trip-1', name: 'A', mobile: '9876500001', pin: '1111', avatarColor: '#000', joinedAt: '' }],
      expenses: [{ id: 'exp-1', tripId: 'trip-1', title: 'T', amount: 10, paidBy: 'mem-1', category: 'food', participants: ['mem-1'], splitType: 'equal', createdAt: '' }],
      session: { tripId: 'trip-1', memberId: 'mem-1', tripCode: 'TRP-OLD1' },
    }, 0) as ReturnType<typeof useStore.getState>

    expect(migrated.attachments).toEqual([])
    expect(migrated.outbox).toEqual([])
    expect(migrated.synced).toEqual({})
    const trip = migrated.trips[0]
    expect(isUuid(trip.id)).toBe(true)
    expect(migrated.members[0].tripId).toBe(trip.id)
    expect(migrated.expenses[0].paidBy).toBe(migrated.members[0].id)
    expect(migrated.expenses[0].splits).toEqual([])
    expect(migrated.session?.tripId).toBe(trip.id)
  })
})
