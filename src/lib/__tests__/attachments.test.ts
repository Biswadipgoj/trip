// Bill photo / UPI screenshot upload pipeline (web). The Supabase layer is
// mocked so each failure mode can be forced: flaky network, the expense row
// not yet on the server (foreign key), storage not set up, interrupted uploads.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const remote = vi.hoisted(() => ({
  calls: [] as string[],
  uploadFailures: 0,
  uploadSetupError: false,
  insertFailures: 0,
  exists: true as boolean | null,
}))

vi.mock('@/lib/remote', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/remote')>()
  return {
    ...actual,
    isRemoteEnabled: () => true,
    remoteUploadMedia: vi.fn(async (path: string) => {
      remote.calls.push(`upload:${path}`)
      if (remote.uploadSetupError) throw new actual.MediaError('Bucket not found', 'setup')
      if (remote.uploadFailures-- > 0) throw new actual.MediaError('Failed to fetch', 'transient')
    }),
    remoteInsertAttachment: vi.fn(async (a: { id: string }) => {
      remote.calls.push(`insert:${a.id}`)
      if (remote.insertFailures-- > 0) {
        throw new actual.MediaError('insert or update on table "attachments" violates foreign key constraint', 'transient')
      }
    }),
    remoteDeleteAttachment: vi.fn(async (id: string) => { remote.calls.push(`deleteRow:${id}`); return true }),
    remoteRemoveMedia: vi.fn(async (paths: string[]) => { remote.calls.push(`removeFile:${paths[0]}`); return true }),
    remoteMediaExists: vi.fn(async () => remote.exists),
  }
})

import { useStore, recoverAfterReload } from '@/lib/store'
import type { Attachment, Trip } from '@/types'
import type { TripBundle } from '@/lib/remote'

const TRIP = '11111111-1111-4111-8111-111111111111'
const EXPENSE = '33333333-3333-4333-8333-333333333333'
const photo = () => new Blob([new Uint8Array(2048)], { type: 'image/jpeg' })

/** Runs an async store action to completion across its retry delays. */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return p
}

const att = (id: string) => useStore.getState().attachments.find(a => a.id === id)!

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(remote, { calls: [], uploadFailures: 0, uploadSetupError: false, insertFailures: 0, exists: true })
  useStore.setState({ attachments: [], synced: {} })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('uploading a bill photo', () => {
  it('stores the file, links the row, and marks it uploaded', async () => {
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg', file: photo(),
    }))
    expect(att(a.id).upload).toBe('uploaded')
    expect(att(a.id).storagePath).toBe(`${TRIP}/bills/${a.id}.jpg`)
    expect(useStore.getState().synced[a.id]).toBe(true)
    expect(remote.calls).toEqual([`upload:${TRIP}/bills/${a.id}.jpg`, `insert:${a.id}`])
  })

  it('retries a dropped connection during the file upload', async () => {
    remote.uploadFailures = 1
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg', file: photo(),
    }))
    expect(att(a.id).upload).toBe('uploaded')
    expect(remote.calls.filter(c => c.startsWith('upload:'))).toHaveLength(2)
  })

  it('waits for the expense row (foreign key) instead of failing', async () => {
    remote.insertFailures = 2
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg', file: photo(),
    }))
    expect(att(a.id).upload).toBe('uploaded')
    expect(remote.calls.filter(c => c.startsWith('insert:'))).toHaveLength(3)
  })

  it('stays pending (not failed) when the expense is still not on the server', async () => {
    remote.insertFailures = 99
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg', file: photo(),
    }))
    expect(att(a.id).upload).toBe('pending')
    expect(att(a.id).storagePath).toBeDefined()
    expect(att(a.id).uploadError).toBeUndefined()
  })

  it('reports storage that is not set up without retrying, and can be retried later', async () => {
    remote.uploadSetupError = true
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg', file: photo(),
    }))
    expect(att(a.id).upload).toBe('failed')
    expect(att(a.id).uploadError).toMatch(/isn't set up/)
    expect(att(a.id).storagePath).toBeUndefined()
    expect(remote.calls.filter(c => c.startsWith('upload:'))).toHaveLength(1)

    remote.uploadSetupError = false
    await settle(useStore.getState().retryAttachment(a.id))
    expect(att(a.id).upload).toBe('uploaded')
  })

  it('files payment screenshots under payments/, like the Android app', async () => {
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'payment_proof', fromMemberId: 'a', toMemberId: 'b', amount: 100,
      mimeType: 'image/jpeg', file: photo(),
    }))
    expect(att(a.id).storagePath).toBe(`${TRIP}/payments/${a.id}.jpg`)
  })

  it('rejects a file over 5 MB before sending anything', async () => {
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' })
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg', file: big,
    }))
    expect(att(a.id).upload).toBe('failed')
    expect(remote.calls).toEqual([])
  })
})

describe('deleting a photo', () => {
  it('deletes the row before the file (storage only frees unreferenced files)', async () => {
    const a = await settle(useStore.getState().addAttachment({
      tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg', file: photo(),
    }))
    remote.calls = []
    await settle(useStore.getState().deleteAttachment(a.id))
    expect(remote.calls).toEqual([`deleteRow:${a.id}`, `removeFile:${TRIP}/bills/${a.id}.jpg`])
    expect(useStore.getState().attachments).toHaveLength(0)
  })
})

describe('after a page reload', () => {
  const base: Attachment = {
    id: 'x', tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(), upload: 'uploaded',
  }

  it('drops preview URLs from the previous page (they can never load)', () => {
    const r = recoverAfterReload({ ...base, localUri: 'blob:http://localhost/dead', storagePath: `${TRIP}/bills/x.jpg` })
    expect(r.localUri).toBeUndefined()
    expect(r.storagePath).toBe(`${TRIP}/bills/x.jpg`)
  })

  it('marks an upload that was running as interrupted', () => {
    const r = recoverAfterReload({ ...base, upload: 'uploading' })
    expect(r.upload).toBe('failed')
    expect(r.uploadError).toMatch(/interrupted/)
  })
})

describe('sync (pushTripToRemote)', () => {
  const trip: Trip = {
    id: TRIP, tripCode: 'TEST01', name: 'Test', password: 'x', creatorId: 'm1',
    status: 'active', createdAt: new Date().toISOString(),
  }
  // A freshly pulled bundle in which the server has none of these attachments.
  const pulled = { trip, members: [], expenses: [], hotelExpenses: [], settlementGroups: [], sponsorships: [], attachments: [] } as unknown as TripBundle
  beforeEach(() => useStore.setState({ trips: [trip], members: [], expenses: [], hotelExpenses: [], settlementGroups: [], sponsorships: [], settlements: [] }))

  const put = (a: Partial<Attachment> & { id: string }) =>
    useStore.setState(s => ({
      attachments: [...s.attachments, {
        tripId: TRIP, kind: 'bill', expenseId: EXPENSE, mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(), upload: 'pending', ...a,
      } as Attachment],
    }))

  it('never writes a row for an image whose file was never stored', async () => {
    put({ id: 'no-file', upload: 'failed' })
    put({ id: 'stored', storagePath: `${TRIP}/bills/stored.jpg`, upload: 'pending' })
    await settle(useStore.getState().pushTripToRemote(TRIP, pulled))
    await vi.runAllTimersAsync()
    expect(remote.calls).toContain('insert:stored')
    expect(remote.calls).not.toContain('insert:no-file')
    expect(att('stored').upload).toBe('uploaded')
  })

  it('links an interrupted upload whose file did arrive', async () => {
    remote.exists = true
    put({ id: 'legacy', storagePath: `${TRIP}/bills/legacy.jpg`, upload: 'failed' })
    await settle(useStore.getState().pushTripToRemote(TRIP, pulled))
    await vi.runAllTimersAsync()
    expect(att('legacy').upload).toBe('uploaded')
  })

  it('does not link an interrupted upload whose file is missing', async () => {
    remote.exists = false
    put({ id: 'lost', storagePath: `${TRIP}/bills/lost.jpg`, upload: 'failed' })
    await settle(useStore.getState().pushTripToRemote(TRIP, pulled))
    await vi.runAllTimersAsync()
    expect(remote.calls).not.toContain('insert:lost')
    expect(att('lost').storagePath).toBeUndefined()
    expect(att('lost').uploadError).toMatch(/interrupted/)
  })
})
