// Animated progress indicators (web: motion.div width bars and the SVG ring
// on the Report page). Both animate from zero on mount, then glide between
// values when the data changes.
import { useEffect, useRef, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
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
  /** Delay before the first fill, ms. */
  delay?: number
  duration?: number
  trackColor?: string
  style?: StyleProp<ViewStyle>
}

export function ProgressBar({
  pct, colors = G.settle, height = 8, delay = 300, duration = 1100, trackColor = ink(0.08), style,
}: ProgressBarProps) {
  const reduced = useReducedMotion()
  const target = clampPct(pct)
  const width = useSharedValue(reduced ? target : 0)
  const first = useRef(true)

  useEffect(() => {
    if (reduced) {
      width.value = target
    } else {
      const anim = withTiming(target, { duration: first.current ? duration : 600, easing: EASE })
      width.value = first.current ? withDelay(delay, anim) : anim
    }
    first.current = false
  }, [target, reduced, delay, duration, width])

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
  delay?: number
  children?: ReactNode
}

export function ProgressRing({ pct, color, size = 56, stroke = 5, delay = 300, children }: ProgressRingProps) {
  const reduced = useReducedMotion()
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const target = clampPct(pct) / 100
  const progress = useSharedValue(reduced ? target : 0)

  useEffect(() => {
    progress.value = reduced ? target : withDelay(delay, withTiming(target, { duration: 1200, easing: EASE }))
  }, [target, reduced, delay, progress])

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
