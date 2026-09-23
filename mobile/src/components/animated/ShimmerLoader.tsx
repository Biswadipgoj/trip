// Skeleton placeholders with the web's violet shimmer (.animate-shimmer).
import { useState } from 'react'
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { ink, violet } from '../../theme/colors'

interface SkeletonProps {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const reduced = useReducedMotion()
  const [w, setW] = useState(0)
  return (
    <View
      style={[styles.base, { width, height, borderRadius: radius }, style]}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 && !reduced && (
        <Animated.View
          style={[
            styles.stripe,
            { width: w },
            {
              animationName: {
                from: { transform: [{ translateX: -w }] },
                to: { transform: [{ translateX: w }] },
              },
              animationDuration: '1.6s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            },
          ]}
        >
          <LinearGradient
            colors={[violet(0), violet(0.12), violet(0)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  )
}

/** Placeholder card while a trip is loading for the first time. */
export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={styles.lines}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="35%" height={11} />
        </View>
      </View>
      <View style={styles.rowBetween}>
        <Skeleton width={96} height={22} />
        <Skeleton width={64} height={22} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { backgroundColor: violet(0.06), overflow: 'hidden' },
  stripe: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ink(0.08),
    backgroundColor: 'rgba(255,255,255,0.55)',
    padding: 18,
    gap: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lines: { flex: 1, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
})
