'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiBlastProps {
  trigger: boolean
  onComplete?: () => void
  type?: 'burst' | 'rain' | 'celebration'
}

export function ConfettiBlast({ trigger, onComplete, type = 'burst' }: ConfettiBlastProps) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (!trigger || firedRef.current) return
    firedRef.current = true

    if (type === 'burst') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
        gravity: 0.8,
        scalar: 1.1,
      })
    } else if (type === 'rain') {
      const duration = 3000
      const end = Date.now() + duration
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#6366f1', '#8b5cf6', '#ec4899'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#f59e0b', '#10b981', '#3b82f6'],
        })
        if (Date.now() < end) requestAnimationFrame(frame)
        else onComplete?.()
      }
      frame()
    } else if (type === 'celebration') {
      const count = 200
      const defaults = { origin: { y: 0.7 } }
      const fire = (particleRatio: number, opts: confetti.Options) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        })
      }
      fire(0.25, { spread: 26, startVelocity: 55 })
      fire(0.2, { spread: 60 })
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
      fire(0.1, { spread: 120, startVelocity: 45 })
      setTimeout(() => { onComplete?.() }, 2500)
    }
  }, [trigger, type, onComplete])

  return null
}
