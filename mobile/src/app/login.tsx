// Login (web /login): mobile number → every trip that number belongs to
// (live first, newest first) → that trip's PIN. Device first, so trips on this
// phone open offline; the cloud finds trips joined on other devices. PINs are
// checked on the server and never downloaded. The card shakes on a miss.
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import Animated, {
  FadeInLeft, FadeInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ArrowRight, ChevronRight, Phone, Shield, Users } from 'lucide-react-native'
import { useStore } from '../lib/store'
import {
  describeError, isRemoteEnabled, remoteFetchTripBundle, remoteFindTripsByMobile, remoteVerifyMemberPin,
} from '../lib/remote'
import {
  LAST_MOBILE_KEY, isValidMobile, localTripChoices, mergeTripChoices, normalizeMobileInput, type TripChoice,
} from '../lib/tripLogin'
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
import { Collapsible, EASE_OUT, FadeIn, stagger } from '../components/animated/FadeInView'
import { tick } from '../components/animated/SpringPressable'
import { C, emerald, ink } from '../theme/colors'
import { F } from '../theme/typography'

type Step = 'mobile' | 'trips' | 'pin'
const STEPS: Step[] = ['mobile', 'trips', 'pin']

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LoginScreen() {
  const reduced = useReducedMotion()
  const trips = useStore(s => s.trips)
  const members = useStore(s => s.members)
  const setSession = useStore(s => s.setSession)
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)

  const [step, setStep] = useState<Step>('mobile')
  const [forward, setForward] = useState(true)
  const [mobile, setMobile] = useState('')
  const [choices, setChoices] = useState<TripChoice[]>([])
  const [selected, setSelected] = useState<TripChoice | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pinRef = useRef<TextInput>(null)
  const shake = useSharedValue(0)

  // Returning users: prefill the number they last logged in with.
  useEffect(() => {
    AsyncStorage.getItem(LAST_MOBILE_KEY)
      .then(last => { if (last && isValidMobile(last)) setMobile(m => m || last) })
      .catch(() => {})
  }, [])

  const liveCount = useMemo(() => choices.filter(c => c.status === 'active').length, [choices])
  const pastCount = choices.length - liveCount
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }))
  const enter = reduced ? undefined : (forward ? FadeInRight : FadeInLeft).duration(350).easing(EASE_OUT)

  const go = (next: Step) => {
    setForward(STEPS.indexOf(next) > STEPS.indexOf(step))
    setError('')
    setStep(next)
  }

  const fail = (message: string) => {
    setError(message)
    tick('error')
    if (!reduced) {
      shake.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 80 }),
        withTiming(-8, { duration: 80 }),
        withTiming(8, { duration: 80 }),
        withTiming(0, { duration: 60 }),
      )
    }
  }

  const findTrips = async () => {
    setError('')
    if (!isValidMobile(mobile)) {
      fail('Enter the 10-digit mobile number you joined the trip with.')
      return
    }
    setLoading(true)
    try {
      const local = localTripChoices(trips, members, mobile)
      let cloud: TripChoice[] = []
      let cloudError = ''
      if (isRemoteEnabled() && useSyncStatus.getState().online) {
        cloud = await remoteFindTripsByMobile(mobile).catch(err => {
          cloudError = describeError(err)
          return []
        })
      }
      const found = mergeTripChoices(local, cloud)
      if (found.length === 0) {
        fail(cloudError || (useSyncStatus.getState().online
          ? 'No trips found for this number. Join with a trip code or create a new trip.'
          : 'No trips for this number on this phone. Connect to the internet to find the rest.'))
        return
      }
      tick('light')
      setChoices(found)
      go('trips')
    } finally {
      setLoading(false)
    }
  }

  const chooseTrip = (choice: TripChoice) => {
    tick('light')
    setSelected(choice)
    setPin('')
    go('pin')
    setTimeout(() => pinRef.current?.focus(), 380)
  }

  const openTrip = async () => {
    if (!selected) return
    setError('')
    if (!/^\d{4}$/.test(pin)) {
      fail('Enter your 4-digit PIN for this trip.')
      return
    }
    setLoading(true)
    try {
      const localMember = members.find(m => m.id === selected.memberId)
      let ok = !!localMember?.pin && localMember.pin === pin
      if (!ok) {
        if (!isRemoteEnabled() || !useSyncStatus.getState().online) {
          fail(localMember ? 'That PIN doesn’t match this trip. Try again.' : 'Connect to the internet to check your PIN.')
          return
        }
        try {
          ok = await remoteVerifyMemberPin(selected.memberId, pin)
        } catch (err) {
          fail(describeError(err))
          return
        }
      }
      if (!ok) {
        fail('That PIN doesn’t match this trip. Try again.')
        return
      }

      // Pull the latest trip data; fine to continue offline if it's already on this phone.
      const onPhone = trips.some(t => t.id === selected.tripId)
      if (isRemoteEnabled() && useSyncStatus.getState().online) {
        const bundle = await remoteFetchTripBundle(selected.tripId).catch(() => null)
        if (bundle) mergeRemoteTrip(bundle)
        else if (!onPhone) {
          fail("Couldn't download this trip. Check your connection and try again.")
          return
        }
      } else if (!onPhone) {
        fail('Connect to the internet to download this trip.')
        return
      }

      AsyncStorage.setItem(LAST_MOBILE_KEY, mobile).catch(() => {})
      setSession({ tripId: selected.tripId, memberId: selected.memberId, tripCode: selected.tripCode })
      tick('success')
      toast.success(`Welcome back, ${selected.memberName.split(' ')[0]}!`)
      enterTrip()
    } finally {
      setLoading(false)
    }
  }

  const back = () => {
    if (step === 'pin') go('trips')
    else if (step === 'trips') go('mobile')
    else if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  return (
    <Screen>
      <KeyboardScroll contentContainerStyle={styles.scroll}>
        <BackLink onPress={back} />
        <FadeIn direction="down" style={styles.header}>
          <Logo size={68} />
          <T variant="h1" center style={styles.title}>Welcome back</T>
          <T variant="body" color={ink(0.65)} center>
            {step === 'mobile' ? 'Log in with your mobile number' : step === 'trips' ? 'Choose the trip to open' : 'Enter your PIN for this trip'}
          </T>
        </FadeIn>

        <Animated.View style={shakeStyle}>
          {step === 'mobile' && (
            <Animated.View key="mobile" entering={enter}>
              <GlassCard radius={24} padding={24} contentStyle={styles.card}>
                <Field
                  label="Mobile Number"
                  icon={Phone}
                  prefix="+91"
                  placeholder="98765 43210"
                  value={mobile}
                  onChangeText={v => setMobile(normalizeMobileInput(v))}
                  keyboardType="number-pad"
                  autoComplete="tel"
                  returnKeyType="go"
                  onSubmitEditing={() => void findTrips()}
                  hint="The number you used when you joined or created the trip."
                  style={styles.mobileInput}
                  testID="login-mobile"
                />
                <Collapsible open={!!error}>
                  <T variant="small" color={C.red500} center>{error}</T>
                </Collapsible>
                <Button title="Find my trips" iconRight={ArrowRight} loading={loading} onPress={() => void findTrips()} full testID="login-find-trips-btn" />
              </GlassCard>
            </Animated.View>
          )}

          {step === 'trips' && (
            <Animated.View key="trips" entering={enter} style={styles.stack}>
              <View style={styles.countRow}>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <T variant="smallSemibold" color={C.emerald500}>
                    {liveCount} live {liveCount === 1 ? 'trip' : 'trips'}
                  </T>
                </View>
                {pastCount > 0 && <T variant="small" color={ink(0.5)}>{pastCount} past</T>}
              </View>
              {choices.map((c, i) => (
                <FadeIn key={c.tripId} delay={stagger(i, 60, 70)}>
                  <GlassCard
                    padding={16}
                    radius={20}
                    onPress={() => chooseTrip(c)}
                    accessibilityLabel={`${c.name}, ${c.status === 'active' ? 'live' : 'closed'}, as ${c.memberName}`}
                    testID={`login-trip-${c.tripCode}`}
                  >
                    <View style={styles.tripRow}>
                      <View style={styles.flex}>
                        <View style={styles.nameRow}>
                          <T variant="title" numberOfLines={1} style={styles.shrink}>{c.name}</T>
                          <View style={[styles.badge, c.status === 'active' ? styles.badgeLive : styles.badgeClosed]}>
                            <T variant="tinySemibold" color={c.status === 'active' ? C.emerald500 : ink(0.55)}>
                              {c.status === 'active' ? 'Live' : 'Closed'}
                            </T>
                          </View>
                        </View>
                        <T variant="small" color={ink(0.55)} numberOfLines={1}>
                          {c.tripCode} · as {c.memberName}{c.createdAt ? ` · ${formatDate(c.createdAt)}` : ''}
                        </T>
                        <View style={styles.membersRow}>
                          <Users size={12} color={ink(0.5)} />
                          <T variant="small" color={ink(0.5)}>{c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}</T>
                        </View>
                      </View>
                      <ChevronRight size={18} color={ink(0.35)} />
                    </View>
                  </GlassCard>
                </FadeIn>
              ))}
              <T variant="small" color={ink(0.55)} center onPress={() => go('mobile')} suppressHighlighting style={styles.switch}>
                Not +91 {mobile}? Use a different number
              </T>
            </Animated.View>
          )}

          {step === 'pin' && selected && (
            <Animated.View key="pin" entering={enter}>
              <GlassCard radius={24} padding={24} contentStyle={styles.card}>
                <View style={styles.selected}>
                  <T variant="title" center>{selected.name}</T>
                  <T variant="small" color={ink(0.55)} center>{selected.tripCode} · as {selected.memberName}</T>
                </View>
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
                  onSubmitEditing={() => void openTrip()}
                  testID="login-pin"
                />
                <Collapsible open={!!error}>
                  <T variant="small" color={C.red500} center>{error}</T>
                </Collapsible>
                <Button title="Open trip" iconRight={ArrowRight} loading={loading} onPress={() => void openTrip()} full testID="login-submit-btn" />
              </GlassCard>
            </Animated.View>
          )}
        </Animated.View>

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
  stack: { gap: 10 },
  mobileInput: { fontFamily: F.display, fontSize: 19, letterSpacing: 1 },
  pinInput: { textAlign: 'center', fontSize: 24, letterSpacing: 12, fontFamily: F.display },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: emerald(0.12),
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.emerald400 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
  flex: { flex: 1, gap: 3 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeLive: { backgroundColor: emerald(0.14) },
  badgeClosed: { backgroundColor: ink(0.08) },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selected: { gap: 2, paddingVertical: 4 },
  switch: { marginTop: 6, paddingVertical: 8 },
  links: { gap: 8 },
})
