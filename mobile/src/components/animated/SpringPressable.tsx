// PressScale — a Pressable with a springy scale-down and a light haptic tick,
// the native twin of the web's whileTap={{ scale: 0.96 }}.
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const SPRING = { damping: 18, stiffness: 420, mass: 0.6 }

export type HapticKind = 'light' | 'medium' | 'selection' | 'success' | 'warning' | 'error'

/** Fire-and-forget haptic feedback (silently unavailable on web / some phones). */
export function tick(kind: HapticKind = 'light') {
  try {
    const p =
      kind === 'selection'
        ? Haptics.selectionAsync()
        : kind === 'success' || kind === 'warning' || kind === 'error'
          ? Haptics.notificationAsync(
              kind === 'success'
                ? Haptics.NotificationFeedbackType.Success
                : kind === 'warning'
                  ? Haptics.NotificationFeedbackType.Warning
                  : Haptics.NotificationFeedbackType.Error
            )
          : Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    p.catch(() => {})
  } catch {
    /* no haptics engine */
  }
}

export interface PressScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  /** Scale while pressed (default 0.96). */
  scaleTo?: number
  haptic?: HapticKind | false
}

export function PressScale({
  style, scaleTo = 0.96, haptic = 'light', onPressIn, onPressOut, onPress, children, ...rest
}: PressScaleProps) {
  const scale = useSharedValue(1)
  const reduced = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={e => {
        if (!reduced) scale.value = withSpring(scaleTo, SPRING)
        onPressIn?.(e)
      }}
      onPressOut={e => {
        scale.value = withSpring(1, SPRING)
        onPressOut?.(e)
      }}
      onPress={e => {
        if (haptic) tick(haptic)
        onPress?.(e)
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  )
}
