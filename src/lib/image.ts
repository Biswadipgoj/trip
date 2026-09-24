// Browser-side preparation of bill photos and UPI screenshots before upload:
// downscale to MAX_DIMENSION on the long side and re-encode as JPEG. Phone
// camera photos are 3–8 MB (sometimes HEIC); the `trip-media` bucket accepts
// at most 5 MB of JPEG/PNG/WebP, so unprepared photos were rejected.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_DIMENSION = 1600
export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface PreparedUpload {
  blob: Blob
  mimeType: string
  width?: number
  height?: number
}

/** A problem the user can act on; `message` is safe to show as-is. */
export class ImagePrepError extends Error {}

/** Size that fits inside max×max, keeping the aspect ratio (never upscales). */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

async function decode(file: Blob): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    // 'from-image' applies the EXIF rotation phones write into photos.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
}

function encodeJpeg(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  // JPEG has no transparency: paint PNG screenshots onto white, not black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', quality))
}

/**
 * Returns an upload-ready image, or throws ImagePrepError with a message for
 * the user. Images the browser can't decode are uploaded untouched when the
 * bucket accepts them as they are.
 */
export async function prepareImageForUpload(file: Blob): Promise<PreparedUpload> {
  const type = (file.type || '').toLowerCase()
  if (type && !type.startsWith('image/')) {
    throw new ImagePrepError('Please choose a photo (JPG, PNG or WebP).')
  }

  const bitmap = await decode(file)
  if (bitmap) {
    try {
      const attempts: Array<[number, number]> = [[MAX_DIMENSION, 0.8], [MAX_DIMENSION, 0.6], [1200, 0.6]]
      for (const [max, quality] of attempts) {
        const size = fitWithin(bitmap.width, bitmap.height, max)
        const blob = await encodeJpeg(bitmap, size.width, size.height, quality)
        if (blob && blob.size <= MAX_UPLOAD_BYTES) return { blob, mimeType: 'image/jpeg', ...size }
        if (!blob) break // no canvas here — fall through to the untouched file
      }
    } finally {
      bitmap.close?.()
    }
  }

  if (ALLOWED_UPLOAD_TYPES.includes(type) && file.size <= MAX_UPLOAD_BYTES) {
    return { blob: file, mimeType: type }
  }
  if (ALLOWED_UPLOAD_TYPES.includes(type)) {
    throw new ImagePrepError('This photo is too large (over 5 MB). Take a screenshot of it and upload that instead.')
  }
  throw new ImagePrepError("This photo format can't be opened in this browser. Choose a JPG or PNG, or take a screenshot of it.")
}

/** File extension for an allowed upload type. */
export function extensionFor(mimeType: string): 'jpg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}
