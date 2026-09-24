'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import Image from 'next/image'
import { useAndroidAppPrompt } from '@/hooks/useAndroidAppPrompt'
import { APP_RELEASE } from '@/config/appRelease'

export function AndroidDownloadModal() {
  const { isOpen, isAndroid, isDownloading, downloadProgress, closePrompt, handleDownload } =
    useAndroidAppPrompt()
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

  // STRICT REQUIREMENT: Only render when visiting on a real Android device
  if (!isAndroid || !isOpen) {
    return null
  }

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-download-title"
        aria-describedby="android-download-desc"
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto"
        style={{ colorScheme: 'light' }}
      >
        {/* Backdrop: Soft, light blur rather than dark black overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closePrompt}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal Sheet — High Contrast, Bright Pure White Card */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-md overflow-hidden rounded-t-[28px] sm:rounded-[28px] border border-violet-200/90 bg-pure-white p-6 shadow-2xl text-slate-900"
          style={{
            maxHeight: '90vh',
            backgroundColor: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(108, 62, 200, 0.28), 0 0 0 1px rgba(139, 92, 246, 0.15)',
          }}
        >
          {/* Top Pill & Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-violet-100">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              <span>Official Android App</span>
            </div>
            <button
              type="button"
              onClick={closePrompt}
              aria-label="Close download prompt"
              className="rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 active:scale-95 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* App Header & Branding */}
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl shadow-md ring-2 ring-violet-200 bg-pure-white">
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
                className="text-xl font-extrabold tracking-tight text-slate-950"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                TripMate for Android
              </h2>
              <p id="android-download-desc" className="text-xs font-medium text-slate-700 mt-0.5">
                Faster mobile experience with offline sync & receipt camera.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800">
                  v{APP_RELEASE.version}
                </span>
                <span>•</span>
                <span>{APP_RELEASE.fileSizeFormatted}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline" /> Safe APK
                </span>
              </div>
            </div>
          </div>

          {/* Key Highlights */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl bg-violet-50/80 p-2.5 border border-violet-100 text-slate-900 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Works 100% Offline</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-violet-50/80 p-2.5 border border-violet-100 text-slate-900 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-violet-600 flex-shrink-0" />
              <span>Camera Receipt Scan</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              id="btn-download-android-app"
              onClick={handleDownload}
              disabled={isDownloading}
              className="relative flex items-center justify-center gap-2.5 w-full py-3.5 px-4 rounded-2xl text-sm font-bold text-pure-white shadow-lg active:scale-[0.98] transition-all overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, hsl(262, 85%, 58%) 0%, hsl(310, 80%, 54%) 100%)',
                boxShadow: '0 8px 20px -4px rgba(139, 92, 246, 0.45)',
              }}
            >
              {isDownloading && (
                <div
                  className="absolute inset-0 bg-pure-white/25 transition-all duration-300 pointer-events-none"
                  style={{ width: `${downloadProgress}%` }}
                />
              )}
              <Download className={`h-4 w-4 relative z-10 text-pure-white ${isDownloading ? 'animate-bounce' : ''}`} />
              <span className="relative z-10 text-pure-white drop-shadow-sm">
                {isDownloading
                  ? `Downloading APK (${downloadProgress}%)...`
                  : 'Download Android App (APK)'}
              </span>
            </button>

            <button
              type="button"
              id="btn-dismiss-android-prompt"
              onClick={closePrompt}
              className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors"
            >
              Not now, keep using web
            </button>
          </div>

          {/* Expandable Installation Guide */}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowInstructions(prev => !prev)}
              aria-expanded={showInstructions}
              className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 hover:text-violet-700 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-violet-600" />
                How to install this APK on Android?
              </span>
              {showInstructions ? (
                <ChevronUp className="h-4 w-4 text-slate-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-600" />
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
                  <ol className="mt-3 space-y-2.5 text-[12px] text-slate-800 bg-violet-50/60 rounded-2xl p-3.5 border border-violet-100">
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-pure-white shadow-sm">
                        1
                      </span>
                      <span className="leading-snug">
                        Tap <strong>Download Android App</strong> above. The file will start downloading.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-pure-white shadow-sm">
                        2
                      </span>
                      <span className="leading-snug">
                        When finished, tap the download notification or open your browser&apos;s <strong>Downloads</strong> folder.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-pure-white shadow-sm">
                        3
                      </span>
                      <span className="leading-snug">
                        If prompted: &ldquo;Install unknown apps&rdquo;, tap <strong>Settings</strong> and toggle <strong>Allow from this source</strong> to ON.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-pure-white shadow-sm">
                        4
                      </span>
                      <span className="leading-snug">
                        Return to the installer and tap <strong>Install</strong>. Enjoy TripMate!
                      </span>
                    </li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
