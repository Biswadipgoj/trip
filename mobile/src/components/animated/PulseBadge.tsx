import React, { useEffect } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'

interface PulseBadgeProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  scaleFactor?: number
}

export const PulseBadge: React.FC<PulseBadgeProps> = ({
  children,
  style,
  scaleFactor = 1.05,
}) => {
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(scaleFactor, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    )
  }, [scale, scaleFactor])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  )
}
