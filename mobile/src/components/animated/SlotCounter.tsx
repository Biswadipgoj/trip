// CountUp — animates a number towards its value with an ease-out cubic (web
// CountUp). Formats with Indian digit grouping (₹1,25,000). Re-animates from
// the previous value when the number changes, e.g. after a sync.
import { useEffect, useRef, useState } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { formatIndianNumber } from '../../lib/utils'
import { T } from '../ui/Text'
import type { TypeVariant } from '../../theme/typography'

interface CountUpProps {
  value: number
  /** Seconds, like the web component. */
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  variant?: TypeVariant
  color?: string
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}

export function CountUp({
  value, duration = 1.2, decimals = 0, prefix = '', suffix = '', variant = 'money', color, style, numberOfLines = 1,
}: CountUpProps) {
  const reduced = useReducedMotion()
  const safe = Number.isFinite(value) ? value : 0
  const [shown, setShown] = useState(reduced ? safe : 0)
  const from = useRef(reduced ? safe : 0)
  const frame = useRef(0)

  useEffect(() => {
    if (reduced) {
      from.current = safe
      setShown(safe)
      return
    }
    const start = from.current
    const t0 = Date.now()
    const ms = duration * 1000
    const step = () => {
      const p = Math.min((Date.now() - t0) / ms, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const current = start + (safe - start) * eased
      from.current = current
      setShown(current)
      if (p < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [safe, duration, reduced])

  const text = decimals > 0
    ? formatIndianNumber(shown, decimals)
    : formatIndianNumber(Math.round(shown), 0)

  return (
    <T variant={variant} color={color} style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit={numberOfLines === 1}>
      {prefix}{text}{suffix}
    </T>
  )
}
