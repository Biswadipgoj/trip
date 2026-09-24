// Animated progress indicators (web: motion.div width bars and the SVG ring
// on the Report page). Both animate from zero on mount, then glide between
// values when the data changes.
import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { G, ink, violet } from '../../theme/colors'
import { toHex } from '../../lib/color'

const clampPct = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0)
const EASE = Easing.out(Easing.cubic)

interface ProgressBarProps {
  /** 0–100 */
  pct: number
  colors?: readonly [string, string, ...string[]]
  height?: number
  trackColor?: string
  style?: StyleProp<ViewStyle>
}

export function ProgressBar({
  pct, colors = G.settle, height = 8, trackColor = ink(0.08), style,
}: ProgressBarProps) {
  const reduced = useReducedMotion()
  const target = clampPct(pct)
  // Shown at its real value when the screen opens; only a change while the
  // screen is open animates (400 ms), so the number is readable at once.
  const width = useSharedValue(target)

  useEffect(() => {
    width.set(reduced ? target : withTiming(target, { duration: 400, easing: EASE }))
  }, [target, reduced, width])

  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }))
  const r = height / 2

  return (
    <View
      style={[{ height, borderRadius: r, backgroundColor: trackColor }, styles.track, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target) }}
    >
      <Animated.View style={[{ height, borderRadius: r }, styles.fill, fill]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface ProgressRingProps {
  pct: number
  color: string
  size?: number
  stroke?: number
  children?: ReactNode
}

export function ProgressRing({ pct, color, size = 56, stroke = 5, children }: ProgressRingProps) {
  const reduced = useReducedMotion()
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const target = clampPct(pct) / 100
  const progress = useSharedValue(target)

  useEffect(() => {
    progress.set(reduced ? target : withTiming(target, { duration: 400, easing: EASE }))
  }, [target, reduced, progress])

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - progress.value) }))

  return (
    <View style={[styles.ring, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={violet(0.12)} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toHex(color)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={[circ, circ]}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: { overflow: 'hidden' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  rotate: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
})
