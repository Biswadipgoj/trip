// ──────────────────────────────────────────────────────────────────────────────
// Direct APK Download Helper
//
// Triggers direct downloading of the official Android APK via the streaming
// endpoint (/api/download/tripmate-latest.apk).
// ──────────────────────────────────────────────────────────────────────────────

import { getApkDownloadUrl, APP_RELEASE } from '@/config/appRelease'

export interface DownloadApkOptions {
  fileName?: string
  onStart?: () => void
  onProgress?: (percent: number) => void
  onComplete?: () => void
  onError?: (err: Error) => void
}

/**
 * Initiates direct download of the official TripMate APK.
 * Triggers the browser/Android system download manager.
 */
export async function triggerApkDownload(options?: DownloadApkOptions): Promise<void> {
  const fileName = options?.fileName || APP_RELEASE.fileName
  const downloadUrl = getApkDownloadUrl()

  options?.onStart?.()
  options?.onProgress?.(25)

  try {
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fileName
    link.setAttribute('rel', 'noopener noreferrer')
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      options?.onProgress?.(65)
    }, 350)

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      options?.onProgress?.(100)
      options?.onComplete?.()
    }, 850)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    options?.onError?.(err)
    // Fallback: direct window location
    window.location.href = downloadUrl
  }
}
