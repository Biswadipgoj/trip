import React, { useEffect, useState } from 'react'
import { StyleSheet, View, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const CONFETTI_COLORS = [
  '#FF6B6B', '#FFA07A', '#4E65FF', '#92EFFD', '#00F260',
  '#FFD200', '#F7971E', '#EC4899', '#8B5CF6'
]

interface ParticleProps {
  index: number
  color: string
}

const Particle: React.FC<ParticleProps> = ({ index, color }) => {
  const startX = SCREEN_WIDTH / 2
  const startY = SCREEN_HEIGHT / 3

  const targetX = (Math.random() - 0.5) * SCREEN_WIDTH * 1.2
  const targetY = (Math.random() - 0.5) * SCREEN_HEIGHT * 0.8 + 200

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)
  const rotation = useSharedValue(0)
  const scale = useSharedValue(0)

  useEffect(() => {
    const delay = Math.random() * 200
    const duration = 1800 + Math.random() * 800

    scale.value = withDelay(delay, withTiming(1, { duration: 200 }))
    translateX.value = withDelay(
      delay,
      withTiming(targetX, { duration, easing: Easing.out(Easing.quad) })
    )
    translateY.value = withDelay(
      delay,
      withTiming(targetY, { duration, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
    )
    rotation.value = withDelay(
      delay,
      withTiming(Math.random() * 720 - 360, { duration })
    )
    opacity.value = withDelay(
      delay + duration * 0.6,
      withTiming(0, { duration: duration * 0.4 })
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }))

  const isCircle = index % 3 === 0
  const size = 8 + (index % 6) * 2

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          top: startY,
          backgroundColor: color,
          width: size,
          height: isCircle ? size : size * 1.5,
          borderRadius: isCircle ? size / 2 : 2,
        },
        style,
      ]}
    />
  )
}

interface ConfettiBlastProps {
  count?: number
  onComplete?: () => void
}

export const ConfettiBlast: React.FC<ConfettiBlastProps> = ({
  count = 60,
  onComplete,
}) => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 2800)
    return () => clearTimeout(timer)
  }, [onComplete])

  if (!visible) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Particle
          key={i}
          index={i}
          color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
})
