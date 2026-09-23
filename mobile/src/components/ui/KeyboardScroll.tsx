// Keyboard handling for forms. Development/production builds use
// react-native-keyboard-controller (smooth, keeps the focused input above the
// keyboard, works with Android edge-to-edge). Expo Go and the web preview
// don't ship that native module, so they fall back to plain RN components.
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

type AnyComponent = React.ComponentType<any>

let AwareScrollView: AnyComponent | null = null
let Provider: AnyComponent | null = null

if (Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  try {
    const kc = require('react-native-keyboard-controller')
    AwareScrollView = kc.KeyboardAwareScrollView
    Provider = kc.KeyboardProvider
  } catch {
    // Native module missing in this build — use the fallbacks.
  }
}

/** Wrap the app once (root layout). */
export function KeyboardRoot({ children }: { children: ReactNode }) {
  if (!Provider) return <>{children}</>
  return (
    <Provider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      {children}
    </Provider>
  )
}

interface KeyboardScrollProps extends ScrollViewProps {
  /** Gap kept between the focused input and the keyboard. */
  bottomOffset?: number
  children: ReactNode
}

export function KeyboardScroll({ bottomOffset = 28, children, ...rest }: KeyboardScrollProps) {
  if (AwareScrollView) {
    return (
      <AwareScrollView
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...rest}
      >
        {children}
      </AwareScrollView>
    )
  }
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} {...rest}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
