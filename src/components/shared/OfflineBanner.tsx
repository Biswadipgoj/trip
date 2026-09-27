'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, ShieldCheck, Smartphone, X } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export function OfflineBanner() {
  const { t } = useTranslation()
  const [isOffline, setIsOffline] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateOnlineStatus = () => {
      const offline = !navigator.onLine
      setIsOffline(offline)
      if (!offline) {
        setDismissed(false)
      }
    }

    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  if (!isOffline || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="sticky top-0 z-[150] w-full bg-amber-500/95 backdrop-blur-md text-amber-950 px-4 py-2.5 shadow-md border-b border-amber-600/30"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-semibold">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <WifiOff className="w-4 h-4 text-amber-900 flex-shrink-0 animate-pulse" />
            <span>{t('offlineBanner')}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/download"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-900 hover:bg-amber-950 text-pure-white text-[11px] font-bold shadow-sm transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t('getAndroidApp')}</span>
            </Link>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 text-amber-900 hover:text-amber-950 rounded-md"
              aria-label="Dismiss offline notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
