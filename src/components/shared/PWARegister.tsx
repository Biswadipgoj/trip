'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then(registration => {
            console.log('[TripMate PWA] Service worker registered with scope:', registration.scope)
          })
          .catch(err => {
            console.log('[TripMate PWA] Service worker registration failed:', err)
          })
      })
    }
  }, [])

  return null
}
