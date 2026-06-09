'use client'

import { useRef, useCallback } from 'react'

/**
 * Magnetic cursor attraction effect.
 * Element subtly moves toward the cursor on hover.
 */
export function useMagnetic(strength: number = 0.3) {
  const ref = useRef<HTMLElement>(null)

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) * strength
    const dy = (e.clientY - cy) * strength
    el.style.transform = `translate(${dx}px, ${dy}px)`
    el.style.transition = 'transform 0.15s cubic-bezier(0.33, 1, 0.68, 1)'
  }, [strength])

  const onMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'translate(0, 0)'
    el.style.transition = 'transform 0.5s cubic-bezier(0.33, 1, 0.68, 1)'
  }, [])

  return { ref, onMouseMove, onMouseLeave }
}

/**
 * 3D tilt effect for cards.
 * Card tilts toward the cursor, creating a physical depth illusion.
 */
export function useTilt(maxTilt: number = 8) {
  const ref = useRef<HTMLElement>(null)

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5   // -0.5 to 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5

    const rotateX = -y * maxTilt
    const rotateY =  x * maxTilt

    el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`
    el.style.transition = 'transform 0.1s ease-out'
    // Dynamic shadow
    el.style.boxShadow = `
      ${rotateY * -2}px ${rotateX * 2}px 40px rgba(0,0,0,0.4),
      ${rotateY * -1}px ${rotateX}px 12px rgba(100,90,230,0.2)
    `
  }, [maxTilt])

  const onMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)'
    el.style.transition = 'transform 0.5s cubic-bezier(0.33, 1, 0.68, 1), box-shadow 0.5s ease'
    el.style.boxShadow = ''
  }, [])

  return { ref, onMouseMove, onMouseLeave }
}
