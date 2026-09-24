'use client'

import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  /** Indian digit grouping (₹1,25,000 style); default true */
  indian?: boolean
}

/**
 * Shows a number with Indian digit grouping (₹1,25,000). The real value is
 * shown as soon as the page opens — a count from zero delays reading money on
 * a screen people open many times a day — and a later change (a new expense,
 * a sync) tweens briefly from the old value so it is noticed.
 */
export function CountUp({
  end,
  duration = 0.3,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  indian = true,
}: CountUpProps) {
  const [value, setValue] = useState(end)
  const frameRef = useRef<number>(0)
  const prevEndRef = useRef<number>(end)

  useEffect(() => {
    const startVal = prevEndRef.current
    prevEndRef.current = end
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (startVal === end || reduced) {
      setValue(end)
      return
    }

    const startTime = performance.now()
    const ms = Math.min(duration, 0.4) * 1000

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / ms, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(startVal + (end - startVal) * eased)
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [end, duration])

  const formatted = indian
    ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
    : value.toFixed(decimals)

  return (
    <span className={className}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
