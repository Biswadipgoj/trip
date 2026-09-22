import React from 'react'
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

interface SpringPressableProps extends PressableProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  scaleTo?: number
  enableHaptics?: boolean
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export const SpringPressable: React.FC<SpringPressableProps> = ({
  children,
  style,
  scaleTo = 0.96,
  enableHaptics = true,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const triggerHaptic = () => {
    if (enableHaptics) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      } catch {
        // Safe fallback on unsupported devices
      }
    }
  }

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        'worklet'
        scale.value = withSpring(scaleTo, { damping: 14, stiffness: 280 })
        if (enableHaptics) {
          runOnJS(triggerHaptic)()
        }
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        'worklet'
        scale.value = withSpring(1, { damping: 14, stiffness: 280 })
        onPressOut?.(e)
      }}
      onPress={onPress}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  )
}
