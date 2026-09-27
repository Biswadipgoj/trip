'use client'

import { useEffect, useState } from 'react'

export type Platform = 'android' | 'ios' | 'other'

/**
 * Classifies a browser from its user agent. Pure so it can be unit tested.
 *
 * - `android`: any Android phone or tablet browser.
 * - `ios`: iPhone, iPod and iPad. iPadOS 13+ reports a desktop Mac user agent,
 *   so a "Macintosh" UA with multi-touch is treated as an iPad.
 * - `other`: desktops, Chromebooks and anything unrecognised.
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  const ua = userAgent.toLowerCase()
  if (/android/.test(ua)) return 'android'
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return 'ios'
  return 'other'
}

/** True when the page is running as an installed home-screen app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/**
 * Current platform, or `null` until mounted. Server render and first client
 * render both return `null`, so platform-specific UI never causes a
 * hydration mismatch and never flashes the wrong variant.
 */
export function usePlatform(): Platform | null {
  const [platform, setPlatform] = useState<Platform | null>(null)
  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent || '', navigator.maxTouchPoints || 0))
  }, [])
  return platform
}
