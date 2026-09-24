// ──────────────────────────────────────────────────────────────────────────────
// Direct APK Download Helper
//
// Triggers direct downloading of the Android APK from Supabase Storage.
// Automatically supports chunked assembly for large release APKs hosted on
// Supabase Storage Free Tier (which enforces a 50MB per-object limit).
// ──────────────────────────────────────────────────────────────────────────────

import { getApkDownloadUrl, APP_RELEASE } from '@/config/appRelease'

export interface DownloadApkOptions {
  fileName?: string
  onStart?: () => void
  onProgress?: (percent: number) => void
  onComplete?: () => void
  onError?: (err: Error) => void
}

interface ReleaseManifest {
  version: string
  fileName: string
  sizeBytes: number
  sha256?: string
  parts?: string[]
}

/**
 * Initiates the download of the official TripMate APK from Supabase Storage.
 * Handles both direct file downloads and chunked multi-part assembly.
 */
export async function triggerApkDownload(options?: DownloadApkOptions): Promise<void> {
  const fileName = options?.fileName || APP_RELEASE.fileName
  const directUrl = getApkDownloadUrl()
  const baseUrl = directUrl.substring(0, directUrl.lastIndexOf('/'))
  const manifestUrl = `${baseUrl}/release.json`

  options?.onStart?.()

  try {
    // 1. Check if a chunked release manifest exists in Supabase Storage
    let manifest: ReleaseManifest | null = null
    try {
      const manifestRes = await fetch(manifestUrl, { cache: 'no-cache' })
      if (manifestRes.ok) {
        manifest = await manifestRes.json()
      }
    } catch {
      // Manifest not found, proceed to direct download fallback
    }

    // 2. If chunked parts exist, download and assemble them in browser
    if (manifest?.parts && Array.isArray(manifest.parts) && manifest.parts.length > 0) {
      const parts = manifest.parts
      const totalParts = parts.length
      const loadedBuffers: ArrayBuffer[] = new Array(totalParts)

      let totalBytesLoaded = 0
      const totalExpectedBytes = manifest.sizeBytes || APP_RELEASE.approxBytes

      for (let i = 0; i < totalParts; i++) {
        const partName = parts[i]
        const partUrl = `${baseUrl}/${partName}`

        const partRes = await fetch(partUrl)
        if (!partRes.ok) {
          throw new Error(`Failed to fetch part ${partName} (${partRes.status})`)
        }

        const buffer = await partRes.arrayBuffer()
        loadedBuffers[i] = buffer
        totalBytesLoaded += buffer.byteLength

        const pct = Math.min(99, Math.round((totalBytesLoaded / totalExpectedBytes) * 100))
        options?.onProgress?.(pct)
      }

      // Combine all parts into single official APK blob
      const apkBlob = new Blob(loadedBuffers, {
        type: 'application/vnd.android.package-archive',
      })

      options?.onProgress?.(100)

      const blobUrl = URL.createObjectURL(apkBlob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()

      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
        options?.onComplete?.()
      }, 500)
      return
    }

    // 3. Fallback: direct download link
    const link = document.createElement('a')
    link.href = directUrl
    link.download = fileName
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link)
      options?.onProgress?.(100)
      options?.onComplete?.()
    }, 500)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    options?.onError?.(err)
    // Ultimate fallback: direct window location assignment
    window.location.href = directUrl
  }
}
