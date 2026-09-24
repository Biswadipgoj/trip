// Charts for the Dashboard and Report (web: recharts). Drawn with SVG and
// animated on the UI thread:
//  • DonutChart — category split; slices sweep in clockwise with gaps.
//  • BarChart   — daily spending; gradient columns grow from the baseline.
//  • HBarChart  — member contribution; coloured bars fill left → right.
import { useEffect, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { G, ink, violet } from '../../theme/colors'
import { toHex } from '../../lib/color'
import { ProgressBar } from '../animated/ProgressRing'
import { T } from './Text'

const EASE = Easing.out(Easing.cubic)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Short money label for tight spaces: 950 · 3.2k · 1.4L · 2.1Cr */
export function shortMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1).replace(/\.0$/, '')}L`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1).replace(/\.0$/, '')}k`
  return `${sign}${Math.round(abs)}`
}

// ─── Donut ────────────────────────────────────────────────────────────────────

export interface DonutSlice {
  key: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutSlice[]
  size?: number
  thickness?: number
  /** Gap between slices, degrees (recharts paddingAngle). */
  gap?: number
  children?: ReactNode
}

export function DonutChart({ data, size = 170, thickness = 24, gap = 3, children }: DonutChartProps) {
  const reduced = useReducedMotion()
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)
  const r = (size - thickness) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const gapLen = data.length > 1 ? (gap / 360) * circ : 0
  const progress = useSharedValue(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) {
      progress.value = 1
      return
    }
    progress.value = 0
    progress.value = withDelay(200, withTiming(1, { duration: 950, easing: EASE }))
  }, [total, data.length, reduced, progress])

  let acc = 0
  const slices = data.map(d => {
    const len = total > 0 ? (Math.max(0, d.value) / total) * circ : 0
    const slice = { ...d, start: acc, len: Math.max(0.001, len - gapLen) }
    acc += len
    return slice
  })

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={violet(0.07)} strokeWidth={thickness} />
        {total > 0 &&
          slices.map(s => (
            <Slice key={s.key} c={c} r={r} thickness={thickness} color={s.color} start={s.start} len={s.len} circ={circ} progress={progress} />
          ))}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  )
}

function Slice({ c, r, thickness, color, start, len, circ, progress }: {
  c: number; r: number; thickness: number; color: string; start: number; len: number; circ: number
  progress: SharedValue<number>
}) {
  // Dash of length `len` whose offset hides the part not yet swept.
  const animatedProps = useAnimatedProps(() => {
    const visible = Math.min(Math.max(progress.value * circ - start, 0), len)
    return { strokeDashoffset: len - visible }
  })
  return (
    <AnimatedCircle
      cx={c}
      cy={c}
      r={r}
      fill="none"
      stroke={toHex(color)}
      strokeWidth={thickness}
      strokeDasharray={[len, circ]}
      transform={`rotate(${-90 + (start / circ) * 360} ${c} ${c})`}
      animatedProps={animatedProps}
    />
  )
}

// ─── Vertical bars (daily spending) ──────────────────────────────────────────

interface BarDatum {
  key: string
  label: string
  value: number
}

export function BarChart({ data, height = 190 }: { data: BarDatum[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.value))
  const plot = height - 40 // room for value + day labels
  const spread = data.length <= 6
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.bars, { height }, spread && styles.barsSpread]}
    >
      {data.map((d, i) => (
        <Bar key={d.key} value={d.value} label={d.label} target={(d.value / max) * plot} index={i} />
      ))}
    </ScrollView>
  )
}

function Bar({ value, label, target, index }: { value: number; label: string; target: number; index: number }) {
  const reduced = useReducedMotion()
  const h = useSharedValue(reduced ? target : 0)
  useEffect(() => {
    h.value = reduced ? target : withDelay(Math.min(index * 55, 450), withTiming(target, { duration: 850, easing: EASE }))
  }, [target, index, reduced, h])
  const style = useAnimatedStyle(() => ({ height: Math.max(3, h.value) }))
  return (
    <View style={styles.barCol}>
      <T variant="tinySemibold" color={ink(0.65)} numberOfLines={1}>₹{shortMoney(value)}</T>
      <Animated.View style={[styles.bar, style]}>
        <LinearGradient colors={G.brand} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <T variant="tiny" color={ink(0.6)} numberOfLines={1}>{label}</T>
    </View>
  )
}

// ─── Horizontal bars (member contribution) ───────────────────────────────────

export interface HBarDatum {
  key: string
  label: string
  value: number
  color: string
}

export function HBarChart({ data, format }: { data: HBarDatum[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <View style={styles.hbars}>
      {data.map((d, i) => (
        <View key={d.key} style={styles.hbarRow}>
          <T variant="smallMedium" color={ink(0.72)} numberOfLines={1} style={styles.hbarLabel}>{d.label}</T>
          <ProgressBar
            pct={(d.value / max) * 100}
            colors={[toHex(d.color), toHex(d.color)]}
            height={14}
            trackColor={violet(0.06)}
            style={styles.hbarTrack}
          />
          <T variant="smallSemibold" numberOfLines={1} style={styles.hbarValue}>{format(d.value)}</T>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bars: { alignItems: 'flex-end', gap: 12, paddingHorizontal: 4, flexGrow: 1 },
  barsSpread: { justifyContent: 'space-around' },
  barCol: { width: 38, alignItems: 'center', gap: 5 },
  bar: {
    width: 24,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    overflow: 'hidden',
  },
  hbars: { gap: 12 },
  hbarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hbarLabel: { width: 72 },
  hbarTrack: { flex: 1 },
  hbarValue: { minWidth: 64, textAlign: 'right' },
})
