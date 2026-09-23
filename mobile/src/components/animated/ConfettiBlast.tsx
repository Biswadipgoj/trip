// Confetti (web: canvas-confetti). Paper pieces burst from below centre,
// arc up, tumble and fall under gravity — all computed on the UI thread from
// one timing value per piece. Fires every time `shot` changes to a new
// non-zero number.
import { memo, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#E935CB', '#22C3A3']
const DURATION_MS = 2600
const GRAVITY = 1500 // px/s²

interface Piece {
  x0: number
  y0: number
  vx: number
  vy: number
  spin: number
  w: number
  h: number
  color: string
  round: boolean
}

function burst(count: number, originX: number, originY: number, spreadDeg: number, speed: [number, number], scale = 1): Piece[] {
  return Array.from({ length: count }, () => {
    const angle = ((-90 + (Math.random() - 0.5) * spreadDeg) * Math.PI) / 180
    const v = speed[0] + Math.random() * (speed[1] - speed[0])
    return {
      x0: originX,
      y0: originY,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      spin: (Math.random() - 0.5) * 1440,
      w: (5 + Math.random() * 5) * scale,
      h: (8 + Math.random() * 8) * scale,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.25,
    }
  })
}

export function Confetti({ shot, type = 'burst' }: { shot: number; type?: 'burst' | 'celebration' }) {
  const reduced = useReducedMotion()
  const { width, height } = useWindowDimensions()
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!shot || reduced) return
    setActive(shot)
    const t = setTimeout(() => setActive(0), DURATION_MS + 200)
    return () => clearTimeout(t)
  }, [shot, reduced])

  const pieces = useMemo(() => {
    if (!active) return []
    const ox = width / 2
    const oy = height * (type === 'celebration' ? 0.72 : 0.62)
    return type === 'celebration'
      ? [
          ...burst(30, ox, oy, 26, [1100, 1500]),
          ...burst(26, ox, oy, 60, [900, 1300]),
          ...burst(40, ox, oy, 100, [700, 1150], 0.8),
          ...burst(14, ox, oy, 120, [500, 800], 1.2),
        ]
      : burst(70, ox, oy, 80, [800, 1300])
  }, [active, type, width, height])

  if (!active) return null
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={`${active}-${i}`} piece={p} />
      ))}
    </View>
  )
}

const ConfettiPiece = memo(function ConfettiPiece({ piece }: { piece: Piece }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION_MS, easing: Easing.linear })
  }, [t])
  const style = useAnimatedStyle(() => {
    const s = (t.value * DURATION_MS) / 1000
    // light air drag keeps the fall floaty
    const drag = 1 - Math.min(0.45, s * 0.18)
    return {
      opacity: t.value > 0.75 ? 1 - (t.value - 0.75) / 0.25 : 1,
      transform: [
        { translateX: piece.x0 + piece.vx * s * drag },
        { translateY: piece.y0 + piece.vy * s * drag + 0.5 * GRAVITY * s * s },
        { rotate: `${piece.spin * s}deg` },
        { rotateX: `${piece.spin * s * 0.6}deg` },
      ],
    }
  })
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.w, height: piece.round ? piece.w : piece.h, borderRadius: piece.round ? piece.w / 2 : 1.5, backgroundColor: piece.color },
        style,
      ]}
    />
  )
})

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
})
