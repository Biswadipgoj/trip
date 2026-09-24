'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Smartphone,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import Image from 'next/image'
import { useAndroidAppPrompt } from '@/hooks/useAndroidAppPrompt'
import { APP_RELEASE } from '@/config/appRelease'

export function AndroidDownloadModal() {
  const { isOpen, isDownloading, downloadProgress, closePrompt, handleDownload } = useAndroidAppPrompt()
  const [showInstructions, setShowInstructions] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePrompt()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, closePrompt])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="android-download-title"
          aria-describedby="android-download-desc"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          {/* Backdrop with frosted glass effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closePrompt}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal / Bottom Sheet */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl text-slate-800"
            style={{
              maxHeight: '92vh',
              boxShadow: '0 25px 50px -12px rgba(108, 62, 200, 0.35)',
            }}
          >
            {/* Top Close Button & Handle */}
            <div className="flex items-center justify-between pb-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Official TripMate Android App</span>
              </div>
              <button
                type="button"
                onClick={closePrompt}
                aria-label="Close download prompt"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* App Header & Branding */}
            <div className="mt-2 flex items-center gap-4">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5">
                <Image
                  src="/logo.png"
                  alt="TripMate Logo"
                  width={64}
                  height={64}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="android-download-title"
                  className="text-xl font-bold tracking-tight text-slate-900"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  TripMate for Android
                </h2>
                <p id="android-download-desc" className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                  Get the TripMate app for a faster and smoother mobile experience.
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-brand-700">v{APP_RELEASE.version}</span>
                  <span>•</span>
                  <span>{APP_RELEASE.fileSizeFormatted}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                    <ShieldCheck className="h-3 w-3 inline" /> Safe Direct Download
                  </span>
                </div>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span className="font-medium">Works 100% Offline</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0" />
                <span className="font-medium">Camera Bill Receipts</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                id="btn-download-android-app"
                onClick={handleDownload}
                disabled={isDownloading}
                className="btn-brand relative flex items-center justify-center gap-2.5 w-full py-3.5 text-sm font-semibold shadow-md active:scale-[0.98] transition-all overflow-hidden"
              >
                {isDownloading && (
                  <div
                    className="absolute inset-0 bg-white/20 transition-all duration-300 pointer-events-none"
                    style={{ width: `${downloadProgress}%` }}
                  />
                )}
                <Download className={`h-4 w-4 relative z-10 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="relative z-10">
                  {isDownloading
                    ? `Downloading APK (${downloadProgress}%)...`
                    : 'Download Android App'}
                </span>
              </button>

              <button
                type="button"
                id="btn-dismiss-android-prompt"
                onClick={closePrompt}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Not now
              </button>
            </div>

            {/* Expandable Installation Instructions */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowInstructions(prev => !prev)}
                aria-expanded={showInstructions}
                className="flex w-full items-center justify-between text-xs font-medium text-slate-600 hover:text-brand-600 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-brand-500" />
                  Having trouble installing?
                </span>
                {showInstructions ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              <AnimatePresence>
                {showInstructions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ol className="mt-3 space-y-2 text-[12px] text-slate-600 bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                          1
                        </span>
                        <span>Tap <strong>Download Android App</strong> above to get <code>{APP_RELEASE.fileName}</code>.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                          2
                        </span>
                        <span>Open the downloaded APK from your browser or notification bar.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                          3
                        </span>
                        <span>If Android asks for permission to install apps from this source, allow it for your browser.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                          4
                        </span>
                        <span>Return to the installer and tap <strong>Install</strong>.</span>
                      </li>
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
