// Page chrome: the web's slow "liquid gradient" backdrop (body::before and
// body::after in globals.css) and a safe-area aware screen container.
//
// Each backdrop layer is a static SVG of radial-gradient blobs, 150 % of the
// screen, drifting via a native CSS keyframe animation (transform only, cached
// as a GPU texture on Android) — no JS runs per frame. It pauses while the
// screen is hidden and holds still when the system asks for reduced motion.
import { memo, useMemo, type ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
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

// liquidDrift / liquidDrift2 from globals.css. CSS translate percentages are
// relative to the layer itself (150 % of the screen), so convert to px.
function drift(W: number, H: number, layer: 'a' | 'b') {
  const at = (x: number, y: number, deg: number, scale: number) => ({
    transform: [{ translateX: x * W }, { translateY: y * H }, { rotate: `${deg}deg` }, { scale }],
  })
  return layer === 'a'
    ? { '0%': at(-0.04, -0.03, 0, 1.12), '50%': at(0.04, 0.02, 7, 1.28), '100%': at(-0.02, 0.05, -6, 1.16) }
    : { '0%': at(0.03, 0.04, 0, 1.18), '50%': at(-0.04, -0.02, -9, 1.3), '100%': at(0.02, -0.04, 6, 1.2) }
}

export const LiquidBackground = memo(function LiquidBackground({ paused = false }: { paused?: boolean }) {
  const { width, height } = useWindowDimensions()
  const reduced = useReducedMotion()
  const W = width * 1.5
  const H = height * 1.5
  const keyframesA = useMemo(() => drift(W, H, 'a'), [W, H])
  const keyframesB = useMemo(() => drift(W, H, 'b'), [W, H])

  const motion = (keyframes: ReturnType<typeof drift>, seconds: number) =>
    reduced
      ? { transform: [{ scale: 1.15 }] }
      : ({
          animationName: keyframes,
          animationDuration: `${seconds}s`,
          animationIterationCount: 'infinite',
          animationDirection: 'alternate',
          animationTimingFunction: 'ease-in-out',
          animationPlayState: paused ? 'paused' : 'running',
        } as const)

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Animated.View renderToHardwareTextureAndroid style={[styles.layer, motion(keyframesA, 24)]}>
        <BlobLayer blobs={BLOBS_A} id="lqa" />
      </Animated.View>
      <Animated.View renderToHardwareTextureAndroid style={[styles.layer, motion(keyframesB, 30)]}>
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
