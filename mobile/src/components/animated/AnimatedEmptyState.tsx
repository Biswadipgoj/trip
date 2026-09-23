// Empty state (web: centred icon + two lines), with a gently floating icon.
import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { brand600, ink } from '../../theme/colors'
import { withAlpha } from '../../lib/color'
import { T } from '../ui/Text'
import { FadeIn } from './FadeInView'
import type { IconType } from '../ui/Button'

interface EmptyStateProps {
  icon: IconType
  title: string
  subtitle?: string
  /** Icon colour (default: ink/40 like the web). */
  color?: string
  action?: ReactNode
  delay?: number
}

export function EmptyState({ icon: Icon, title, subtitle, color, action, delay = 100 }: EmptyStateProps) {
  const reduced = useReducedMotion()
  const tint = color ?? ink(0.4)
  const floatY = useSharedValue(0)

  useEffect(() => {
    if (!reduced) {
      floatY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    }
  }, [reduced, floatY])

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }))

  return (
    <FadeIn delay={delay} style={styles.wrap}>
      <Animated.View
        style={[
          styles.iconBox,
          { backgroundColor: color ? withAlpha(color, 0.1) : brand600(0.08) },
          !reduced && floatStyle,
        ]}
      >
        <Icon size={40} color={tint} strokeWidth={1.8} />
      </Animated.View>
      <T variant="bodyMedium" color={ink(0.62)} center>{title}</T>
      {subtitle ? <T variant="body" color={ink(0.5)} center style={styles.subtitle}>{subtitle}</T> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </FadeIn>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  iconBox: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  subtitle: { marginTop: 4 },
  action: { marginTop: 18 },
})
