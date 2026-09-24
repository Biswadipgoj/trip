// ──────────────────────────────────────────────────────────────────────────────
// Direct APK Download Helper
//
// Triggers direct downloading of the Android APK from Supabase Storage without
// leaving the page, navigating through third-party sites, or opening Google Play.
// ──────────────────────────────────────────────────────────────────────────────

import { getApkDownloadUrl, APP_RELEASE } from '@/config/appRelease'

export interface DownloadApkOptions {
  fileName?: string
  onStart?: () => void
  onComplete?: () => void
  onError?: (err: Error) => void
}

/**
 * Initiates the download of the official TripMate APK.
 * Works across Android Chrome, Firefox, Samsung Internet, and in-app web views.
 */
export function triggerApkDownload(options?: DownloadApkOptions): void {
  const url = getApkDownloadUrl()
  const fileName = options?.fileName || APP_RELEASE.fileName

  try {
    options?.onStart?.()

    // 1. Create a virtual anchor element
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    link.rel = 'noopener noreferrer'

    // 2. Append, click, and clean up
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      options?.onComplete?.()
    }, 150)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    options?.onError?.(err)
    // Fallback: direct window navigation to the APK URL
    window.location.href = url
  }
}
