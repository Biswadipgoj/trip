// Gradient stat tile (web StatCard / KPI tiles — "Cred/PhonePe-style"): vivid
// gradient, glassy icon badge, uppercase label, counting value, a trend line
// and a light sheen sweeping across every few seconds.
import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { TrendingDown, TrendingUp } from 'lucide-react-native'
import { C, G, shadow, whiteA } from '../../theme/colors'
import { CountUp } from '../animated/SlotCounter'
import { useRiseIn } from '../animated/FadeInView'
import { T } from './Text'
import type { IconType } from './Button'

export type StatGradient = 'indigoPurple' | 'orangePink' | 'blueCyan' | 'emeraldTeal' | 'violetFuchsia'

interface StatCardProps {
  gradient: StatGradient
  icon: IconType
  label: string
  /** Numeric value → counts up with ₹ prefix. */
  value?: number
  /** Pre-formatted text instead of a counting number (KPI tiles). */
  text?: string
  trend?: string
  trendUp?: boolean | null
  delay?: number
  action?: ReactNode
  /** Smaller tile (Report KPI row). */
  compact?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function StatCard({
  gradient, icon: Icon, label, value, text, trend, trendUp, delay = 0, action, compact, style, testID,
}: StatCardProps) {
  // Web: initial { opacity: 0, y: 24, scale: 0.96 } → animate, 0.5 s.
  const rise = useRiseIn({ delay, distance: 24, fromScale: 0.96 })
  return (
    <Animated.View
      style={[{ borderRadius: compact ? 18 : 24, boxShadow: shadow[gradient] }, style, rise]}
      testID={testID}
    >
      <LinearGradient
        colors={G[gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact ? styles.compact : styles.regular]}
      >
        <Sheen />
        <View style={[styles.top, compact && styles.topCompact]}>
          <View style={[styles.iconTile, compact && styles.iconTileCompact]}>
            <Icon size={compact ? 15 : 19} color={C.white} strokeWidth={2.2} />
          </View>
          {compact ? (
            <T variant="label" color={whiteA(0.78)} numberOfLines={1} style={styles.compactLabel}>{label}</T>
          ) : (
            action
          )}
        </View>
        {!compact && <T variant="label" color={whiteA(0.75)} numberOfLines={1} style={styles.label}>{label}</T>}
        {text !== undefined ? (
          <T variant={compact ? 'moneySm' : 'money'} color={C.white} numberOfLines={1} adjustsFontSizeToFit>{text}</T>
        ) : (
          <CountUp value={value ?? 0} prefix="₹" duration={1.4} variant={compact ? 'moneySm' : 'money'} color={C.white} />
        )}
        {trend ? (
          <View style={styles.trend}>
            {trendUp === true && <TrendingUp size={12} color={whiteA(0.85)} strokeWidth={2.4} />}
            {trendUp === false && <TrendingDown size={12} color={whiteA(0.85)} strokeWidth={2.4} />}
            <T variant="tiny" color={whiteA(0.85)} numberOfLines={2} style={styles.trendText}>{trend}</T>
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  )
}

/** The web's .liquid-sheen: a static corner glow + a diagonal light sweep. */
export function Sheen({ period = 5 }: { period?: number }) {
  const reduced = useReducedMotion()
  const [w, setW] = useState(0)
  const sweepProgress = useSharedValue(0)

  useEffect(() => {
    if (reduced || w <= 0) return
    sweepProgress.value = 0
    sweepProgress.value = withRepeat(
      withSequence(
        withTiming(0, { duration: period * 600 }),
        withTiming(1, { duration: period * 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [w, reduced, period, sweepProgress])

  const sweepStyle = useAnimatedStyle(() => {
    if (reduced || w <= 0) return { opacity: 0 }
    const tx = interpolate(sweepProgress.value, [0, 1], [-w * 0.9, w * 1.6])
    return {
      transform: [{ translateX: tx }, { rotate: '20deg' }],
    }
  })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={e => setW(e.nativeEvent.layout.width)}>
      <LinearGradient
        colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.35, y: 0.75 }}
        style={StyleSheet.absoluteFill}
      />
      {w > 0 && !reduced && (
        <Animated.View style={[styles.sweep, { width: w * 0.6 }, sweepStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  regular: { borderRadius: 24, padding: 18 },
  compact: { borderRadius: 18, padding: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  topCompact: { justifyContent: 'flex-start', gap: 8, marginBottom: 8 },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileCompact: { width: 28, height: 28, borderRadius: 9 },
  compactLabel: { flex: 1, fontSize: 10 },
  label: { marginBottom: 2 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  trendText: { flexShrink: 1 },
  sweep: { position: 'absolute', top: '-60%', height: '220%', left: 0 },
})
