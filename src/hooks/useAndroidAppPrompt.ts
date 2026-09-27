'use client'

import { useState, useEffect, useCallback } from 'react'
import { triggerApkDownload } from '@/lib/downloadApk'
import { detectPlatform } from '@/lib/platform'

const STORAGE_KEY = 'tripmate_android_download_dismissed'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/** True only in a browser running on an Android device (phone or tablet). */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return detectPlatform(navigator.userAgent || '', navigator.maxTouchPoints || 0) === 'android'
}

/**
 * Hook to manage the Android download prompt modal state, persistence, and actions.
 * Strictly only activates when running on an Android device.
 */
export function useAndroidAppPrompt() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const android = isAndroidDevice()
    setIsAndroid(android)

    // NEVER open on desktop, iPhone, iPad, or any non-Android client
    if (!android) {
      setIsOpen(false)
      return
    }

    // Keep modal closed by default so it never blocks page interactions
    setIsOpen(false)
  }, [])

  const closePrompt = useCallback(() => {
    setIsOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    } catch {
      // Ignore storage errors in private mode
    }
  }, [])

  const openPrompt = useCallback(() => {
    if (isAndroidDevice()) {
      setIsOpen(true)
    }
  }, [])

  const handleDownload = useCallback(() => {
    setIsDownloading(true)
    setDownloadProgress(20)
    triggerApkDownload({
      onStart: () => {
        setIsDownloading(true)
        setDownloadProgress(35)
      },
      onProgress: (pct) => {
        setDownloadProgress(pct)
      },
      onComplete: () => {
        setDownloadProgress(100)
        setTimeout(() => {
          setIsDownloading(false)
          setDownloadProgress(0)
        }, 1200)
      },
      onError: () => {
        setIsDownloading(false)
        setDownloadProgress(0)
      },
    })
  }, [])

  return {
    isOpen,
    isAndroid,
    isDownloading,
    downloadProgress,
    openPrompt,
    closePrompt,
    handleDownload,
  }
}
