'use client'

import { useState, useEffect, useCallback } from 'react'
import { triggerApkDownload } from '@/lib/downloadApk'

const STORAGE_KEY = 'tripmate_android_download_dismissed'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Checks if the current browser environment is running on Android.
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase()

  // Explicitly ignore iOS devices
  if (/iphone|ipad|ipod/.test(ua)) return false

  // Detect Android
  return /android/.test(ua)
}

/**
 * Hook to manage the Android download prompt modal state, persistence, and actions.
 */
export function useAndroidAppPrompt() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const android = isAndroidDevice()
    setIsAndroid(android)

    // Allow URL query override for testing on desktop (?test_android=1)
    const urlParams = new URLSearchParams(window.location.search)
    const isTestMode = urlParams.get('test_android') === '1'

    if (!android && !isTestMode) return

    // Check dismissal history in localStorage
    try {
      const dismissedRaw = localStorage.getItem(STORAGE_KEY)
      if (dismissedRaw && !isTestMode) {
        const dismissedAt = parseInt(dismissedRaw, 10)
        if (!isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
          return // User dismissed recently, honor cooldown
        }
      }
    } catch {
      // localStorage may fail in strict private browsing, fail gracefully
    }

    // Delay showing the prompt by 1.2 seconds for a smoother initial page render
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 1200)

    return () => clearTimeout(timer)
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
    setIsOpen(true)
  }, [])

  const handleDownload = useCallback(() => {
    setIsDownloading(true)
    triggerApkDownload({
      onStart: () => setIsDownloading(true),
      onComplete: () => {
        setTimeout(() => setIsDownloading(false), 2000)
      },
      onError: () => setIsDownloading(false),
    })
  }, [])

  return {
    isOpen,
    isAndroid,
    isDownloading,
    openPrompt,
    closePrompt,
    handleDownload,
  }
}
