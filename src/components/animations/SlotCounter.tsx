'use client'

import { useEffect, useRef, useState } from 'react'

interface SlotCounterProps {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  duration?: number
}

const DIGITS = '0123456789'

/**
 * SlotCounter — Numbers roll like a slot machine.
 * Each digit column spins independently based on its change distance.
 */
export function SlotCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  duration = 800,
}: SlotCounterProps) {
  const formatted = value.toFixed(decimals)
  const chars = (prefix + formatted + suffix).split('')

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', overflow: 'hidden' }}>
      {chars.map((char, i) => (
        <SlotDigit key={`${i}-${char}`} char={char} duration={duration} delay={i * 30} />
      ))}
    </span>
  )
}

function SlotDigit({ char, duration, delay }: { char: string; duration: number; delay: number }) {
  const isDigit = DIGITS.includes(char)
  const [displayed, setDisplayed] = useState(char)
  const [animating, setAnimating] = useState(false)
  const prevChar = useRef(char)

  useEffect(() => {
    if (prevChar.current === char) return
    prevChar.current = char
    if (!isDigit) { setDisplayed(char); return }

    setAnimating(true)
    const timeout = setTimeout(() => {
      setDisplayed(char)
      setAnimating(false)
    }, duration + delay)

    return () => clearTimeout(timeout)
  }, [char, duration, delay, isDigit])

  if (!isDigit) {
    return <span style={{ display: 'inline-block' }}>{char}</span>
  }

  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        height: '1.2em',
        lineHeight: '1.2em',
        verticalAlign: 'bottom',
      }}
    >
      <span
        key={`${char}-${animating}`}
        style={{
          display: 'block',
          animation: animating
            ? `slotSpin ${duration + delay}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
            : 'none',
        }}
      >
        {displayed}
      </span>
    </span>
  )
}

/**
 * Animated currency display with rolling digits.
 * Use for every monetary value in the app.
 */
export function AnimatedAmount({
  amount,
  className,
  duration = 900,
}: {
  amount: number
  className?: string
  duration?: number
}) {
  return (
    <SlotCounter
      value={amount}
      prefix="₹"
      decimals={0}
      className={className}
      duration={duration}
    />
  )
}
