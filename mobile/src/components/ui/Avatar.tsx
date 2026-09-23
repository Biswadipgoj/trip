// Member avatar — initials on the member's colour with a white ring and a
// coloured glow (web Avatar). `animate` pops it in with a spring.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated'
import { getInitials } from '../../lib/utils'
import { withAlpha } from '../../lib/color'
import { C } from '../../theme/colors'
import { F } from '../../theme/typography'
import { T } from './Text'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<AvatarSize, { dim: number; font: number; ring: number }> = {
  xs: { dim: 24, font: 10, ring: 1.5 },
  sm: { dim: 32, font: 12, ring: 2 },
  md: { dim: 40, font: 14, ring: 2 },
  lg: { dim: 56, font: 17, ring: 2.5 },
  xl: { dim: 80, font: 22, ring: 3 },
}

interface AvatarProps {
  name: string
  color?: string
  size?: AvatarSize
  animate?: boolean
  /** Coloured glow (skipped for xs to keep long lists light). */
  glow?: boolean
  style?: StyleProp<ViewStyle>
}

export function Avatar({ name, color, size = 'md', animate, glow = true, style }: AvatarProps) {
  const reduced = useReducedMotion()
  const { dim, font, ring } = SIZES[size]
  const bg = color || C.brand500
  const circle = (
    <View
      style={[
        styles.circle,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: bg,
          borderWidth: ring,
          boxShadow: glow && size !== 'xs' ? `0px 4px 14px ${withAlpha(bg, 0.33)}` : undefined,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <T style={{ fontFamily: F.semibold, fontSize: font, lineHeight: Math.round(font * 1.25), color: C.white }} maxFontSizeMultiplier={1}>
        {getInitials(name)}
      </T>
    </View>
  )
  if (!animate || reduced) return circle
  return <Animated.View entering={ZoomIn.springify().damping(15).stiffness(260)}>{circle}</Animated.View>
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255,255,255,0.65)',
  },
})
