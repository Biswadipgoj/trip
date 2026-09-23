// Glass text field — the web's .input-glass: white fill, violet hairline,
// brand focus ring. Errors shake the field once and show below it.
import { useEffect, useRef, useState, type Ref } from 'react'
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { C, ink, violet } from '../../theme/colors'
import { F } from '../../theme/typography'
import { T } from './Text'
import type { IconType } from './Button'

export interface FieldProps extends TextInputProps {
  label?: string
  icon?: IconType
  error?: string | null
  hint?: string
  prefix?: string
  suffix?: string
  /** Monospace (trip codes, UPI ids). */
  mono?: boolean
  /** Large bold amount input (web: text-xl font-bold). */
  big?: boolean
  dense?: boolean
  containerStyle?: StyleProp<ViewStyle>
  ref?: Ref<TextInput>
}

export function Field({
  label, icon: Icon, error, hint, prefix, suffix, mono, big, dense, containerStyle, style,
  onFocus, onBlur, ref, editable = true, ...rest
}: FieldProps) {
  const [focused, setFocused] = useState(false)
  const reduced = useReducedMotion()
  const shake = useSharedValue(0)
  const lastError = useRef<string | null | undefined>(null)

  useEffect(() => {
    if (error && error !== lastError.current && !reduced) {
      shake.value = withSequence(
        withTiming(-7, { duration: 45 }),
        withTiming(7, { duration: 60 }),
        withTiming(-4, { duration: 55 }),
        withTiming(4, { duration: 55 }),
        withTiming(0, { duration: 45 })
      )
    }
    lastError.current = error
  }, [error, reduced, shake])

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }))

  return (
    <View style={containerStyle}>
      {label ? (
        <View style={styles.labelRow}>
          {Icon && <Icon size={13} color={ink(0.6)} strokeWidth={2.2} />}
          <T variant="smallMedium" color={ink(0.6)}>{label}</T>
        </View>
      ) : null}
      <Animated.View
        style={[
          styles.box,
          dense && styles.dense,
          focused && styles.focused,
          !!error && styles.errorBox,
          !editable && styles.readonly,
          shakeStyle,
        ]}
      >
        {prefix ? <T variant="bodyMedium" color={ink(0.5)} style={styles.affix}>{prefix}</T> : null}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={ink(0.35)}
          selectionColor={violet(0.35)}
          cursorColor={C.brand500}
          maxFontSizeMultiplier={1.3}
          {...rest}
          onFocus={e => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={e => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[styles.input, dense && styles.inputDense, mono && styles.mono, big && styles.big, style]}
        />
        {suffix ? <T variant="bodyMedium" color={ink(0.5)} style={styles.affix}>{suffix}</T> : null}
      </Animated.View>
      {error ? (
        <T variant="small" color={C.red500} style={styles.message}>{error}</T>
      ) : hint ? (
        <T variant="small" color={ink(0.55)} style={styles.message}>{hint}</T>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: violet(0.18),
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
  },
  dense: { paddingHorizontal: 10, borderRadius: 10 },
  focused: {
    borderColor: C.brand500,
    backgroundColor: C.white,
    boxShadow: '0px 0px 0px 3px rgba(139, 78, 245, 0.18)',
  },
  errorBox: { borderColor: 'rgba(239, 68, 68, 0.55)' },
  readonly: { backgroundColor: 'rgba(255,255,255,0.6)' },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontFamily: F.regular,
    fontSize: 14,
    color: C.ink,
  },
  inputDense: { paddingVertical: 8, fontSize: 13 },
  mono: { fontFamily: F.mono, letterSpacing: 0.5 },
  big: { fontFamily: F.display, fontSize: 22, paddingVertical: 10 },
  affix: { marginHorizontal: 2 },
  message: { marginTop: 5 },
})
