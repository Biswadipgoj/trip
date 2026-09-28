// Buttons — the web's .btn-brand (violet → fuchsia gradient) and .btn-ghost,
// plus tinted "soft" variants for secondary actions (Mark Paid, Confirm…).
import type { ComponentType } from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { C, G, ink, shadow, violet } from '../../theme/colors'
import { F } from '../../theme/typography'
import { withAlpha } from '../../lib/color'
import { PressScale, type HapticKind } from '../animated/SpringPressable'
import { T } from './Text'
import { Sheen } from './StatCard'

export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

type Variant = 'brand' | 'ghost' | 'soft' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  title: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  icon?: IconType
  iconRight?: IconType
  /** Tint for the soft variant (defaults to brand violet). */
  tone?: string
  loading?: boolean
  disabled?: boolean
  full?: boolean
  haptic?: HapticKind | false
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  testID?: string
}

const SIZES: Record<Size, { py: number; px: number; font: number; icon: number; radius: number }> = {
  sm: { py: 8, px: 14, font: 12, icon: 14, radius: 10 },
  md: { py: 12, px: 20, font: 14, icon: 16, radius: 12 },
  lg: { py: 15, px: 22, font: 15, icon: 18, radius: 14 },
}

export function Button({
  title, onPress, variant = 'brand', size = 'md', icon: Icon, iconRight: IconRight, tone, loading,
  disabled, full, haptic = false, style, accessibilityLabel, testID,
}: ButtonProps) {
  const s = SIZES[size]
  const tint = variant === 'danger' ? C.red500 : variant === 'success' ? C.emerald400 : tone ?? C.brand500
  const fg = variant === 'brand' ? C.white : variant === 'ghost' ? ink(0.78) : tint
  const inactive = disabled || loading

  const content = (
    <View style={[styles.row, { paddingVertical: s.py, paddingHorizontal: s.px }]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : Icon ? (
        size === 'sm' ? (
          <Icon size={s.icon} color={fg} strokeWidth={2.2} />
        ) : (
          // Icon sits in its own small chip: reads as a deliberate control, not a label.
          <View
            style={[
              styles.chip,
              { width: s.icon + 12, height: s.icon + 12, borderRadius: (s.icon + 12) / 3 },
              variant === 'brand'
                ? styles.chipOnBrand
                : { backgroundColor: withAlpha(variant === 'ghost' ? C.brand500 : tint, 0.14), borderColor: withAlpha(variant === 'ghost' ? C.brand500 : tint, 0.22) },
            ]}
          >
            <Icon size={s.icon} color={variant === 'ghost' ? C.brand600 : fg} strokeWidth={2.3} />
          </View>
        )
      ) : null}
      <T
        numberOfLines={1}
        style={{ fontFamily: variant === 'ghost' ? F.semibold : F.bold, fontSize: s.font, lineHeight: s.font + 6, letterSpacing: 0.1, color: fg }}
      >
        {title}
      </T>
      {IconRight && !loading && <IconRight size={s.icon} color={fg} strokeWidth={2.2} />}
    </View>
  )

  return (
    <PressScale
      onPress={onPress}
      disabled={inactive}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
      style={[full && styles.full, inactive && styles.disabled, style]}
    >
      {variant === 'brand' ? (
        <LinearGradient
          colors={G.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.clip, { borderRadius: s.radius, boxShadow: inactive ? undefined : shadow.btnBrand }]}
        >
          {!inactive && <Sheen />}
          <View pointerEvents="none" style={[styles.highlight, { borderRadius: s.radius }]} />
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            { borderRadius: s.radius },
            variant === 'ghost'
              ? { backgroundColor: violet(0.06), borderColor: violet(0.16) }
              : { backgroundColor: withAlpha(tint, 0.12), borderColor: withAlpha(tint, 0.28) },
          ]}
        >
          {content}
        </View>
      )}
    </PressScale>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  base: { borderWidth: 1 },
  clip: { overflow: 'hidden' },
  full: { alignSelf: 'stretch' },
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginLeft: -4 },
  chipOnBrand: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.30)' },
  // 1px light edge along the top: the lit bevel of a physical key.
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  disabled: { opacity: 0.45 },
})
