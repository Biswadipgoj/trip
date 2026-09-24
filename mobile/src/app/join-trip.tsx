// Join a trip (web /join-trip): find & verify → your details → PIN → success.
// Joining NEVER creates a trip — it attaches a member to the existing one.
// Accepts ?invite= (signed link), ?code= and legacy ?d= params, and pasted
// invite links or codes.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import Animated, { FadeInLeft, FadeInRight, useReducedMotion } from 'react-native-reanimated'
import { useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { ArrowRight, Check, ClipboardPaste, Link2, Lock, Phone, Search, TriangleAlert, Users } from 'lucide-react-native'
import type { InvitePayload, Trip } from '../types'
import { useStore } from '../lib/store'
import {
  isRemoteEnabled, joinLog, remoteEnsureTrip, remoteFetchTripBundle, remoteFindTripByCode,
  remoteGetMembers, remoteJoinTrip, describeError,
} from '../lib/remote'
import { extractJoinInput, getAvatarColor, inviteSignature, parseInviteToken } from '../lib/utils'
import { enterTrip } from '../lib/nav'
import { toast } from '../lib/toast'
import { Screen } from '../components/ui/Screen'
import { KeyboardScroll } from '../components/ui/KeyboardScroll'
import { GlassCard } from '../components/ui/GlassCard'
import { Field } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { T } from '../components/ui/Text'
import { BackLink, SuccessCheck } from '../components/ui/PageHeader'
import { Confetti } from '../components/animated/ConfettiBlast'
import { EASE_OUT, FadeIn } from '../components/animated/FadeInView'
import { PressScale, tick } from '../components/animated/SpringPressable'
import { C, amber, emerald, ink, red } from '../theme/colors'
import { F } from '../theme/typography'

type Step = 'find' | 'join' | 'pin' | 'success'
const STEPS: Step[] = ['find', 'join', 'pin', 'success']

const INVITE_ERROR = {
  expired: 'This invite link has expired. Ask the trip creator for a new invite.',
  invalid: 'Invalid or expired invite link. Try requesting a new invite from the trip creator.',
}

/** Legacy ?d= links carried a base64 trip object. */
function decodeLegacyTrip(encoded: string): Trip | null {
  try {
    const decode = (globalThis as { atob?: (s: string) => string }).atob
    if (!decode) return null
    const trip = JSON.parse(decode(encoded.trim().replace(/\s/g, '+'))) as Trip
    return trip?.tripCode && trip?.id ? trip : null
  } catch {
    return null
  }
}

export default function JoinTripScreen() {
  const reduced = useReducedMotion()
  const params = useLocalSearchParams<{ invite?: string; code?: string; d?: string }>()
  const getTripByCode = useStore(s => s.getTripByCode)
  const joinTrip = useStore(s => s.joinTrip)
  const setSession = useStore(s => s.setSession)
  const importTrip = useStore(s => s.importTrip)
  const upsertMember = useStore(s => s.upsertMember)
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)
  const getMembersByTrip = useStore(s => s.getMembersByTrip)

  const [step, setStep] = useState<Step>('find')
  const [forward, setForward] = useState(true)
  const [tripCode, setTripCode] = useState('')
  const [tripPassword, setTripPassword] = useState('')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [foundTrip, setFoundTrip] = useState<Trip | null>(null)
  const [foundViaRemote, setFoundViaRemote] = useState(false)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [invite, setInvite] = useState<InvitePayload | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [importedFromLink, setImportedFromLink] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confetti, setConfetti] = useState(0)

  const passwordRef = useRef<TextInput>(null)
  const mobileRef = useRef<TextInput>(null)
  const pinConfirmRef = useRef<TextInput>(null)

  const go = (next: Step) => {
    setForward(STEPS.indexOf(next) > STEPS.indexOf(step))
    setStep(next)
  }

  const applyInvite = (token: string) => {
    const result = parseInviteToken(token)
    if (result.ok) {
      setInvite(result.payload)
      setTripCode(result.payload.trip.tripCode.toUpperCase())
      setImportedFromLink(true)
      setInviteError(null)
      joinLog('invite.parsed', { tripCode: result.payload.trip.tripCode, tripId: result.payload.trip.id })
    } else {
      joinLog('invite.invalid', { reason: result.reason })
      setInviteError(INVITE_ERROR[result.reason])
    }
  }

  // Deep links: ?invite= (newest), ?code=, legacy ?d=.
  useEffect(() => {
    if (params.invite) {
      applyInvite(String(params.invite))
      return
    }
    if (params.code) {
      setTripCode(String(params.code).trim().toUpperCase().slice(0, 8))
      setImportedFromLink(true)
      return
    }
    if (params.d) {
      const trip = decodeLegacyTrip(String(params.d))
      if (trip) {
        importTrip(trip)
        setTripCode(trip.tripCode.toUpperCase())
        setImportedFromLink(true)
      } else {
        setInviteError(INVITE_ERROR.invalid)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.invite, params.code, params.d])

  /** A pasted invite link or code, from the field or the clipboard. */
  const applyPasted = (raw: string) => {
    const { invite: token, code } = extractJoinInput(raw)
    if (token) applyInvite(token)
    else if (code) {
      setTripCode(code.slice(0, 8))
      setInviteError(null)
    }
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text.trim()) {
        toast.info('Clipboard is empty — copy the invite link or trip code first')
        return
      }
      tick('selection')
      applyPasted(text)
    } catch {
      toast.error('Could not read the clipboard')
    }
  }

  // ── Step 1: verify the trip EXISTS, then validate the password ─────────────
  const handleFind = async () => {
    const code = tripCode.trim().toUpperCase()
    const password = tripPassword
    if (!code) {
      setErrors({ tripCode: 'Enter the trip code' })
      tick('error')
      return
    }
    setBusy(true)
    setErrors({})
    joinLog('find.start', { tripCode: code, viaInvite: !!invite, remote: isRemoteEnabled() })

    try {
      // 1. Cloud (preferred): the one shared trip lives on the server.
      if (isRemoteEnabled()) {
        let remoteTrip: Trip | null = null
        try {
          remoteTrip = await remoteFindTripByCode(code)
        } catch (err) {
          setErrors({ general: describeError(err) })
          tick('error')
          return
        }
        if (remoteTrip) {
          if (remoteTrip.password !== password) {
            joinLog('find.wrongPassword', { tripCode: code })
            setErrors({ tripPassword: 'Wrong trip password. Ask the trip creator for the correct one.' })
            tick('error')
            return
          }
          const existingMembers = await remoteGetMembers(remoteTrip.id)
          importTrip(remoteTrip) // upsert by code — never duplicates
          setFoundTrip(remoteTrip)
          setFoundViaRemote(true)
          setMemberCount(existingMembers.length)
          joinLog('find.verified', { tripId: remoteTrip.id, tripCode: code, members: existingMembers.length })
          tick('success')
          go('join')
          return
        }
        // Not on the server → invite-link / local paths (trips from before cloud sync).
      }

      // 2. Invite link: verify the password against the link's signature.
      if (invite && invite.trip.tripCode.toUpperCase() === code) {
        if (inviteSignature(code, password) !== invite.sig) {
          joinLog('find.wrongPassword', { tripCode: code, via: 'invite' })
          setErrors({ tripPassword: 'Wrong trip password. Ask the trip creator for the correct one.' })
          tick('error')
          return
        }
        const inviteTrip: Trip = { ...invite.trip, password }
        importTrip(inviteTrip)
        setFoundTrip(inviteTrip)
        setFoundViaRemote(false)
        setMemberCount(null)
        joinLog('find.verified', { tripId: inviteTrip.id, tripCode: code, via: 'invite' })
        tick('success')
        go('join')
        return
      }

      // 3. Local: the trip already exists on this phone.
      const trip = getTripByCode(code)
      if (!trip) {
        joinLog('find.notFound', { tripCode: code })
        setErrors({
          tripCode: invite
            ? 'This code doesn’t match your invite link. Use the code from the link or ask for a new invite.'
            : 'This trip doesn’t exist. Double-check the code, or ask your friend for an invite link.',
        })
        tick('error')
        return
      }
      if (trip.password !== password) {
        joinLog('find.wrongPassword', { tripCode: code, via: 'local' })
        setErrors({ tripPassword: 'Wrong trip password.' })
        tick('error')
        return
      }
      setFoundTrip(trip)
      setFoundViaRemote(false)
      setMemberCount(getMembersByTrip(trip.id).length)
      joinLog('find.verified', { tripId: trip.id, tripCode: code, via: 'local' })
      tick('success')
      go('join')
    } finally {
      setBusy(false)
    }
  }

  const handleJoinDetails = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!/^[6-9]\d{9}$/.test(mobile)) errs.mobile = 'Enter a valid 10-digit mobile'
    setErrors(errs)
    if (Object.keys(errs).length === 0) go('pin')
    else tick('error')
  }

  // ── Final step: attach the member to the EXISTING trip ────────────────────
  const handleJoin = async () => {
    const errs: Record<string, string> = {}
    if (!/^\d{4}$/.test(pin)) errs.pin = 'PIN must be 4 digits'
    if (pin !== pinConfirm) errs.pinConfirm = 'PINs do not match'
    setErrors(errs)
    if (Object.keys(errs).length > 0 || !foundTrip) {
      tick('error')
      return
    }

    setBusy(true)
    try {
      if (isRemoteEnabled()) {
        // Provision the SAME trip row (same id + code) when it was verified via
        // an invite or locally but isn't on the server yet.
        const remoteReady = foundViaRemote || (await remoteEnsureTrip(foundTrip))
        if (!remoteReady) {
          joinLog('join.remoteUnavailable', { tripId: foundTrip.id })
          setErrors({
            general:
              'Could not attach you to the shared trip on the server. Check your internet connection and try again — joining offline would create a disconnected copy.',
          })
          tick('error')
          return
        }
        const { member, alreadyMember: existed } = await remoteJoinTrip(foundTrip, {
          name: name.trim(), mobile, pin, avatarColor: getAvatarColor(memberCount ?? 0),
        })
        // Pull the whole existing trip so the dashboard shows real data.
        const bundle = await remoteFetchTripBundle(foundTrip.id)
        if (bundle) mergeRemoteTrip(bundle)
        else upsertMember(member)

        setAlreadyMember(existed)
        setSession({ tripId: foundTrip.id, memberId: member.id, tripCode: foundTrip.tripCode })
        joinLog('join.success', { tripId: foundTrip.id, memberId: member.id, alreadyMember: existed })
        tick('success')
        go('success')
        setConfetti(n => n + 1)
        return
      }

      // Local-only build: duplicate-safe by mobile number.
      const member = joinTrip(foundTrip.tripCode, foundTrip.password, name.trim(), mobile, pin)
      if (!member) {
        joinLog('join.localFailed', { tripId: foundTrip.id })
        setErrors({ general: 'Could not join trip. Try again or request a new invite link.' })
        tick('error')
        return
      }
      setSession({ tripId: foundTrip.id, memberId: member.id, tripCode: foundTrip.tripCode })
      joinLog('join.success', { tripId: foundTrip.id, memberId: member.id, via: 'local' })
      tick('success')
      go('success')
      setConfetti(n => n + 1)
    } catch (err) {
      setErrors({ general: describeError(err) })
      tick('error')
    } finally {
      setBusy(false)
    }
  }

  const enter = reduced ? undefined : (forward ? FadeInRight : FadeInLeft).duration(350).easing(EASE_OUT)

  return (
    <Screen>
      <KeyboardScroll contentContainerStyle={styles.scroll}>
        {step !== 'success' && <BackLink />}

        {step === 'find' && (
          <Animated.View key="find" entering={enter}>
            <GlassCard radius={24} padding={24} contentStyle={styles.card}>
              <View>
                <T variant="h1">Join a Trip</T>
                <T variant="body" color={ink(0.65)}>
                  {invite ? 'You’ve been invited — confirm to join' : 'Enter the trip code shared by your friend'}
                </T>
              </View>

              {inviteError && (
                <Notice tone="red" icon>{inviteError}</Notice>
              )}
              {!isRemoteEnabled() && (
                <Notice tone="amber" icon>
                  Make sure you're connected to the internet to join trips created on other devices.
                </Notice>
              )}
              {invite && (
                <View style={styles.inviteCard}>
                  <View style={styles.inline}>
                    <Link2 size={14} color={C.emerald400} />
                    <T variant="smallSemibold" color={C.emerald400}>Invite found</T>
                  </View>
                  <T variant="h3">{invite.trip.name}</T>
                  <T variant="small" color={ink(0.6)}>Enter the trip password to confirm joining</T>
                </View>
              )}
              {importedFromLink && !invite && !inviteError && (
                <Notice tone="emerald">Trip found via link — just enter the password to join</Notice>
              )}

              <View>
                <Field
                  label="Trip Code"
                  icon={Search}
                  placeholder="TRP-XXXX"
                  value={tripCode}
                  onChangeText={v => {
                    // A pasted link or long text: pull the code / invite out of it.
                    if (v.length > 9 || /[/=]/.test(v)) applyPasted(v)
                    else setTripCode(v.toUpperCase().slice(0, 8))
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.codeInput}
                  error={errors.tripCode}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
                  testID="join-trip-code-input"
                />
                <PressScale onPress={() => void pasteFromClipboard()} style={styles.paste} haptic={false} accessibilityRole="button" accessibilityLabel="Paste invite link or code">
                  <ClipboardPaste size={14} color={C.brand500} />
                  <T variant="smallSemibold" color={C.brand500}>Paste invite link or code</T>
                </PressScale>
              </View>

              <Field
                ref={passwordRef}
                label="Trip Password"
                icon={Lock}
                placeholder="Ask the trip creator"
                value={tripPassword}
                onChangeText={setTripPassword}
                secureTextEntry
                autoCapitalize="none"
                error={errors.tripPassword}
                returnKeyType="go"
                onSubmitEditing={() => void handleFind()}
                testID="join-password-input"
              />
              {errors.general ? <T variant="small" color={C.red500}>{errors.general}</T> : null}

              <Button
                title={busy ? 'Verifying trip…' : invite ? 'Confirm & Continue' : 'Find Trip'}
                iconRight={invite ? ArrowRight : Search}
                loading={busy}
                onPress={() => void handleFind()}
                full
                testID="find-trip-btn"
              />
            </GlassCard>
          </Animated.View>
        )}

        {step === 'join' && foundTrip && (
          <Animated.View key="join" entering={enter} style={styles.stack}>
            <GlassCard padding={16}>
              <View style={styles.inline}>
                <View style={styles.verified}>
                  <Check size={20} color={C.emerald400} strokeWidth={2.6} />
                </View>
                <View style={styles.flex}>
                  <T variant="small" color={ink(0.6)}>Existing trip verified</T>
                  <T variant="title" numberOfLines={1}>{foundTrip.name}</T>
                  {memberCount !== null && memberCount > 0 && (
                    <T variant="small" color={ink(0.6)}>{memberCount} member{memberCount !== 1 ? 's' : ''} already in</T>
                  )}
                </View>
              </View>
            </GlassCard>

            <GlassCard radius={24} padding={24} contentStyle={styles.card}>
              <View>
                <T variant="h2">Your Details</T>
                <T variant="body" color={ink(0.65)}>How should your friends identify you?</T>
              </View>
              <Field
                label="Your Name"
                icon={Users}
                placeholder="Your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={40}
                error={errors.name}
                returnKeyType="next"
                onSubmitEditing={() => mobileRef.current?.focus()}
                submitBehavior="submit"
                autoFocus
              />
              <Field
                ref={mobileRef}
                label="Mobile Number"
                icon={Phone}
                placeholder="10-digit mobile"
                value={mobile}
                onChangeText={v => setMobile(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                autoComplete="tel"
                error={errors.mobile}
                returnKeyType="done"
                onSubmitEditing={handleJoinDetails}
              />
              <View style={styles.row}>
                <Button title="Back" variant="ghost" onPress={() => go('find')} style={styles.flex} />
                <Button title="Continue" iconRight={ArrowRight} onPress={handleJoinDetails} style={styles.flex} />
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {step === 'pin' && (
          <Animated.View key="pin" entering={enter}>
            <GlassCard radius={24} padding={24} contentStyle={styles.card}>
              <View>
                <T variant="h1">Set Your PIN</T>
                <T variant="body" color={ink(0.65)}>You'll use this to log in</T>
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
                onSubmitEditing={() => void handleJoin()}
              />
              {errors.general ? <T variant="small" color={C.red500} center>{errors.general}</T> : null}
              <View style={styles.row}>
                <Button title="Back" variant="ghost" onPress={() => go('join')} style={styles.flex} />
                <Button
                  title={busy ? 'Joining…' : 'Join Trip'}
                  icon={busy ? undefined : Check}
                  loading={busy}
                  onPress={() => void handleJoin()}
                  style={styles.flex}
                  testID="join-final-btn"
                />
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {step === 'success' && foundTrip && (
          <View style={styles.success}>
            <SuccessCheck />
            <FadeIn delay={200}>
              <T variant="h1" center>{alreadyMember ? 'Welcome back! 👋' : "You're in! 🎉"}</T>
              <T variant="body" color={ink(0.6)} center style={styles.successText}>
                {alreadyMember ? 'You were already a member of ' : 'Joined '}
                <T variant="title">{foundTrip.name}</T>
              </T>
              <T variant="small" color={ink(0.6)} center>Time to start tracking expenses</T>
            </FadeIn>
            <FadeIn delay={350}>
              <Button title="Go to Dashboard" iconRight={ArrowRight} size="lg" onPress={enterTrip} full testID="join-go-dashboard-btn" />
            </FadeIn>
          </View>
        )}
      </KeyboardScroll>
      <Confetti shot={confetti} />
    </Screen>
  )
}

function Notice({ tone, icon, children }: { tone: 'red' | 'amber' | 'emerald'; icon?: boolean; children: string }) {
  const color = tone === 'red' ? C.red500 : tone === 'amber' ? C.amber700 : C.emerald400
  const bg = tone === 'red' ? red(0.08) : tone === 'amber' ? amber(0.12) : emerald(0.1)
  const border = tone === 'red' ? red(0.2) : tone === 'amber' ? amber(0.3) : emerald(0.22)
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: border }]}>
      {icon ? <TriangleAlert size={15} color={color} /> : <Link2 size={14} color={color} />}
      <T variant="small" color={color} style={styles.flex}>{children}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 18, flexGrow: 1 },
  card: { gap: 16 },
  stack: { gap: 14 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, padding: 10 },
  inviteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: emerald(0.22),
    backgroundColor: emerald(0.08),
    padding: 14,
    gap: 2,
  },
  codeInput: { textAlign: 'center', fontFamily: F.display, fontSize: 20, letterSpacing: 3 },
  paste: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  verified: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: emerald(0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInput: { textAlign: 'center', fontSize: 24, letterSpacing: 12, fontFamily: F.display },
  success: { flex: 1, justifyContent: 'center', gap: 20, paddingTop: 24 },
  successText: { marginTop: 6, marginBottom: 2 },
})
