// Page chrome: the web's "liquid gradient" backdrop (body::before and
// body::after in globals.css) and a safe-area aware screen container.
// Each backdrop layer is an SVG of radial-gradient blobs (150% screen size).
import { memo, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

/** Static: the backdrop used to drift forever (two full-screen layers
 *  animating on every frame), which cost battery and frames on Android for
 *  no information. Same look, zero per-frame work. */
export const LiquidBackground = memo(function LiquidBackground() {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <View style={[styles.layer, styles.layerA]}>
        <BlobLayer blobs={BLOBS_A} id="lqa" />
      </View>
      <View style={[styles.layer, styles.layerB]}>
        <BlobLayer blobs={BLOBS_B} id="lqb" />
      </View>
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
  return (
    <View style={styles.root}>
      {backdrop && <LiquidBackground />}
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
  layerA: { transform: [{ scale: 1.15 }] },
  layerB: { transform: [{ scale: 1.2 }, { rotate: '-6deg' }] },
})
