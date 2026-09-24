// PressScale — a Pressable that scales down on press-in (the native twin of
// the web's whileTap). Feedback lands on press-in, the action on press-out.
// Haptics are opt-in per control: a tick on every tap trains people to turn
// them off, so they are kept for selections and committed actions.
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
const PRESS_IN = { duration: 120, easing: EASE_OUT }
const PRESS_OUT = { duration: 160, easing: EASE_OUT }

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
  /** Scale while pressed (default 0.97). */
  scaleTo?: number
  haptic?: HapticKind | false
}

export function PressScale({
  style, scaleTo = 0.97, haptic = false, onPressIn, onPressOut, onPress, children, ...rest
}: PressScaleProps) {
  const scale = useSharedValue(1)
  const reduced = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={e => {
        if (!reduced) scale.set(withTiming(scaleTo, PRESS_IN))
        onPressIn?.(e)
      }}
      onPressOut={e => {
        scale.set(withTiming(1, PRESS_OUT))
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
