// StatusBadge — pill with a softly pulsing dot (web StatusBadge), for trip
// status (active / closed) and payment status (due / paid / confirmed).
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated'
import { C } from '../../theme/colors'
import { withAlpha } from '../../lib/color'
import { T } from '../ui/Text'

export type BadgeStatus = 'pending' | 'paid' | 'confirmed' | 'active' | 'closed'

const CONFIG: Record<BadgeStatus, { label: string; color: string }> = {
  pending: { label: 'Due', color: C.amber600 },
  paid: { label: 'Paid', color: C.blue500 },
  confirmed: { label: 'Confirmed', color: C.emerald400 },
  active: { label: 'Active', color: C.brand500 },
  closed: { label: 'Closed', color: C.slate400 },
}

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const reduced = useReducedMotion()
  const { label: defaultLabel, color } = CONFIG[status]
  const live = status === 'pending' || status === 'active'
  const pulse = useSharedValue(0)

  useEffect(() => {
    if (live && !reduced) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    }
  }, [live, reduced, pulse])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [1, 0.35]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.6]) }],
  }))

  return (
    <Animated.View
      entering={reduced ? undefined : ZoomIn.springify().damping(16)}
      style={[styles.pill, { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.25) }]}
    >
      <View style={styles.dotBox}>
        {live && !reduced && (
          <Animated.View style={[styles.dot, styles.halo, { backgroundColor: withAlpha(color, 0.5) }, pulseStyle]} />
        )}
        <View style={[styles.dot, { backgroundColor: color, boxShadow: `0px 0px 6px ${withAlpha(color, 0.8)}` }]} />
      </View>
      <T variant="smallMedium" color={color}>{label ?? defaultLabel}</T>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dotBox: { width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  halo: { position: 'absolute' },
})
