// Image source selection and "keep images when a trip closes" (app side).
// Native modules are mocked; uploads.ts and the store are real.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({ existing: new Set<string>(), checks: 0 }))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}))
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }))
vi.mock('expo-file-system', () => ({ File: class {} }))
vi.mock('expo-file-system/legacy', () => ({ readAsStringAsync: vi.fn(), EncodingType: { Base64: 'base64' } }))
vi.mock('../src/lib/toast', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('../src/lib/media', () => ({
  deleteLocalFiles: vi.fn(),
  takePendingPick: vi.fn(async () => null),
  localFileExists: (uri: string) => {
    fs.checks++
    return fs.existing.has(uri)
  },
}))
vi.mock('../src/lib/remote', () => ({
  isRemoteEnabled: () => false,
  remoteUploadMedia: vi.fn(),
  remoteInsertAttachment: vi.fn(),
  mediaPublicUrl: (path?: string) => (path ? `https://cdn.example/${path}` : null),
  MediaError: class extends Error {},
  describeError: (e: unknown) => String(e),
}))

import { attachmentSources, fileExists } from '../src/lib/uploads'
import { useStore } from '../src/lib/store'
import type { Attachment } from '../src/types'

const bill = (patch: Partial<Attachment> = {}): Attachment => ({
  id: 'a1', tripId: 't1', kind: 'bill', expenseId: 'e1', mimeType: 'image/jpeg',
  createdAt: new Date().toISOString(), upload: 'pending', ...patch,
})

beforeEach(() => {
  fs.existing.clear()
  fs.checks = 0
})

describe('fileExists', () => {
  it('checks again after a "missing" answer (the file may still be moving into place)', () => {
    const uri = 'file:///docs/tripmate-media/late.jpg'
    expect(fileExists(uri)).toBe(false)
    fs.existing.add(uri)
    expect(fileExists(uri)).toBe(true)
  })

  it('remembers a file that exists, so thumbnails do not hit the disk every render', () => {
    const uri = 'file:///docs/tripmate-media/here.jpg'
    fs.existing.add(uri)
    fileExists(uri)
    fileExists(uri)
    expect(fs.checks).toBe(1)
  })
})

describe('attachmentSources', () => {
  it('tries the on-device copy first, then the cloud URL', () => {
    fs.existing.add('file:///docs/tripmate-media/a1.jpg')
    expect(attachmentSources(bill({ localUri: 'file:///docs/tripmate-media/a1.jpg', storagePath: 't1/bills/a1.jpg' })))
      .toEqual(['file:///docs/tripmate-media/a1.jpg', 'https://cdn.example/t1/bills/a1.jpg'])
  })

  it('uses the cloud URL on other phones (no local copy)', () => {
    expect(attachmentSources(bill({ storagePath: 't1/bills/a1.jpg' }))).toEqual(['https://cdn.example/t1/bills/a1.jpg'])
  })

  it('has nothing to show for a photo that is neither on this phone nor uploaded', () => {
    expect(attachmentSources(bill({ localUri: 'file:///gone.jpg' }))).toEqual([])
  })
})

describe('closing a trip', () => {
  it('keeps its bill photos and payment screenshots', () => {
    useStore.setState({
      trips: [{ id: 't1', tripCode: 'T1', name: 'Goa', password: 'x', creatorId: 'm1', status: 'active', createdAt: new Date().toISOString() }],
      attachments: [bill(), bill({ id: 'a2', kind: 'payment_proof', expenseId: undefined, fromMemberId: 'm1', toMemberId: 'm2' })],
    })
    useStore.getState().closeTrip('t1')
    expect(useStore.getState().trips[0].status).toBe('closed')
    expect(useStore.getState().attachments).toHaveLength(2)

    useStore.getState().applyTripClosed('t1', new Date().toISOString())
    expect(useStore.getState().attachments).toHaveLength(2)
  })
})
