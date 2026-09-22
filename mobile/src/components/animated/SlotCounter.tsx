import React, { useEffect, useState, useRef } from 'react'
import { Text, TextStyle, StyleProp } from 'react-native'
import { formatCurrency } from '../../lib/utils'

interface SlotCounterProps {
  value: number
  prefix?: string
  suffix?: string
  isCurrency?: boolean
  style?: StyleProp<TextStyle>
  duration?: number
}

export const SlotCounter: React.FC<SlotCounterProps> = ({
  value,
  prefix = '',
  suffix = '',
  isCurrency = true,
  style,
  duration = 800,
}) => {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)

  useEffect(() => {
    const startValue = prevValueRef.current
    const endValue = value
    const startTime = Date.now()

    if (startValue === endValue) return

    let animationFrameId: number

    const updateCounter = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (endValue - startValue) * ease

      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCounter)
      } else {
        prevValueRef.current = endValue
        setDisplayValue(endValue)
      }
    }

    animationFrameId = requestAnimationFrame(updateCounter)
    return () => cancelAnimationFrame(animationFrameId)
  }, [value, duration])

  const formatted = isCurrency
    ? formatCurrency(Math.round(displayValue))
    : Math.round(displayValue).toLocaleString('en-IN')

  return (
    <Text style={style}>
      {prefix}
      {formatted}
      {suffix}
    </Text>
  )
}
