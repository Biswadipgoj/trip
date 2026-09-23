// Selection controls from the web forms:
//  • SelectPill — the tappable option box (categories, payer, participants,
//    split type, room occupants). Selected: brand-600/30 fill + brand-500/50
//    border; idle: ink/5 fill + ink/10 border. Colours cross-fade.
//  • Checkbox — the small square check used in "Who's sharing this?".
//  • Chip — a static tinted label (subcategory tags, "Admin", "You").
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { Check } from 'lucide-react-native'
import { C, brand500, brand600, ink } from '../../theme/colors'
import { withAlpha } from '../../lib/color'
import { PressScale } from '../animated/SpringPressable'
import { T } from './Text'
import type { IconType } from './Button'

interface SelectPillProps {
  selected: boolean
  onPress: () => void
  children: ReactNode
  disabled?: boolean
  /** 'box' = rounded-xl option, 'pill' = fully rounded chip. */
  shape?: 'box' | 'pill'
  dense?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

const FADE = {
  transitionProperty: ['backgroundColor', 'borderColor'] as ('backgroundColor' | 'borderColor')[],
  transitionDuration: 180,
  transitionTimingFunction: 'ease-out' as const,
}

export function SelectPill({ selected, onPress, children, disabled, shape = 'box', dense, style, accessibilityLabel }: SelectPillProps) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      scaleTo={0.95}
      style={[style, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.pill,
          shape === 'pill' ? styles.round : styles.box,
          dense && styles.dense,
          selected ? styles.on : styles.off,
          FADE,
        ]}
      >
        {children}
      </Animated.View>
    </PressScale>
  )
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <Animated.View style={[styles.check, checked ? styles.checkOn : styles.checkOff, FADE]}>
      {checked && <Check size={11} color={C.white} strokeWidth={3} />}
    </Animated.View>
  )
}

interface ChipProps {
  label: string
  color?: string
  icon?: IconType
  style?: StyleProp<ViewStyle>
}

export function Chip({ label, color = C.brand500, icon: Icon, style }: ChipProps) {
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.25) }, style]}>
      {Icon && <Icon size={10} color={color} strokeWidth={2.4} />}
      <T variant="tinySemibold" color={color} numberOfLines={1}>{label}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  box: { borderRadius: 12 },
  round: { borderRadius: 999, paddingVertical: 7 },
  dense: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  on: { backgroundColor: brand600(0.22), borderColor: brand500(0.5) },
  off: { backgroundColor: ink(0.04), borderColor: ink(0.1) },
  disabled: { opacity: 0.32 },
  check: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  checkOn: { backgroundColor: C.brand500, borderColor: C.brand500 },
  checkOff: { backgroundColor: 'transparent', borderColor: ink(0.3) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
})
