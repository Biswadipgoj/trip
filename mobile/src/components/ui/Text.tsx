// Text primitives: T (the app's type scale, ink by default) and GradientText
// (the web's .text-gradient-brand — a linear gradient masked by the glyphs).
import type { ReactNode } from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { C, G } from '../../theme/colors'
import { TYPE, type TypeVariant } from '../../theme/typography'

export interface TProps extends TextProps {
  variant?: TypeVariant
  color?: string
  center?: boolean
}

// Large system font sizes are honoured, but capped so layouts don't break.
const MAX_FONT_SCALE = 1.35

export function T({ variant = 'body', color = C.ink, center, style, ...rest }: TProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[TYPE[variant], { color }, center && styles.center, style]}
    />
  )
}

interface GradientTextProps extends Omit<TProps, 'color'> {
  colors?: readonly [string, string, ...string[]]
  children: ReactNode
  /** Layout of the masked box (defaults to hugging the text). */
  containerStyle?: StyleProp<ViewStyle>
}

export function GradientText({ colors = G.brandText, children, style, variant, center, containerStyle, ...rest }: GradientTextProps) {
  // Masking isn't available in the browser preview — fall back to solid brand.
  if (Platform.OS === 'web') {
    return (
      <T variant={variant} color={colors[0]} center={center} style={style} {...rest}>
        {children}
      </T>
    )
  }
  return (
    <View style={[center ? styles.selfCenter : styles.selfStart, containerStyle]}>
      <MaskedView
        maskElement={
          <T variant={variant} center={center} style={style} {...rest}>
            {children}
          </T>
        }
      >
        <LinearGradient colors={colors} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }}>
          <T variant={variant} center={center} style={[style, styles.invisible]} {...rest}>
            {children}
          </T>
        </LinearGradient>
      </MaskedView>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  invisible: { opacity: 0 },
  selfStart: { alignSelf: 'flex-start' },
  selfCenter: { alignSelf: 'center' },
})
