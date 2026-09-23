// Page chrome: the web's slow "liquid gradient" backdrop (body::before and
// body::after in globals.css) and a safe-area aware screen container.
//
// Each backdrop layer is an SVG of radial-gradient blobs (150% screen size),
// drifting via Reanimated UI-thread animations (transform only, cached
// as a GPU texture on Android) — 60/120fps fluid with zero JS overhead.
import { memo, useEffect, type ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from 'expo-router'
import { BLOBS_A, BLOBS_B, C } from '../../theme/colors'

type Blob = (typeof BLOBS_A)[number]

const BlobLayer = memo(function BlobLayer({ blobs, id }: { blobs: readonly Blob[]; id: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        {blobs.map(([color, alpha], i) => (
          <RadialGradient key={i} id={`${id}${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={alpha} />
            <Stop offset="0.6" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map(([, , cx, cy, rx, ry], i) => (
        <Ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}${i})`} />
      ))}
    </Svg>
  )
})

export const LiquidBackground = memo(function LiquidBackground({ paused = false }: { paused?: boolean }) {
  const { width, height } = useWindowDimensions()
  const reduced = useReducedMotion()
  const W = width * 1.5
  const H = height * 1.5

  const progressA = useSharedValue(0)
  const progressB = useSharedValue(0)

  useEffect(() => {
    if (reduced || paused) {
      progressA.value = 0
      progressB.value = 0
      return
    }
    progressA.value = withRepeat(
      withTiming(1, { duration: 24000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
    progressB.value = withRepeat(
      withTiming(1, { duration: 30000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [reduced, paused, progressA, progressB])

  const styleA = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ scale: 1.15 }] }
    const p = progressA.value
    const tx = interpolate(p, [0, 0.5, 1], [-0.04 * W, 0.04 * W, -0.02 * W])
    const ty = interpolate(p, [0, 0.5, 1], [-0.03 * H, 0.02 * H, 0.05 * H])
    const rot = interpolate(p, [0, 0.5, 1], [0, 7, -6])
    const scale = interpolate(p, [0, 0.5, 1], [1.12, 1.28, 1.16])
    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${rot}deg` },
        { scale },
      ],
    }
  })

  const styleB = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ scale: 1.15 }] }
    const p = progressB.value
    const tx = interpolate(p, [0, 0.5, 1], [0.03 * W, -0.04 * W, 0.02 * W])
    const ty = interpolate(p, [0, 0.5, 1], [0.04 * H, -0.02 * H, -0.04 * H])
    const rot = interpolate(p, [0, 0.5, 1], [0, -9, 6])
    const scale = interpolate(p, [0, 0.5, 1], [1.18, 1.30, 1.20])
    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${rot}deg` },
        { scale },
      ],
    }
  })

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Animated.View renderToHardwareTextureAndroid style={[styles.layer, styleA]}>
        <BlobLayer blobs={BLOBS_A} id="lqa" />
      </Animated.View>
      <Animated.View renderToHardwareTextureAndroid style={[styles.layer, styleB]}>
        <BlobLayer blobs={BLOBS_B} id="lqb" />
      </Animated.View>
    </View>
  )
})

interface ScreenProps {
  children: ReactNode
  /** Render the liquid backdrop (default true). */
  backdrop?: boolean
  /** Safe-area edges to pad (default: top only — scroll views pad the bottom). */
  edges?: ('top' | 'bottom')[]
  style?: StyleProp<ViewStyle>
}

export function Screen({ children, backdrop = true, edges = ['top'], style }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const focused = useIsFocused()
  return (
    <View style={styles.root}>
      {backdrop && <LiquidBackground paused={!focused} />}
      <View
        style={[
          styles.fill,
          { paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface0 },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: C.surface0, overflow: 'hidden' },
  layer: { position: 'absolute', top: '-25%', left: '-25%', width: '150%', height: '150%' },
})
