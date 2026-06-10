'use client'

import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Interactive brand signature.
 *
 * Footer reads "Mastermind Behind The Code: Biswodip Goj" — every word painted
 * in its own vibrant gradient. Tapping it opens a super-fluid, hardware-
 * accelerated reveal (transform/opacity only, spring-driven) that floats a
 * stylized "Biswodip Goj" nameplate over a frosted backdrop.
 */
export function BrandFooter() {
  const [open, setOpen] = useState(false)

  const reveal = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <footer className="relative z-10 mt-10 px-4 pb-28 lg:pb-8 pt-6 text-center">
        <motion.button
          id="brand-signature"
          type="button"
          onClick={reveal}
          aria-label="Mastermind Behind The Code: Biswodip Goj"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          className="group inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-2xl px-4 py-2 text-base sm:text-lg tracking-tight will-change-transform"
        >
          <span className="tm-word tm-w1">Mastermind</span>
          <span className="tm-word tm-w2">Behind</span>
          <span className="tm-word tm-w3">The</span>
          <span className="tm-word tm-w4">Code:</span>
          <span className="tm-word tm-w5">Biswodip</span>
          <span className="tm-word tm-w6">Goj</span>
        </motion.button>
        <p className="mt-1.5 text-[11px] text-white/50">Tap the signature ✨</p>
      </footer>

      <AnimatePresence>
        {open && (
          <motion.div
            key="tm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-6"
            style={{
              background: 'rgba(248, 243, 255, 0.55)',
              backdropFilter: 'blur(22px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
            }}
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.82, y: 36 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 18 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22, mass: 0.9 }}
              className="will-change-transform"
            >
              <Nameplate />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Nameplate() {
  return (
    <div className="text-center">
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative inline-block rounded-3xl px-8 py-7 sm:px-14 sm:py-10 will-change-transform"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(244,238,255,0.82))',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow:
            '0 30px 90px rgba(108,62,200,0.35), inset 0 1px 0 rgba(255,255,255,0.95)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        }}
      >
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.4em] text-brand-500/70 mb-2">
          Mastermind Behind The Code
        </p>
        <h2
          className="text-4xl sm:text-6xl font-extrabold leading-none"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            backgroundImage:
              'linear-gradient(120deg, hsl(262,90%,58%) 0%, hsl(322,92%,60%) 38%, hsl(20,100%,58%) 66%, hsl(210,96%,56%) 100%)',
            backgroundSize: '220% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'tmSheen 3.5s linear infinite',
          }}
        >
          Biswodip&nbsp;Goj
        </h2>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-brand-400/60" />
          <span className="text-base">✦</span>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-fuchsia-400/60" />
        </div>
        <p className="mt-3 text-xs text-white/60">Tap anywhere to close</p>
      </motion.div>
    </div>
  )
}
