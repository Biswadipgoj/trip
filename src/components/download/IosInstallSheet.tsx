'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Share, PlusSquare, CheckCircle2, WifiOff, X } from 'lucide-react'

interface IosInstallSheetProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    icon: Share,
    title: 'Tap the Share button',
    body: 'In Safari it sits in the bottom toolbar. In Chrome, tap Share in the address bar.',
  },
  {
    icon: PlusSquare,
    title: 'Choose “Add to Home Screen”',
    body: 'Scroll the share sheet if you don’t see it straight away.',
  },
  {
    icon: CheckCircle2,
    title: 'Tap “Add”',
    body: 'TripMate appears on your home screen and opens full screen, like any other app.',
  },
]

/** Step-by-step guide for installing TripMate as a home-screen web app on iPhone and iPad. */
export function IosInstallSheet({ open, onClose }: IosInstallSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ios-install-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-pure-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-left text-slate-900 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <h2
              id="ios-install-title"
              className="text-xl font-extrabold tracking-tight text-slate-950 pr-8"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Add TripMate to your Home Screen
            </h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              No App Store needed. It installs in a few seconds and takes almost no space.
            </p>

            <IosInstallGuide />

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-2xl bg-violet-600 hover:bg-violet-700 py-3 text-sm font-bold text-pure-white transition-colors active:scale-[0.98]"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** The three install steps plus the offline note; shared by the sheet and the /download page. */
export function IosInstallGuide() {
  return (
    <>
      <ol className="mt-5 space-y-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl bg-violet-50/70 border border-violet-100 p-3.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-violet-700 text-pure-white">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-950">
                {i + 1}. {title}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-950">
        <WifiOff className="h-4 w-4 flex-shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-bold">Works offline.</strong> Once added, TripMate opens without a
          connection. Expenses you add are saved on your iPhone and sync when you&apos;re back online.
        </p>
      </div>
    </>
  )
}
