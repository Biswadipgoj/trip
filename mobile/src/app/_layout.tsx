// Root layout: fonts, store hydration, splash screen, app-wide providers,
// toasts, connectivity + background upload engine, and the screen stack.
import { markAppMounted } from '../lib/crashGuard' // first: guards everything below
import '../lib/uploads' // registers the on-device image cleaner with the store
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Stack, router, type ErrorBoundaryProps } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold'
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium'
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold'
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold'
import { House, RotateCw, TriangleAlert } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { processUploads, recoverPendingPick } from '../lib/uploads'
import { startNetworkMonitor } from '../lib/sync'
import { ToastHost } from '../components/ui/Toast'
import { KeyboardRoot } from '../components/ui/KeyboardScroll'
import { Screen } from '../components/ui/Screen'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { T } from '../components/ui/Text'
import { C, brand600, ink, red } from '../theme/colors'

SplashScreen.preventAutoHideAsync().catch(() => {})

/** Never keep the splash up longer than this, even if storage is slow. */
const HYDRATION_TIMEOUT_MS = 3000

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  })
  const hydrated = useStore(s => s.hydrated)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    startNetworkMonitor()
    const t = setTimeout(() => setTimedOut(true), HYDRATION_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [])

  const ready = (fontsLoaded || !!fontError) && (hydrated || timedOut)

  useEffect(() => {
    if (!ready) return
    markAppMounted()
    SplashScreen.hideAsync().catch(() => {})
    try { void recoverPendingPick() } catch {}
    try { void processUploads() } catch {}
  }, [ready])

  if (!ready) return null // the native splash stays up

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardRoot>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: C.surface0 },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="create-trip" />
            <Stack.Screen name="join-trip" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="add-expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="payment-modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="viewer"
              options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
            />
            <Stack.Screen name="add-hotel" options={{ animation: 'none' }} />
            <Stack.Screen name="report" options={{ animation: 'none' }} />
          </Stack>
          <ToastHost />
        </KeyboardRoot>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/** Route-level crash screen: the app never shows a blank page. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Screen edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.errorWrap}>
            <GlassCard strong>
              <View style={styles.errorIcon}>
                <TriangleAlert size={26} color={C.red500} strokeWidth={2.2} />
              </View>
              <T variant="h2" center>Something went wrong</T>
              <T variant="body" color={ink(0.65)} center style={styles.errorText}>
                Your trip is saved. Try again, or go back to the home screen.
              </T>
              {/* Technical details are for developers only. */}
              {__DEV__ && (
                <T variant="small" color={ink(0.5)} center numberOfLines={4} style={styles.errorDetail}>
                  {error.message}
                </T>
              )}
              <View style={styles.errorActions}>
                <Button title="Try again" icon={RotateCw} onPress={() => void retry()} full />
                <Button title="Go to home" icon={House} variant="ghost" onPress={() => router.replace('/')} full />
              </View>
            </GlassCard>
          </ScrollView>
        </Screen>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface0 },
  errorWrap: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  errorIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: red(0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cloudIcon: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: brand600(0.12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stepBox: {
    marginVertical: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(108,62,200,0.12)',
    gap: 6,
  },
  errorText: { marginTop: 6 },
  errorDetail: { marginTop: 10 },
  errorActions: { gap: 10, marginTop: 20 },
})
