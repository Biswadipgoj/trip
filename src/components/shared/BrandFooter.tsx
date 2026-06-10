'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type Phase = 'idle' | 'shaking' | 'crumbling' | 'reveal'

/**
 * Interactive brand signature.
 *
 * Footer text "Built with ❤️ by Biswodip Goj" — every word painted in its own
 * vibrant gradient. Tapping it shakes the whole page, then unfurls a full-screen
 * "paper crumble" transition that scrunches away to reveal a stylized
 * "Biswodip Goj" nameplate.
 */
export function BrandFooter() {
  const [phase, setPhase] = useState<Phase>('idle')

  // Toggle the page-shake class on <body> for the duration of the shake phase.
  useEffect(() => {
    if (phase !== 'shaking') return
    document.body.classList.add('tm-shake')
    const t = setTimeout(() => {
      document.body.classList.remove('tm-shake')
      setPhase('crumbling')
    }, 600)
    return () => {
      clearTimeout(t)
      document.body.classList.remove('tm-shake')
    }
  }, [phase])

  const handleClick = useCallback(() => {
    if (phase === 'idle') setPhase('shaking')
  }, [phase])

  const close = useCallback(() => setPhase('idle'), [])

  return (
    <>
      <footer className="relative z-10 mt-10 px-4 pb-28 lg:pb-8 pt-6 text-center">
        <button
          id="brand-signature"
          type="button"
          onClick={handleClick}
          aria-label="Built with love by Biswodip Goj"
          className="group inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-2xl px-4 py-2 text-base sm:text-lg tracking-tight transition-transform duration-300 hover:scale-105 active:scale-95"
        >
          <span className="tm-word tm-w1">Built</span>
          <span className="tm-word tm-w2">with</span>
          <span
            className="mx-0.5 inline-block text-rose-500 transition-transform duration-300 group-hover:scale-125"
            style={{ WebkitTextFillColor: 'initial' }}
          >
            ❤️
          </span>
          <span className="tm-word tm-w3">by</span>
          <span className="tm-word tm-w5">Biswodip</span>
          <span className="tm-word tm-w6">Goj</span>
        </button>
        <p className="mt-1.5 text-[11px] text-white/30">Tap the signature ✨</p>
      </footer>

      <AnimatePresence>
        {phase !== 'idle' && phase !== 'shaking' && (
          <motion.div
            key="tm-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
            onClick={phase === 'reveal' ? close : undefined}
          >
            {/* The nameplate sits beneath the paper, revealed as it crumbles away */}
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <Nameplate visible={phase === 'crumbling' || phase === 'reveal'} showHint={phase === 'reveal'} />
            </div>

            {/* Crumbling paper sheet */}
            {phase === 'crumbling' && (
              <div
                className="tm-paper tm-crumble absolute inset-0 origin-center"
                onAnimationEnd={() => setPhase('reveal')}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Nameplate({ visible, showHint }: { visible: boolean; showHint: boolean }) {
  if (!visible) return null
  return (
    <div className="tm-nameplate text-center">
      <div
        className="relative inline-block rounded-3xl px-8 py-7 sm:px-14 sm:py-10"
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
          Crafted by
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
        <p className={`mt-3 text-xs text-white/40 transition-opacity duration-500 ${showHint ? 'opacity-100' : 'opacity-0'}`}>
          Tap anywhere to close
        </p>
      </div>
    </div>
  )
}
