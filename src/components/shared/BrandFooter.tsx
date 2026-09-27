'use client'

import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Smartphone, ExternalLink, Sparkles, X } from 'lucide-react'
import { LanguageSelector } from '@/components/shared/LanguageSelector'

/**
 * Compact, interactive brand signature.
 * Default: Sleek, unobtrusive "Created by Dip ✦" pill.
 * On click: Spring-animated modal with full name "Biswodip Goj" and direct link to biswadip.in.
 */
export function BrandFooter() {
  const [open, setOpen] = useState(false)

  const reveal = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <footer className="relative z-10 mt-8 px-4 pb-24 lg:pb-8 pt-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2.5">
          <LanguageSelector />
          <Link
            href="/download"
            id="footer-download-app-link"
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/90 bg-pure-white hover:bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-900 shadow-sm transition-all active:scale-95"
          >
            <Smartphone className="w-3.5 h-3.5 text-violet-600" />
            <span>TripMate App</span>
          </Link>

          {/* Compact "Created by Dip" Pill */}
          <motion.button
            id="brand-signature"
            type="button"
            onClick={reveal}
            aria-label="Created by Dip — Mastermind Behind TripMate"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            className="group inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-white/90 hover:bg-violet-50/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
            <span>Created by</span>
            <span className="font-bold text-violet-700 group-hover:text-fuchsia-600 transition-colors">Dip</span>
            <span className="text-[10px] text-violet-400">✦</span>
          </motion.button>
        </div>
      </footer>

      <AnimatePresence>
        {open && (
          <motion.div
            key="tm-owner-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            style={{
              background: 'rgba(26, 16, 43, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative w-full max-w-sm rounded-3xl p-6 sm:p-7 text-center shadow-2xl overflow-hidden border border-white/60"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(246,240,255,0.92))',
                boxShadow: '0 25px 60px rgba(108,62,200,0.3)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close Icon Button */}
              <button
                type="button"
                onClick={close}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-violet-100/60 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Glowing Avatar / Monogram */}
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-indigo-500 p-0.5 shadow-lg shadow-violet-500/25 mb-3.5">
                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                  <span className="text-xl font-black bg-gradient-to-br from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                    BG
                  </span>
                </div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600 mb-1">
                Creator & Architect
              </p>

              {/* Full Name */}
              <h3
                className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent">
                  Biswodip Goj
                </span>
              </h3>

              <p className="text-xs text-slate-600 mb-5 font-medium leading-relaxed">
                Mastermind Behind TripMate — Designed and engineered for frictionless group travel & instant offline settlements.
              </p>

              {/* Action Button: Visit Owner */}
              <a
                href="https://biswadip.in"
                target="_blank"
                rel="noopener noreferrer"
                id="visit-owner-button"
                className="inline-flex items-center justify-center gap-2 w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-700 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm py-3 px-5 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Visit Owner · biswadip.in</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <p className="mt-3 text-[10px] text-slate-400">
                Clicking opens portfolio in a new tab
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
