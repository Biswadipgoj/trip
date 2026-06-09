'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { MapPin, ArrowRight, ArrowLeft, Check, Copy, Users, Lock, Phone, Sparkles, Link2 } from 'lucide-react'
import type { Trip } from '@/types'
import { ConfettiBlast } from '@/components/animations/ConfettiBlast'
import Link from 'next/link'

type Step = 'details' | 'pin' | 'success'

export default function CreateTripPage() {
  const router = useRouter()
  const createTrip = useStore(s => s.createTrip)
  const setSession = useStore(s => s.setSession)

  const [step, setStep] = useState<Step>('details')
  const [tripName, setTripName] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ tripCode: string; tripId: string; memberId: string } | null>(null)
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [confetti, setConfetti] = useState(false)

  const validateDetails = () => {
    const errs: Record<string, string> = {}
    if (!tripName.trim()) errs.tripName = 'Trip name is required'
    if (!creatorName.trim()) errs.creatorName = 'Your name is required'
    if (!/^[6-9]\d{9}$/.test(mobile)) errs.mobile = 'Enter a valid 10-digit mobile number'
    if (password.length < 4) errs.password = 'Password must be at least 4 characters'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validatePin = () => {
    const errs: Record<string, string> = {}
    if (!/^\d{4}$/.test(pin)) errs.pin = 'PIN must be exactly 4 digits'
    if (pin !== pinConfirm) errs.pinConfirm = 'PINs do not match'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNextFromDetails = () => {
    if (validateDetails()) setStep('pin')
  }

  const handleCreate = () => {
    if (!validatePin()) return
    const { trip, member } = createTrip(tripName, creatorName, mobile, password, pin)
    setResult({ tripCode: trip.tripCode, tripId: trip.id, memberId: member.id })
    setCreatedTrip(trip)
    try {
      setShareUrl(`${window.location.origin}/join-trip?d=${btoa(JSON.stringify(trip))}`)
    } catch {
      setShareUrl(`${window.location.origin}/join-trip`)
    }
    setSession({ tripId: trip.id, memberId: member.id, tripCode: trip.tripCode })
    setStep('success')
    setConfetti(true)
  }

  const copyCode = () => {
    if (result) {
      navigator.clipboard.writeText(result.tripCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const steps = ['details', 'pin', 'success']
  const stepIndex = steps.indexOf(step)

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <ConfettiBlast trigger={confetti} type="burst" />

      <div className="w-full max-w-md">
        {/* Back link */}
        {step !== 'success' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Link href="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </motion.div>
        )}

        {/* Progress */}
        {step !== 'success' && (
          <div className="flex gap-2 mb-8">
            {['Trip Details', 'Set PIN'].map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    background: i <= stepIndex
                      ? 'linear-gradient(90deg, hsl(240,78%,58%), hsl(280,78%,55%))'
                      : 'rgba(255,255,255,0.1)',
                  }}
                />
                <p className={`mt-1.5 text-[10px] font-medium ${i <= stepIndex ? 'text-brand-400' : 'text-white/30'}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Details */}
          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="glass rounded-3xl p-7 space-y-5"
            >
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Create a Trip</h1>
                <p className="text-white/50 text-sm">Set up your group trip and invite friends</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
                    Trip Name
                  </label>
                  <input
                    id="trip-name-input"
                    className="input-glass"
                    placeholder="e.g. Goa Trip 2025"
                    value={tripName}
                    onChange={e => setTripName(e.target.value)}
                    maxLength={50}
                  />
                  {errors.tripName && <p className="mt-1 text-xs text-red-400">{errors.tripName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    <Users className="w-3.5 h-3.5 inline mr-1.5" />
                    Your Name
                  </label>
                  <input
                    id="creator-name-input"
                    className="input-glass"
                    placeholder="e.g. Rahul"
                    value={creatorName}
                    onChange={e => setCreatorName(e.target.value)}
                    maxLength={40}
                  />
                  {errors.creatorName && <p className="mt-1 text-xs text-red-400">{errors.creatorName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    <Phone className="w-3.5 h-3.5 inline mr-1.5" />
                    Mobile Number
                  </label>
                  <input
                    id="mobile-input"
                    className="input-glass"
                    placeholder="10-digit mobile"
                    value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    type="tel"
                  />
                  {errors.mobile && <p className="mt-1 text-xs text-red-400">{errors.mobile}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    <Lock className="w-3.5 h-3.5 inline mr-1.5" />
                    Trip Password (shared with friends)
                  </label>
                  <input
                    id="trip-password-input"
                    className="input-glass"
                    placeholder="Min 4 characters"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    maxLength={30}
                  />
                  {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
                </div>
              </div>

              <button id="details-next-btn" onClick={handleNextFromDetails} className="btn-brand w-full flex items-center justify-center gap-2">
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Step 2: PIN */}
          {step === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="glass rounded-3xl p-7 space-y-5"
            >
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Set Your PIN</h2>
                <p className="text-white/50 text-sm">Your personal 4-digit login PIN</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">4-Digit PIN</label>
                  <input
                    id="pin-input"
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
                    id="pin-confirm-input"
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
              </div>

              <div className="flex gap-3">
                <button id="pin-back-btn" onClick={() => setStep('details')} className="btn-ghost flex-1">
                  Back
                </button>
                <button id="create-trip-final-btn" onClick={handleCreate} className="btn-brand flex-1 flex items-center justify-center gap-2">
                  Create Trip
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center"
            >
              {/* Success icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="mx-auto mb-6 w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
              >
                <Check className="w-10 h-10 text-emerald-400" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white mb-2"
              >
                Trip Created! 🎉
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/60 text-sm mb-8"
              >
                Share this code with your friends to join
              </motion.p>

              {/* Trip code */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="glass rounded-2xl p-6 mb-4"
              >
                <p className="text-xs text-white/40 mb-2 font-medium">YOUR TRIP CODE</p>
                <p
                  className="text-4xl font-bold tracking-widest text-gradient-brand mb-4"
                  style={{ fontFamily: "'Space Grotesk', monospace" }}
                >
                  {result.tripCode}
                </p>
                <button
                  id="copy-trip-code-btn"
                  onClick={copyCode}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </motion.div>

              {/* Share join link */}
              {shareUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass rounded-2xl p-4 mb-6 text-left"
                >
                  <p className="text-xs text-white/40 mb-2 font-medium flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    SHARE JOIN LINK (works on any device)
                  </p>
                  <p className="text-[11px] text-white/30 font-mono break-all mb-3 leading-relaxed">
                    {shareUrl}
                  </p>
                  <button
                    id="copy-join-link-btn"
                    onClick={copyLink}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      copiedLink
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30'
                    }`}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    {copiedLink ? 'Link Copied!' : 'Copy Join Link'}
                  </button>
                  <p className="text-[10px] text-white/25 mt-2">
                    Anyone who opens this link can join directly — no code needed
                  </p>
                </motion.div>
              )}

              <motion.button
                id="go-to-dashboard-btn"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                onClick={() => router.push(`/dashboard/${result.tripId}`)}
                className="btn-brand w-full flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
