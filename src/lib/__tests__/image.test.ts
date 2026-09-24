import { describe, it, expect, vi, afterEach } from 'vitest'
import { fitWithin, prepareImageForUpload, ImagePrepError, extensionFor, MAX_UPLOAD_BYTES } from '@/lib/image'

describe('fitWithin', () => {
  it('scales a 12 MP phone photo down to 1600 px on the long side', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })
  it('never upscales a small screenshot', () => {
    expect(fitWithin(720, 1280)).toEqual({ width: 720, height: 1280 })
  })
  it('keeps extreme panoramas at least 1 px tall', () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 1600, height: 1 })
  })
})

describe('prepareImageForUpload', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** Browser stand-ins: a decoder that reports the given size, and a canvas
   *  whose JPEG output has the given byte size. */
  function stubBrowser(decoded: { width: number; height: number } | null, jpegBytes = 300_000) {
    const drawn: Array<{ width: number; height: number; quality: number }> = []
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      if (!decoded) throw new Error('cannot decode')
      return { ...decoded, close: vi.fn() }
    }))
    vi.stubGlobal('document', {
      createElement: () => {
        const canvas = {
          width: 0, height: 0,
          getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }),
          toBlob: (cb: (b: Blob) => void, _type: string, quality: number) => {
            drawn.push({ width: canvas.width, height: canvas.height, quality })
            cb(new Blob([new Uint8Array(jpegBytes)], { type: 'image/jpeg' }))
          },
        }
        return canvas
      },
    })
    return drawn
  }

  it('re-encodes an 8 MB camera photo as a ≤1600 px JPEG under the 5 MB bucket limit', async () => {
    const drawn = stubBrowser({ width: 4000, height: 3000 })
    const out = await prepareImageForUpload(new Blob([new Uint8Array(8 * 1024 * 1024)], { type: 'image/jpeg' }))
    expect(out.mimeType).toBe('image/jpeg')
    expect(out).toMatchObject({ width: 1600, height: 1200 })
    expect(out.blob.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES)
    expect(drawn[0]).toMatchObject({ width: 1600, height: 1200, quality: 0.8 })
  })

  it('lowers quality, then size, until the photo fits', async () => {
    const drawn = stubBrowser({ width: 4000, height: 3000 }, MAX_UPLOAD_BYTES + 1)
    await expect(prepareImageForUpload(new Blob([new Uint8Array(10)], { type: 'image/png' }))).resolves.toMatchObject({ mimeType: 'image/png' })
    expect(drawn.map(d => [Math.max(d.width, d.height), d.quality])).toEqual([[1600, 0.8], [1600, 0.6], [1200, 0.6]])
  })

  it('rejects files that are not images', async () => {
    await expect(prepareImageForUpload(new Blob(['%PDF'], { type: 'application/pdf' }))).rejects.toBeInstanceOf(ImagePrepError)
  })

  it('uploads an undecodable JPEG/PNG/WebP as-is when it already fits', async () => {
    stubBrowser(null)
    const file = new Blob([new Uint8Array(1000)], { type: 'image/png' })
    const out = await prepareImageForUpload(file)
    expect(out.blob).toBe(file)
    expect(out.mimeType).toBe('image/png')
  })

  it('explains a HEIC photo the browser cannot open instead of failing silently', async () => {
    stubBrowser(null)
    await expect(prepareImageForUpload(new Blob([new Uint8Array(1000)], { type: 'image/heic' })))
      .rejects.toThrow(/Choose a JPG or PNG/)
  })

  it('explains an oversized photo the browser cannot shrink', async () => {
    stubBrowser(null)
    await expect(prepareImageForUpload(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)], { type: 'image/jpeg' })))
      .rejects.toThrow(/too large/)
  })
})

describe('extensionFor', () => {
  it('maps upload types to file extensions', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('image/png')).toBe('png')
    expect(extensionFor('image/webp')).toBe('webp')
  })
})
