'use client'

import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  start?: number
}

export function CountUp({
  end,
  duration = 1.2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  start = 0,
}: CountUpProps) {
  const [value, setValue] = useState(start)
  const frameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const prevEndRef = useRef<number>(start)

  useEffect(() => {
    const startVal = prevEndRef.current
    prevEndRef.current = end

    const startTime = performance.now()
    startTimeRef.current = startTime

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startVal + (end - startVal) * eased

      setValue(current)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [end, duration])

  const formatted = value.toFixed(decimals)

  return (
    <span className={className}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
