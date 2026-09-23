// Login (web /login): trip code + mobile + PIN. Local-first, then the cloud,
// so members can sign in on a brand-new phone. The card shakes on a miss.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, type TextInput } from 'react-native'
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowRight, Hash, Phone, Shield } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { describeError, isRemoteEnabled, remoteFetchTripBundle, remoteFindTripByCode, remoteGetMembers } from '../lib/remote'
import { useSyncStatus } from '../lib/synclog'
import { enterTrip } from '../lib/nav'
import { toast } from '../lib/toast'
import { Screen } from '../components/ui/Screen'
import { KeyboardScroll } from '../components/ui/KeyboardScroll'
import { GlassCard } from '../components/ui/GlassCard'
import { Field } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { T } from '../components/ui/Text'
import { BackLink } from '../components/ui/PageHeader'
import { Collapsible, FadeIn } from '../components/animated/FadeInView'
import { tick } from '../components/animated/SpringPressable'
import { C, ink } from '../theme/colors'
import { F } from '../theme/typography'

export default function LoginScreen() {
  const reduced = useReducedMotion()
  const params = useLocalSearchParams<{ code?: string }>()
  const login = useStore(s => s.login)
  const setSession = useStore(s => s.setSession)
  const getTripByCode = useStore(s => s.getTripByCode)
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)
  const members = useStore(s => s.members)

  const [tripCode, setTripCode] = useState(params.code ? String(params.code).toUpperCase().slice(0, 8) : '')
  const [mobile, setMobile] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const mobileRef = useRef<TextInput>(null)
  const pinRef = useRef<TextInput>(null)
  const shake = useSharedValue(0)

  useEffect(() => {
    if (params.code) setTripCode(String(params.code).toUpperCase().slice(0, 8))
  }, [params.code])

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }))

  const fail = (message: string) => {
    setError(message)
    tick('error')
    if (!reduced) {
      shake.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 80 }),
        withTiming(-8, { duration: 80 }),
        withTiming(8, { duration: 80 }),
        withTiming(0, { duration: 60 })
      )
    }
  }

  const welcome = (memberId: string) => {
    const name = useStore.getState().members.find(m => m.id === memberId)?.name
    tick('success')
    if (name) toast.success(`Welcome back, ${name.split(' ')[0]}!`)
    enterTrip()
  }

  const handleLogin = async () => {
    setError('')
    const code = tripCode.trim().toUpperCase()
    if (!code || mobile.length !== 10 || pin.length !== 4) {
      fail('Enter your trip code, 10-digit mobile number and 4-digit PIN.')
      return
    }
    setLoading(true)
    try {
      // Cloud-only: credentials are checked against Supabase and the whole trip
      // is loaded from it, so every phone sees the same, current data.
      if (isRemoteEnabled()) {
        if (!useSyncStatus.getState().online) {
          fail("You're offline. Connect to the internet to log in.")
          return
        }
        let remoteTrip: Awaited<ReturnType<typeof remoteFindTripByCode>> = null
        try {
          remoteTrip = await remoteFindTripByCode(code)
        } catch (err) {
          fail(describeError(err))
          return
        }
        const remoteMember = remoteTrip
          ? (await remoteGetMembers(remoteTrip.id)).find(m => m.mobile === mobile.trim() && m.pin === pin)
          : undefined
        if (!remoteTrip || !remoteMember) {
          fail('Invalid trip code, mobile, or PIN. Please check and try again.')
          return
        }
        const bundle = await remoteFetchTripBundle(remoteTrip.id)
        if (!bundle) {
          fail("Couldn't load the trip from the cloud. Please try again.")
          return
        }
        mergeRemoteTrip(bundle)
        setSession({ tripId: remoteTrip.id, memberId: remoteMember.id, tripCode: remoteTrip.tripCode })
        welcome(remoteMember.id)
        return
      }

      // Developer preview without the cloud: this phone's data only.
      const member = login(code, mobile.trim(), pin)
      const trip = member ? getTripByCode(code) : undefined
      if (member && trip) {
        setSession({ tripId: trip.id, memberId: member.id, tripCode: trip.tripCode })
        welcome(member.id)
        return
      }
      fail('Invalid trip code, mobile, or PIN. Please check and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Name hint when the code belongs to a trip on this phone.
  const localTrip = tripCode.length === 8 ? getTripByCode(tripCode) : undefined
  const localPeople = localTrip ? members.filter(m => m.tripId === localTrip.id && m.mobile).length : 0

  return (
    <Screen>
      <KeyboardScroll contentContainerStyle={styles.scroll}>
        <BackLink />
        <FadeIn direction="down" style={styles.header}>
          <Logo size={68} />
          <T variant="h1" center style={styles.title}>Welcome back</T>
          <T variant="body" color={ink(0.65)} center>Login to your trip</T>
        </FadeIn>

        <FadeIn delay={120}>
          <Animated.View style={shakeStyle}>
            <GlassCard radius={24} padding={24} contentStyle={styles.card}>
              <Field
                label="Trip Code"
                icon={Hash}
                placeholder="TRP-XXXX"
                value={tripCode}
                onChangeText={v => setTripCode(v.toUpperCase().slice(0, 8))}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.codeInput}
                hint={localTrip ? `${localTrip.name} · ${localPeople} member${localPeople !== 1 ? 's' : ''}` : undefined}
                returnKeyType="next"
                onSubmitEditing={() => mobileRef.current?.focus()}
                submitBehavior="submit"
                testID="login-trip-code"
              />
              <Field
                ref={mobileRef}
                label="Mobile Number"
                icon={Phone}
                placeholder="10-digit number"
                value={mobile}
                onChangeText={v => {
                  const next = v.replace(/\D/g, '').slice(0, 10)
                  setMobile(next)
                  if (next.length === 10) pinRef.current?.focus()
                }}
                keyboardType="number-pad"
                autoComplete="tel"
                returnKeyType="next"
                onSubmitEditing={() => pinRef.current?.focus()}
                submitBehavior="submit"
                testID="login-mobile"
              />
              <Field
                ref={pinRef}
                label="4-Digit PIN"
                icon={Shield}
                placeholder="••••"
                value={pin}
                onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={styles.pinInput}
                returnKeyType="go"
                onSubmitEditing={() => void handleLogin()}
                testID="login-pin"
              />
              <Collapsible open={!!error}>
                <T variant="small" color={C.red500} center>{error}</T>
              </Collapsible>
              <Button title="Login" iconRight={ArrowRight} loading={loading} onPress={() => void handleLogin()} full testID="login-submit-btn" />
            </GlassCard>
          </Animated.View>
        </FadeIn>

        <FadeIn delay={400} direction="none" style={styles.links}>
          <T variant="body" color={ink(0.6)} center>
            New trip?{' '}
            <T variant="bodyMedium" color={C.brand500} onPress={() => router.push('/create-trip')} suppressHighlighting>
              Create one
            </T>
          </T>
          <T variant="body" color={ink(0.6)} center>
            Have a code?{' '}
            <T variant="bodyMedium" color={C.brand500} onPress={() => router.push('/join-trip')} suppressHighlighting>
              Join a trip
            </T>
          </T>
        </FadeIn>
      </KeyboardScroll>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 20, flexGrow: 1 },
  header: { alignItems: 'center', marginTop: 8 },
  title: { marginTop: 16 },
  card: { gap: 16 },
  codeInput: { textAlign: 'center', fontFamily: F.display, fontSize: 19, letterSpacing: 3 },
  pinInput: { textAlign: 'center', fontSize: 24, letterSpacing: 12, fontFamily: F.display },
  links: { gap: 8 },
})
