'use client'

import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import { AppInstallLink } from '@/components/download/AppInstallLink'
import { LanguageSelector } from '@/components/shared/LanguageSelector'

/**
 * Compact, interactive brand signature.
 * Sleek, creative designer badge: "Crafted by Dip ↗".
 * On click: spring-animated creator card for Biswodip Goj with a link to the portfolio at biswadip.in.
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
          <AppInstallLink
            id="footer-download-app-link"
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/90 bg-pure-white hover:bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-900 shadow-sm transition-all active:scale-95"
            iconClassName="w-3.5 h-3.5 text-violet-600"
          />

          {/* Creative Artisan "Crafted by Dip" Badge */}
          <motion.button
            id="brand-signature"
            type="button"
            onClick={reveal}
            aria-label="Crafted by Dip — Biswodip Goj"
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            className="group relative inline-flex items-center gap-1.5 rounded-full border border-violet-200/90 bg-gradient-to-r from-pure-white via-violet-50/50 to-pure-white hover:border-violet-300 hover:shadow-md hover:shadow-violet-500/15 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md transition-all cursor-pointer overflow-hidden"
          >
            {/* Custom Maker Monogram Chip */}
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-indigo-600 text-[9px] font-black text-pure-white shadow-xs group-hover:rotate-12 transition-transform duration-300">
              D
            </span>
            <span className="text-slate-600 group-hover:text-slate-900 transition-colors">Crafted by</span>
            <span className="font-extrabold bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent tracking-wide">
              Dip
            </span>
            <ArrowUpRight className="w-3 h-3 text-violet-400 group-hover:text-violet-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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
              role="dialog"
              aria-modal="true"
              aria-labelledby="brand-signature-title"
              initial={{ opacity: 0, scale: 0.85, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative w-full max-w-sm rounded-3xl p-6 sm:p-7 text-center shadow-2xl overflow-hidden border border-pure-white/60"
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
                <div className="w-full h-full rounded-[14px] bg-pure-white flex items-center justify-center">
                  <span className="text-xl font-black bg-gradient-to-br from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                    BG
                  </span>
                </div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600 mb-1">
                Designed &amp; engineered by
              </p>

              {/* Full Name */}
              <h3
                id="brand-signature-title"
                className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent">
                  Biswodip Goj
                </span>
              </h3>

              <p className="text-[13px] text-slate-600 mb-4 leading-relaxed">
                TripMate is an independent product, conceived, designed and built end to end by one
                person. An offline-first ledger for shared travel: every expense recorded without
                signal, every balance settled in the fewest payments.
              </p>

              <ul className="flex flex-wrap items-center justify-center gap-1.5 mb-5" aria-label="Disciplines">
                {['Product design', 'Engineering', 'Offline-first systems'].map(item => (
                  <li
                    key={item}
                    className="rounded-full border border-violet-200/80 bg-violet-50/70 px-2.5 py-0.5 text-[10px] font-semibold text-violet-800"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="https://biswadip.in"
                target="_blank"
                rel="noopener noreferrer"
                id="creator-portfolio-link"
                className="group/cta inline-flex items-center justify-between gap-3 w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-700 hover:from-violet-500 hover:to-fuchsia-500 text-pure-white py-3 px-5 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 active:scale-[0.98] transition-all"
              >
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-bold">Explore the portfolio</span>
                  <span className="text-[11px] font-medium text-pure-white/75">biswadip.in</span>
                </span>
                <ArrowUpRight className="w-5 h-5 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
              </a>

              <p className="mt-3 text-[10px] text-slate-400">
                Selected work, case studies and contact details. Opens in a new tab.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
