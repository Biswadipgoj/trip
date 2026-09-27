'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('[TripMate PWA] Service worker registration failed:', err)
      })
    }

    // If the page finished loading before hydration, 'load' has already fired.
    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
