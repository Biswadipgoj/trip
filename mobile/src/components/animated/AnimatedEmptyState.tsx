// Empty state (web: centred icon + two lines), with a gently floating icon.
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
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

const FLOAT = {
  animationName: {
    '0%': { transform: [{ translateY: 0 }] },
    '50%': { transform: [{ translateY: -8 }] },
    '100%': { transform: [{ translateY: 0 }] },
  },
  animationDuration: '4s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
} as const

export function EmptyState({ icon: Icon, title, subtitle, color, action, delay = 100 }: EmptyStateProps) {
  const reduced = useReducedMotion()
  const tint = color ?? ink(0.4)
  return (
    <FadeIn delay={delay} style={styles.wrap}>
      <Animated.View style={[styles.iconBox, { backgroundColor: color ? withAlpha(color, 0.1) : brand600(0.08) }, !reduced && FLOAT]}>
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
