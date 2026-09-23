// Create a trip (web /create-trip): details → PIN → success with the trip
// code, a shareable join link and confetti.
import { useRef, useState } from 'react'
import { Share, StyleSheet, View, type TextInput } from 'react-native'
import Animated, { FadeInLeft, FadeInRight, useReducedMotion } from 'react-native-reanimated'
import * as Clipboard from 'expo-clipboard'
import {
  ArrowRight, Check, Copy, IndianRupee, Link2, Lock, Phone, Share2, Sparkles, Users,
} from 'lucide-react-native'
import type { Trip } from '../types'
import { useStore } from '../lib/store'
import { createInviteLink, createTripShareMessage } from '../lib/utils'
import { WEB_URL } from '../lib/config'
import { enterTrip } from '../lib/nav'
import { cloudCreateTrip, cloudMessage } from '../lib/cloud'
import { toast } from '../lib/toast'
import { Screen } from '../components/ui/Screen'
import { KeyboardScroll } from '../components/ui/KeyboardScroll'
import { GlassCard } from '../components/ui/GlassCard'
import { Field } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { GradientText, T } from '../components/ui/Text'
import { BackLink, SuccessCheck } from '../components/ui/PageHeader'
import { ProgressBar } from '../components/animated/ProgressRing'
import { Confetti } from '../components/animated/ConfettiBlast'
import { EASE_OUT, FadeIn } from '../components/animated/FadeInView'
import { tick } from '../components/animated/SpringPressable'
import { C, amber, ink, violet } from '../theme/colors'
import { F } from '../theme/typography'

type Step = 'details' | 'pin' | 'success'
const STEPS: Step[] = ['details', 'pin', 'success']

export default function CreateTripScreen() {
  const reduced = useReducedMotion()
  const setSession = useStore(s => s.setSession)
  const setTripBudget = useStore(s => s.setTripBudget)

  const [step, setStep] = useState<Step>('details')
  const [forward, setForward] = useState(true)
  const [tripName, setTripName] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [mobile, setMobile] = useState('')
  const [budget, setBudget] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [trip, setTrip] = useState<Trip | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [confetti, setConfetti] = useState(0)
  const [saving, setSaving] = useState(false)

  const nameRef = useRef<TextInput>(null)
  const mobileRef = useRef<TextInput>(null)
  const budgetRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const pinConfirmRef = useRef<TextInput>(null)

  const go = (next: Step) => {
    setForward(STEPS.indexOf(next) > STEPS.indexOf(step))
    setErrors({})
    setStep(next)
  }

  const validateDetails = () => {
    const errs: Record<string, string> = {}
    if (!tripName.trim()) errs.tripName = 'Trip name is required'
    if (!creatorName.trim()) errs.creatorName = 'Your name is required'
    if (!/^[6-9]\d{9}$/.test(mobile)) errs.mobile = 'Enter a valid 10-digit mobile number'
    if (password.length < 4) errs.password = 'Password must be at least 4 characters'
    setErrors(errs)
    if (Object.keys(errs).length > 0) tick('error')
    return Object.keys(errs).length === 0
  }

  const validatePin = () => {
    const errs: Record<string, string> = {}
    if (!/^\d{4}$/.test(pin)) errs.pin = 'PIN must be exactly 4 digits'
    if (pin !== pinConfirm) errs.pinConfirm = 'PINs do not match'
    setErrors(errs)
    if (Object.keys(errs).length > 0) tick('error')
    return Object.keys(errs).length === 0
  }

  // The trip exists only once Supabase has it — no phone-only trips.
  const handleCreate = async () => {
    if (saving || !validatePin()) return
    setSaving(true)
    try {
      const { trip: created, member } = await cloudCreateTrip(tripName, creatorName, mobile, password, pin)
      const budgetNum = parseFloat(budget)
      if (budgetNum > 0) setTripBudget(created.id, budgetNum)
      setTrip(created)
      setSession({ tripId: created.id, memberId: member.id, tripCode: created.tripCode })
      tick('success')
      go('success')
      setConfetti(n => n + 1)
    } catch (err) {
      setErrors({ general: cloudMessage(err) })
      tick('error')
    } finally {
      setSaving(false)
    }
  }

  // Invite link carries the trip (never the password) plus a signature, so it
  // works on any device; friends still need the password to join.
  const shareUrl = trip && WEB_URL ? createInviteLink(trip, WEB_URL) : ''

  const copy = async (what: 'code' | 'link') => {
    if (!trip) return
    await Clipboard.setStringAsync(what === 'code' ? trip.tripCode : shareUrl)
    tick('success')
    setCopied(what)
    setTimeout(() => setCopied(c => (c === what ? null : c)), 2000)
  }

  const share = async () => {
    if (!trip) return
    try {
      await Share.share({ message: createTripShareMessage(trip, shareUrl || undefined) })
    } catch {
      toast.error('Could not open the share sheet')
    }
  }

  const stepIndex = STEPS.indexOf(step)
  const enter = reduced ? undefined : (forward ? FadeInRight : FadeInLeft).duration(350).easing(EASE_OUT)

  return (
    <Screen>
      <KeyboardScroll contentContainerStyle={styles.scroll}>
        {step !== 'success' && (
          <>
            <BackLink />
            <View style={styles.progress}>
              {['Trip Details', 'Set PIN'].map((label, i) => (
                <View key={label} style={styles.flex}>
                  <ProgressBar pct={i <= stepIndex ? 100 : 0} height={4} delay={0} duration={500} trackColor={violet(0.16)} />
                  <T variant="tinySemibold" color={i <= stepIndex ? C.brand500 : ink(0.5)} style={styles.progressLabel}>
                    {label}
                  </T>
                </View>
              ))}
            </View>
          </>
        )}

        {step === 'details' && (
          <Animated.View key="details" entering={enter}>
            <GlassCard radius={24} padding={24} contentStyle={styles.card}>
              <View>
                <T variant="h1">Create a Trip</T>
                <T variant="body" color={ink(0.65)}>Set up your group trip and invite friends</T>
              </View>

              <Field
                label="Trip Name"
                icon={Sparkles}
                placeholder="e.g. Goa with the Squad"
                value={tripName}
                onChangeText={setTripName}
                maxLength={50}
                error={errors.tripName}
                returnKeyType="next"
                onSubmitEditing={() => nameRef.current?.focus()}
                submitBehavior="submit"
                testID="trip-name-input"
              />
              <Field
                ref={nameRef}
                label="Your Name"
                icon={Users}
                placeholder="e.g. Rahul"
                value={creatorName}
                onChangeText={setCreatorName}
                maxLength={40}
                autoCapitalize="words"
                error={errors.creatorName}
                returnKeyType="next"
                onSubmitEditing={() => mobileRef.current?.focus()}
                submitBehavior="submit"
              />
              <Field
                ref={mobileRef}
                label="Mobile Number"
                icon={Phone}
                placeholder="10-digit mobile"
                value={mobile}
                onChangeText={v => setMobile(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                error={errors.mobile}
                returnKeyType="next"
                onSubmitEditing={() => budgetRef.current?.focus()}
                submitBehavior="submit"
              />
              <Field
                ref={budgetRef}
                label="Trip Budget in ₹ (optional)"
                icon={IndianRupee}
                placeholder="e.g. 50000"
                value={budget}
                onChangeText={v => setBudget(v.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                submitBehavior="submit"
              />
              <Field
                ref={passwordRef}
                label="Trip Password (shared with friends)"
                icon={Lock}
                placeholder="Min 4 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                maxLength={30}
                autoCapitalize="none"
                error={errors.password}
                returnKeyType="done"
                onSubmitEditing={() => validateDetails() && go('pin')}
              />

              <Button title="Continue" iconRight={ArrowRight} onPress={() => validateDetails() && go('pin')} full testID="details-next-btn" />
            </GlassCard>
          </Animated.View>
        )}

        {step === 'pin' && (
          <Animated.View key="pin" entering={enter}>
            <GlassCard radius={24} padding={24} contentStyle={styles.card}>
              <View>
                <T variant="h1">Set Your PIN</T>
                <T variant="body" color={ink(0.65)}>Your personal 4-digit login PIN</T>
              </View>
              <Field
                label="4-Digit PIN"
                placeholder="••••"
                value={pin}
                onChangeText={v => {
                  const next = v.replace(/\D/g, '').slice(0, 4)
                  setPin(next)
                  if (next.length === 4) pinConfirmRef.current?.focus()
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={styles.pinInput}
                error={errors.pin}
                autoFocus
              />
              <Field
                ref={pinConfirmRef}
                label="Confirm PIN"
                placeholder="••••"
                value={pinConfirm}
                onChangeText={v => setPinConfirm(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={styles.pinInput}
                error={errors.pinConfirm}
                returnKeyType="done"
                onSubmitEditing={() => void handleCreate()}
              />
              {errors.general ? <T variant="small" color={C.red500} center>{errors.general}</T> : null}
              <View style={styles.row}>
                <Button title="Back" variant="ghost" onPress={() => go('details')} disabled={saving} style={styles.flex} />
                <Button
                  title={saving ? 'Creating…' : 'Create Trip'}
                  iconRight={saving ? undefined : ArrowRight}
                  loading={saving}
                  onPress={() => void handleCreate()}
                  style={styles.flex}
                  testID="create-trip-final-btn"
                />
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {step === 'success' && trip && (
          <View style={styles.success}>
            <SuccessCheck />
            <FadeIn delay={200}>
              <T variant="h1" center>Trip Created! 🎉</T>
              <T variant="body" color={ink(0.6)} center style={styles.successText}>
                Share this code with your friends to join
              </T>
            </FadeIn>

            <FadeIn delay={350}>
              <GlassCard contentStyle={styles.codeCard}>
                <T variant="label" color={ink(0.6)}>Your trip code</T>
                <GradientText center style={styles.code}>{trip.tripCode}</GradientText>
                <Button
                  title={copied === 'code' ? 'Copied!' : 'Copy Code'}
                  icon={copied === 'code' ? Check : Copy}
                  variant={copied === 'code' ? 'success' : 'ghost'}
                  size="sm"
                  onPress={() => void copy('code')}
                  testID="copy-trip-code-btn"
                />
              </GlassCard>
            </FadeIn>

            <FadeIn delay={420}>
              <GlassCard contentStyle={styles.shareCard}>
                <View style={styles.shareHeader}>
                  <Link2 size={14} color={ink(0.6)} />
                  <T variant="label" color={ink(0.6)}>
                    {shareUrl ? 'Share join link (works on any device)' : 'Invite your friends'}
                  </T>
                </View>
                {shareUrl ? (
                  <T variant="small" color={ink(0.5)} numberOfLines={2} style={styles.link}>{shareUrl}</T>
                ) : null}
                <View style={styles.row}>
                  <Button title="Share invite" icon={Share2} variant="soft" size="sm" onPress={() => void share()} style={styles.flex} />
                  {shareUrl ? (
                    <Button
                      title={copied === 'link' ? 'Link Copied!' : 'Copy Link'}
                      icon={copied === 'link' ? Check : Link2}
                      variant={copied === 'link' ? 'success' : 'soft'}
                      size="sm"
                      onPress={() => void copy('link')}
                      style={styles.flex}
                    />
                  ) : null}
                </View>
                <T variant="tiny" color={ink(0.55)}>
                  Friends just enter the trip password to join.{shareUrl ? ' Link valid for 30 days.' : ''}
                </T>
              </GlassCard>
            </FadeIn>

            <FadeIn delay={500}>
              <Button title="Go to Dashboard" iconRight={ArrowRight} size="lg" onPress={enterTrip} full testID="go-to-dashboard-btn" />
            </FadeIn>
          </View>
        )}
      </KeyboardScroll>
      <Confetti shot={confetti} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 18, flexGrow: 1 },
  progress: { flexDirection: 'row', gap: 10 },
  progressLabel: { marginTop: 6 },
  card: { gap: 16 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: amber(0.3),
    backgroundColor: amber(0.12),
    padding: 10,
  },
  pinInput: { textAlign: 'center', fontSize: 24, letterSpacing: 12, fontFamily: F.display },
  success: { flex: 1, justifyContent: 'center', gap: 16, paddingTop: 24 },
  successText: { marginTop: 6, marginBottom: 6 },
  codeCard: { alignItems: 'center', gap: 8 },
  code: { fontFamily: F.display, fontSize: 38, lineHeight: 46, letterSpacing: 4 },
  shareCard: { gap: 10 },
  shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontFamily: F.mono },
})
