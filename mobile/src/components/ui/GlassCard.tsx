// The web's liquid-glass card: a translucent white → lavender → ice gradient
// panel with a hairline ink border, a soft violet shadow and a top highlight.
// `style` positions the card (margins, flex); `contentStyle` styles the inside.
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { G, ink, shadow } from '../../theme/colors'
import { PressScale } from '../animated/SpringPressable'

export interface GlassCardProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  /** Inner padding (web p-5 = 20). */
  padding?: number
  radius?: number
  /** .glass-strong — more opaque, deeper shadow (modals, overlays). */
  strong?: boolean
  /** Brand glow instead of the neutral glass shadow. */
  glow?: boolean
  onPress?: () => void
  onLongPress?: () => void
  accessibilityLabel?: string
  testID?: string
}

export function GlassCard({
  children, style, contentStyle, padding = 20, radius = 16, strong, glow, onPress, onLongPress,
  accessibilityLabel, testID,
}: GlassCardProps) {
  const card = (
    <View
      style={[
        { borderRadius: radius, boxShadow: glow ? shadow.glowSm : strong ? shadow.strong : shadow.glass },
        onPress || onLongPress ? null : style,
      ]}
      testID={onPress ? undefined : testID}
    >
      <LinearGradient
        colors={strong ? G.glassStrong : G.glass}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.inner, { borderRadius: radius, padding }, contentStyle]}
      >
        <View pointerEvents="none" style={styles.highlight} />
        {children}
      </LinearGradient>
    </View>
  )
  if (!onPress && !onLongPress) return card
  return (
    <PressScale
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.98}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {card}
    </PressScale>
  )
}

const styles = StyleSheet.create({
  inner: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ink(0.1),
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
})
