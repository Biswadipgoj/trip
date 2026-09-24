// Where to load a bill photo / UPI screenshot from, in order:
//   1. the in-browser preview (only while this page session is alive — a
//      `blob:` URL from an earlier visit is dead, so it is never used),
//   2. the public Storage URL,
//   3. a signed Storage URL (works when the bucket isn't public),
// and otherwise a placeholder with a retry.
import type { Attachment } from '@/types'
import { mediaPublicUrl } from '@/lib/remote'

const livePreviews = new Set<string>()

/** Object URL for an image picked in this session. */
export function createPreviewUrl(blob: Blob): string | undefined {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined
  try {
    const url = URL.createObjectURL(blob)
    livePreviews.add(url)
    return url
  } catch {
    return undefined
  }
}

export function isLivePreview(url: string | undefined): boolean {
  return !!url && livePreviews.has(url)
}

/** A `blob:` URL that did not come from this page session can never load. */
export function isDeadPreview(url: string | undefined): boolean {
  return !!url && url.startsWith('blob:') && !livePreviews.has(url)
}

/** Ordered candidate URLs (preview, then public). The signed URL is fetched on demand. */
export function attachmentSources(a: Pick<Attachment, 'localUri' | 'storagePath'>): string[] {
  const out: string[] = []
  const local = a.localUri
  if (local && (isLivePreview(local) || !local.startsWith('blob:'))) out.push(local)
  const pub = mediaPublicUrl(a.storagePath)
  if (pub) out.push(pub)
  return out
}
