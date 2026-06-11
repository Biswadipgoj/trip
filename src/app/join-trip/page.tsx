'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { parseInviteToken, inviteSignature, getAvatarColor } from '@/lib/utils'
import {
  isRemoteEnabled, joinLog, remoteFindTripByCode, remoteGetMembers,
  remoteJoinTrip, remoteFetchTripBundle, remoteEnsureTrip,
} from '@/lib/remote'
import { ArrowRight, ArrowLeft, Check, Users, Lock, Phone, Search, Link2, AlertTriangle, Loader2 } from 'lucide-react'
import { ConfettiBlast } from '@/components/animations/ConfettiBlast'
import Link from 'next/link'
import type { Trip, InvitePayload } from '@/types'

type Step = 'find' | 'join' | 'pin' | 'success'

function JoinTripContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const getTripByCode = useStore(s => s.getTripByCode)
  const joinTrip = useStore(s => s.joinTrip)
  const setSession = useStore(s => s.setSession)
  const importTrip = useStore(s => s.importTrip)
  const upsertMember = useStore(s => s.upsertMember)
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)
  const getMembersByTrip = useStore(s => s.getMembersByTrip)

  const [step, setStep] = useState<Step>('find')
  const [tripCode, setTripCode] = useState('')
  const [tripPassword, setTripPassword] = useState('')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // The verified EXISTING trip the user is joining. Join never creates a trip —
  // it only attaches a member to this one.
  const [foundTrip, setFoundTrip] = useState<Trip | null>(null)
  const [foundViaRemote, setFoundViaRemote] = useState(false)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [invite, setInvite] = useState<InvitePayload | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [importedFromLink, setImportedFromLink] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confetti, setConfetti] = useState(false)

  // ── Deep-link handling ───────────────────────────────────────────────────────
  // Supports three formats (newest first):
  //   ?invite=<base64url signed payload>  → full cross-device join
  //   ?code=TRP-XXXX                      → prefills the trip code
  //   ?d=<base64 trip>                    → legacy full-trip import
  // Re-runs safely on refresh/reopen since it only reads from the URL.
  useEffect(() => {
    const inviteParam = searchParams.get('invite')
    if (inviteParam) {
      const result = parseInviteToken(inviteParam)
      if (result.ok) {
        setInvite(result.payload)
        setTripCode(result.payload.trip.tripCode.toUpperCase())
        setImportedFromLink(true)
        setInviteError(null)
        joinLog('invite.parsed', { tripCode: result.payload.trip.tripCode, tripId: result.payload.trip.id })
      } else {
        joinLog('invite.invalid', { reason: result.reason })
        setInviteError(
          result.reason === 'expired'
            ? 'This invite link has expired. Ask the trip creator for a new invite.'
            : 'Invalid or expired invite link. Try requesting a new invite from the trip creator.'
        )
      }
      return
    }

    const codeParam = searchParams.get('code')
    if (codeParam) {
      setTripCode(codeParam.trim().toUpperCase())
      setImportedFromLink(true)
      return
    }

    // Legacy format: full base64-encoded trip object (kept for backward compat)
    const encoded = searchParams.get('d')
    if (!encoded) return
    try {
      const trip: Trip = JSON.parse(atob(encoded.trim().replace(/\s/g, '+')))
      if (trip?.tripCode && trip?.id) {
        importTrip(trip)
        setTripCode(trip.tripCode.toUpperCase())
        setImportedFromLink(true)
      }
    } catch {
      setInviteError('Invalid or expired invite link. Try requesting a new invite from the trip creator.')
    }
  }, [searchParams, importTrip])

  // ── Step 1: verify the trip EXISTS, then validate the password ───────────────
  const handleFind = async () => {
    const code = tripCode.trim().toUpperCase()
    const password = tripPassword
    if (!code) {
      setErrors({ tripCode: 'Enter the trip code' })
      return
    }

    setBusy(true)
    setErrors({})
    joinLog('find.start', { tripCode: code, viaInvite: !!invite, remote: isRemoteEnabled() })

    try {
      // 1. Cloud path (preferred): the trip lives on the server, so joining
      //    works from ANY device and always targets the one existing trip.
      if (isRemoteEnabled()) {
        let remoteTrip: Trip | null = null
        try {
          remoteTrip = await remoteFindTripByCode(code)
        } catch (err) {
          setErrors({ general: err instanceof Error ? err.message : 'Network error. Try again.' })
          return
        }

        if (remoteTrip) {
          if (remoteTrip.password !== password) {
            joinLog('find.wrongPassword', { tripCode: code })
            setErrors({ tripPassword: 'Wrong trip password. Ask the trip creator for the correct one.' })
            return
          }
          const existingMembers = await remoteGetMembers(remoteTrip.id)
          importTrip(remoteTrip) // upsert by code — never duplicates
          setFoundTrip(remoteTrip)
          setFoundViaRemote(true)
          setMemberCount(existingMembers.length)
          joinLog('find.verified', { tripId: remoteTrip.id, tripCode: code, members: existingMembers.length })
          setStep('join')
          return
        }
        // Remote enabled but trip not found there → fall through to the
        // invite-link / local paths (trips created before cloud sync).
      }

      // 2. Invite-link path: trip data came from the link, verify password
      //    against the link's signature (works even on a brand-new device).
      if (invite && invite.trip.tripCode.toUpperCase() === code) {
        if (inviteSignature(code, password) !== invite.sig) {
          joinLog('find.wrongPassword', { tripCode: code, via: 'invite' })
          setErrors({ tripPassword: 'Wrong trip password. Ask the trip creator for the correct one.' })
          return
        }
        const inviteTrip: Trip = { ...invite.trip, password }
        importTrip(inviteTrip)
        setFoundTrip(inviteTrip)
        setFoundViaRemote(false)
        setMemberCount(null)
        joinLog('find.verified', { tripId: inviteTrip.id, tripCode: code, via: 'invite' })
        setStep('join')
        return
      }

      // 3. Local path: trip already exists on this device
      const trip = getTripByCode(code)
      if (!trip) {
        joinLog('find.notFound', { tripCode: code })
        setErrors({
          tripCode: invite
            ? 'This code doesn’t match your invite link. Use the code from the link or ask for a new invite.'
            : 'This trip doesn’t exist. Double-check the code, or ask your friend for an invite link.',
        })
        return
      }
      if (trip.password !== password) {
        joinLog('find.wrongPassword', { tripCode: code, via: 'local' })
        setErrors({ tripPassword: 'Wrong trip password.' })
        return
      }
      setFoundTrip(trip)
      setFoundViaRemote(false)
      setMemberCount(getMembersByTrip(trip.id).length)
      joinLog('find.verified', { tripId: trip.id, tripCode: code, via: 'local' })
      setStep('join')
    } finally {
      setBusy(false)
    }
  }

  const handleJoinDetails = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!/^[6-9]\d{9}$/.test(mobile)) errs.mobile = 'Enter a valid 10-digit mobile'
    setErrors(errs)
    if (Object.keys(errs).length === 0) setStep('pin')
  }

  // ── Final step: attach member to the EXISTING trip (never create one) ────────
  const handleJoin = async () => {
    const errs: Record<string, string> = {}
    if (!/^\d{4}$/.test(pin)) errs.pin = 'PIN must be 4 digits'
    if (pin !== pinConfirm) errs.pinConfirm = 'PINs do not match'
    setErrors(errs)
    if (Object.keys(errs).length > 0 || !foundTrip) return

    setBusy(true)
    try {
      if (isRemoteEnabled()) {
        // The trip was verified via invite link or found locally but is not on
        // the server yet (created before cloud sync). Provision the SAME trip
        // row (same id + code) so the join attaches to the one shared trip —
        // never a parallel device-local copy with the same name.
        const remoteReady = foundViaRemote || await remoteEnsureTrip(foundTrip)

        if (!remoteReady) {
          // Joining locally anyway would create a disconnected same-named copy
          // (the exact bug this flow exists to prevent) — fail loudly instead.
          joinLog('join.remoteUnavailable', { tripId: foundTrip.id })
          setErrors({
            general:
              'Could not attach you to the shared trip on the server. Check your internet connection and try again — joining offline would create a disconnected copy.',
          })
          return
        }

        const avatarColor = getAvatarColor(memberCount ?? 0)
        const { member, alreadyMember: existed } = await remoteJoinTrip(foundTrip, {
          name: name.trim(), mobile, pin, avatarColor,
        })
        // Pull the full existing trip (members, expenses, stays, settlements)
        // so the dashboard shows the real trip — not an empty copy.
        const bundle = await remoteFetchTripBundle(foundTrip.id)
        if (bundle) mergeRemoteTrip(bundle)
        else upsertMember(member)

        setAlreadyMember(existed)
        setSession({ tripId: foundTrip.id, memberId: member.id, tripCode: foundTrip.tripCode })
        joinLog('join.success', { tripId: foundTrip.id, memberId: member.id, alreadyMember: existed })
        setStep('success')
        setConfetti(true)
        return
      }

      // Local fallback (no cloud configured): joinTrip only adds a member to
      // the already-imported trip and is duplicate-safe by mobile number.
      const member = joinTrip(foundTrip.tripCode, foundTrip.password, name.trim(), mobile, pin)
      if (!member) {
        joinLog('join.localFailed', { tripId: foundTrip.id })
        setErrors({ general: 'Could not join trip. Try again or request a new invite link.' })
        return
      }
      setSession({ tripId: foundTrip.id, memberId: member.id, tripCode: foundTrip.tripCode })
      joinLog('join.success', { tripId: foundTrip.id, memberId: member.id, via: 'local' })
      setStep('success')
      setConfetti(true)
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Could not join the trip. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <ConfettiBlast trigger={confetti} type="burst" />

      <div className="w-full max-w-md">
        {step !== 'success' && (
          <Link href="/" className="inline-flex items-center gap-2 text-white/65 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Find trip */}
          {step === 'find' && (
            <motion.div
              key="find"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
              className="glass rounded-3xl p-7 space-y-5"
            >
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Join a Trip</h1>
                <p className="text-white/65 text-sm">
                  {invite ? 'You’ve been invited — confirm to join' : 'Enter the trip code shared by your friend'}
                </p>
              </div>

              {inviteError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{inviteError}</p>
                </div>
              )}

              {!isRemoteEnabled() && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Cloud sync is not configured on this deployment, so joining only works on the
                    device where the trip was created. Ask the admin to set the Supabase environment
                    variables on Vercel.{' '}
                    <Link href="/debug" className="underline font-semibold">Open Sync Doctor</Link>
                  </p>
                </div>
              )}

              {invite && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-400 font-medium">Invite found</p>
                  </div>
                  <p className="text-base font-semibold text-white">{invite.trip.name}</p>
                  <p className="text-xs text-white/60 mt-0.5">Enter the trip password to confirm joining</p>
                </div>
              )}

              {importedFromLink && !invite && !inviteError && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                  <Link2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <p className="text-xs text-emerald-400">Trip found via link — just enter the password to join</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    <Search className="w-3.5 h-3.5 inline mr-1.5" />
                    Trip Code
                  </label>
                  <input
                    id="join-trip-code-input"
                    className="input-glass text-center text-xl font-bold tracking-widest uppercase"
                    placeholder="TRP-XXXX"
                    value={tripCode}
                    onChange={e => setTripCode(e.target.value.toUpperCase().slice(0, 8))}
                    maxLength={8}
                  />
                  {errors.tripCode && <p className="mt-1 text-xs text-red-400">{errors.tripCode}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    <Lock className="w-3.5 h-3.5 inline mr-1.5" />
                    Trip Password
                  </label>
                  <input
                    id="join-password-input"
                    className="input-glass"
                    placeholder="Ask the trip creator"
                    type="password"
                    value={tripPassword}
                    onChange={e => setTripPassword(e.target.value)}
                  />
                  {errors.tripPassword && <p className="mt-1 text-xs text-red-400">{errors.tripPassword}</p>}
                </div>
                {errors.general && <p className="text-xs text-red-400">{errors.general}</p>}
              </div>

              <button
                id="find-trip-btn"
                onClick={handleFind}
                disabled={busy}
                className="btn-brand w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying trip…</>
                ) : (
                  <>{invite ? 'Confirm & Continue' : 'Find Trip'}{invite ? <ArrowRight className="w-4 h-4" /> : <Search className="w-4 h-4" />}</>
                )}
              </button>
            </motion.div>
          )}

          {/* Step 2: Your details */}
          {step === 'join' && foundTrip && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
              className="space-y-4"
            >
              {/* Found trip card */}
              <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-emerald-500/20">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-white/60">Existing trip verified</p>
                  <p className="font-semibold text-white">{foundTrip.name}</p>
                  {memberCount !== null && memberCount > 0 && (
                    <p className="text-xs text-white/60">{memberCount} member{memberCount !== 1 ? 's' : ''} already in</p>
                  )}
                </div>
              </div>

              <div className="glass rounded-3xl p-7 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Your Details</h2>
                  <p className="text-white/65 text-sm">How should your friends identify you?</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      <Users className="w-3.5 h-3.5 inline mr-1.5" />
                      Your Name
                    </label>
                    <input
                      id="join-name-input"
                      className="input-glass"
                      placeholder="Your name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      <Phone className="w-3.5 h-3.5 inline mr-1.5" />
                      Mobile Number
                    </label>
                    <input
                      id="join-mobile-input"
                      className="input-glass"
                      placeholder="10-digit mobile"
                      inputMode="numeric"
                      value={mobile}
                      onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                    {errors.mobile && <p className="mt-1 text-xs text-red-400">{errors.mobile}</p>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button id="join-back-btn" onClick={() => setStep('find')} className="btn-ghost flex-1">Back</button>
                  <button id="join-next-btn" onClick={handleJoinDetails} className="btn-brand flex-1 flex items-center justify-center gap-2">
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: PIN */}
          {step === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
              className="glass rounded-3xl p-7 space-y-5"
            >
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Set Your PIN</h2>
                <p className="text-white/65 text-sm">You&apos;ll use this to log in</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">4-Digit PIN</label>
                  <input
                    id="join-pin-input"
                    className="input-glass text-center text-2xl tracking-[0.4em]"
                    placeholder="••••"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                  {errors.pin && <p className="mt-1 text-xs text-red-400">{errors.pin}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Confirm PIN</label>
                  <input
                    id="join-pin-confirm-input"
                    className="input-glass text-center text-2xl tracking-[0.4em]"
                    placeholder="••••"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinConfirm}
                    onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                  {errors.pinConfirm && <p className="mt-1 text-xs text-red-400">{errors.pinConfirm}</p>}
                </div>
                {errors.general && <p className="text-xs text-red-400 text-center">{errors.general}</p>}
              </div>

              <div className="flex gap-3">
                <button id="join-pin-back-btn" onClick={() => setStep('join')} className="btn-ghost flex-1">Back</button>
                <button
                  id="join-final-btn"
                  onClick={handleJoin}
                  disabled={busy}
                  className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : <>Join Trip <Check className="w-4 h-4" /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* Success */}
          {step === 'success' && foundTrip && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="mx-auto mb-6 w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
              >
                <Check className="w-10 h-10 text-emerald-400" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {alreadyMember ? 'Welcome back! 👋' : "You're in! 🎉"}
              </h2>
              <p className="text-white/60 text-sm mb-2">
                {alreadyMember ? 'You were already a member of ' : 'Joined '}
                <strong className="text-white">{foundTrip.name}</strong>
              </p>
              <p className="text-white/60 text-xs mb-8">Time to start tracking expenses</p>

              <button
                id="join-go-dashboard-btn"
                onClick={() => router.push(`/dashboard/${foundTrip.id}`)}
                className="btn-brand w-full flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

export default function JoinTripPage() {
  return (
    <Suspense fallback={null}>
      <JoinTripContent />
    </Suspense>
  )
}
