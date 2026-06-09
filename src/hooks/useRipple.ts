'use client'

import { useRef, useCallback } from 'react'

interface RippleConfig {
  color?: string
  duration?: number
}

export function useRipple(config: RippleConfig = {}) {
  const { color = 'rgba(255,255,255,0.25)', duration = 600 } = config
  const containerRef = useRef<HTMLElement>(null)

  const trigger = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const x = clientX - rect.left
    const y = clientY - rect.top
    const radius = Math.max(rect.width, rect.height) * 1.5

    const ripple = document.createElement('span')
    ripple.style.cssText = `
      position: absolute;
      left: ${x - radius}px;
      top: ${y - radius}px;
      width: ${radius * 2}px;
      height: ${radius * 2}px;
      background: ${color};
      border-radius: 50%;
      transform: scale(0);
      animation: ripple-expand ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
      pointer-events: none;
      z-index: 0;
    `

    el.style.position = 'relative'
    el.style.overflow = 'hidden'
    el.appendChild(ripple)
    setTimeout(() => ripple.remove(), duration + 100)
  }, [color, duration])

  return { containerRef, trigger }
}
