// Background uploader for bill photos and UPI payment screenshots.
//
// Images are compressed on the device first (media.ts) and uploaded to Supabase
// Storage from here, so an upload never blocks the UI and survives restarts:
//   pending → uploading → uploaded      (failed → retried with backoff)
// An upload waits until the rows it references (the expense/stay, or both
// members of a payment) are on the server — the attachments row has foreign
// keys to them.
import { router } from 'expo-router'
import { File } from 'expo-file-system'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { useStore, setLocalFileCleaner, setUploadProcessor } from './store'
import { deleteLocalFiles, localFileExists, takePendingPick, type PreparedImage } from './media'
import {
  isRemoteEnabled, remoteUploadMedia, remoteInsertAttachment, mediaPublicUrl,
  MediaError, describeError,
} from './remote'
import { useSyncStatus, logSync } from './synclog'
import { generateId } from './utils'
import { toast } from './toast'
import type { Attachment } from '../types'

const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 10 * 60_000
/** Server not set up for media (bucket/table missing): check back rarely. */
const SETUP_BACKOFF_MS = 30 * 60_000
const NEVER = Number.MAX_SAFE_INTEGER

// File-existence checks are synchronous native calls; thumbnails ask often.
const existsCache = new Map<string, boolean>()

function fileExists(uri: string): boolean {
  let known = existsCache.get(uri)
  if (known === undefined) {
    known = localFileExists(uri)
    existsCache.set(uri, known)
  }
  return known
}

// The store deletes on-device copies through this (it can't import native
// file-system code itself — it must stay importable in node tests).
setLocalFileCleaner(uris => {
  uris.forEach(u => existsCache.delete(u))
  deleteLocalFiles(uris)
})

setUploadProcessor(() => {
  void processUploads()
})

async function readFileBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return decode(base64)
  } catch (readErr) {
    try {
      const file = new File(uri)
      const bytes = await file.bytes()
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    } catch {
      throw readErr
    }
  }
}

export type AttachTarget =
  | { kind: 'bill'; tripId: string; expenseId?: string; hotelExpenseId?: string }
  | {
      kind: 'payment_proof'
      tripId: string
      settlementId: string
      fromMemberId: string
      toMemberId: string
      amount: number
    }

/** Links a prepared image to an expense/stay/payment and queues its upload. */
export function attachImage(image: PreparedImage, target: AttachTarget, uploadedBy?: string): Attachment {
  const attachment = useStore.getState().addAttachment({
    id: generateId(),
    ...target,
    localUri: image.uri,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    sizeBytes: image.sizeBytes,
    uploadedBy,
  })
  existsCache.set(image.uri, true)
  void processUploads()
  return attachment
}

/** Manual retry from the UI — ignores the backoff timer. */
export function retryUpload(id: string) {
  useStore.getState().updateAttachment(id, { upload: 'pending', uploadError: undefined, nextAttemptAt: undefined })
  void processUploads()
}

/** Best image source: the on-device copy when present, else the cloud URL. */
export function attachmentUri(a: Attachment): string | null {
  if (a.localUri && fileExists(a.localUri)) return a.localUri
  return mediaPublicUrl(a.storagePath)
}

const stillExists = (id: string) => useStore.getState().attachments.some(x => x.id === id)

async function uploadOne(id: string) {
  const store = useStore.getState()
  const a = store.attachments.find(x => x.id === id)
  if (!a || (a.upload !== 'pending' && a.upload !== 'failed')) return

  // Validate that the parent record has not been deleted locally.
  if (a.kind === 'bill') {
    const parentId = a.expenseId ?? a.hotelExpenseId
    const parentAlive = a.expenseId
      ? store.expenses.some(e => e.id === a.expenseId)
      : !!a.hotelExpenseId && store.hotelExpenses.some(h => h.id === a.hotelExpenseId)
    if (!parentId || !parentAlive) {
      store.removeAttachment(a.id) // its expense was deleted
      return
    }
  } else {
    if (!a.fromMemberId || !a.toMemberId) {
      store.updateAttachment(a.id, { upload: 'failed', uploadError: 'Payment details are missing', nextAttemptAt: NEVER })
      return
    }
  }

  if (!a.storagePath && !(a.localUri && fileExists(a.localUri))) {
    store.updateAttachment(a.id, {
      upload: 'failed',
      uploadError: 'Image file is missing on this device',
      nextAttemptAt: NEVER,
    })
    return
  }

  store.updateAttachment(a.id, { upload: 'uploading', uploadError: undefined })
  let path = a.storagePath
  try {
    if (!path) {
      path = `${a.tripId}/${a.kind === 'bill' ? 'bills' : 'payments'}/${a.id}.jpg`
      const body = await readFileBuffer(a.localUri!)
      await remoteUploadMedia(path, body, a.mimeType || 'image/jpeg')
      if (!stillExists(a.id)) {
        // Deleted mid-upload: the object has no row, so it can be removed.
        useStore.getState().enqueue(a.tripId, { kind: 'removeMedia', paths: [path] })
        return
      }
      useStore.getState().updateAttachment(a.id, { storagePath: path })
    }

    const synced = useStore.getState().synced

    // Check if the parent record is confirmed on the server.
    // If not yet confirmed on server, schedule a short retry (3s) while the parent row pushes.
    if (a.kind === 'bill') {
      const parentId = a.expenseId ?? a.hotelExpenseId
      if (parentId && !synced[parentId]) {
        useStore.getState().updateAttachment(a.id, {
          upload: 'pending',
          nextAttemptAt: Date.now() + 3_000,
        })
        return
      }
    } else {
      if ((a.fromMemberId && !synced[a.fromMemberId]) || (a.toMemberId && !synced[a.toMemberId])) {
        useStore.getState().updateAttachment(a.id, {
          upload: 'pending',
          nextAttemptAt: Date.now() + 3_000,
        })
        return
      }
    }

    const current = useStore.getState().attachments.find(x => x.id === a.id) ?? a
    await remoteInsertAttachment({
      ...current,
      storagePath: path,
      // uploaded_by is a foreign key too — omit it until that member is on the server.
      uploadedBy: current.uploadedBy && synced[current.uploadedBy] ? current.uploadedBy : undefined,
    })

    if (!stillExists(a.id)) {
      const s = useStore.getState()
      s.enqueue(a.tripId, { kind: 'delete', table: 'attachments', rowId: a.id })
      s.enqueue(a.tripId, { kind: 'removeMedia', paths: [path] })
      return
    }
    useStore.getState().updateAttachment(a.id, {
      upload: 'uploaded',
      uploadError: undefined,
      attempts: 0,
      nextAttemptAt: undefined,
    })
    useSyncStatus.getState().set({ mediaReady: true })
    logSync('info', 'media.uploaded', path)
  } catch (err) {
    const attempts = (a.attempts ?? 0) + 1
    const setup = err instanceof MediaError && err.kind === 'setup'
    if (setup) useSyncStatus.getState().set({ mediaReady: false })
    const message = setup ? "Cloud storage for images isn't set up yet" : describeError(err)
    logSync('error', 'media.upload', message)
    if (stillExists(a.id)) {
      useStore.getState().updateAttachment(a.id, {
        upload: 'failed',
        uploadError: message,
        attempts,
        nextAttemptAt: Date.now() + (setup ? SETUP_BACKOFF_MS : Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempts)),
      })
    }
  }
}

async function runPass() {
  if (!isRemoteEnabled() || !useSyncStatus.getState().online) return
  const now = Date.now()
  const due = useStore.getState().attachments.filter(
    a => (a.upload === 'pending' || a.upload === 'failed') && (a.nextAttemptAt ?? 0) <= now
  )
  // One at a time: mobile uplinks are slow, and parallel uploads all time out together.
  for (const a of due) await uploadOne(a.id)
}

let running: Promise<void> | null = null
let again = false

/** Uploads every attachment that is due. Single-flight: calls made while a
 *  pass is running schedule exactly one more pass. */
export function processUploads(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      try {
        await runPass()
      } catch (err) {
        logSync('error', 'media.pass', describeError(err))
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

// ─── Recovery after Android killed the app during a camera/gallery pick ──────

let recoveredBill: PreparedImage | null = null

/** A bill photo recovered at startup, handed to the add-expense form once. */
export function consumeRecoveredBill(): PreparedImage | null {
  const bill = recoveredBill
  recoveredBill = null
  return bill
}

export async function recoverPendingPick() {
  const result = await takePendingPick()
  if (!result) return
  const { image, context } = result
  const s = useStore.getState()

  if (context.kind === 'payment_proof') {
    const settlement = s.settlements.find(x => x.id === context.settlementId)
    if (!settlement) {
      deleteLocalFiles([image.uri])
      return
    }
    attachImage(
      image,
      {
        kind: 'payment_proof',
        tripId: settlement.tripId,
        settlementId: settlement.id,
        fromMemberId: settlement.fromMemberId,
        toMemberId: settlement.toMemberId,
        amount: settlement.amount,
      },
      s.session?.memberId
    )
    toast.success('Recovered your payment screenshot and attached it')
    return
  }

  // A bill for an expense/stay that already exists: attach it straight away.
  const parentAlive = context.expenseId
    ? s.expenses.some(e => e.id === context.expenseId)
    : !!context.hotelExpenseId && s.hotelExpenses.some(h => h.id === context.hotelExpenseId)
  if (context.tripId && parentAlive) {
    attachImage(
      image,
      { kind: 'bill', tripId: context.tripId, expenseId: context.expenseId, hotelExpenseId: context.hotelExpenseId },
      s.session?.memberId
    )
    toast.success('Recovered your bill photo and attached it')
    return
  }

  recoveredBill = image
  toast.info('Recovered the bill photo you just took', s.session
    ? { action: { label: 'Add expense', onPress: () => router.push('/add-expense') } }
    : undefined)
}
