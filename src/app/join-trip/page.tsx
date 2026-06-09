'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { ArrowRight, ArrowLeft, Check, Users, Lock, Phone, Search, Link2 } from 'lucide-react'
import { ConfettiBlast } from '@/components/animations/ConfettiBlast'
import Link from 'next/link'
import type { Trip } from '@/types'

type Step = 'find' | 'join' | 'pin' | 'success'

export default function JoinTripPage() {
  const router = useRouter()
  const getTripByCode = useStore(s => s.getTripByCode)
  const joinTrip = useStore(s => s.joinTrip)
  const setSession = useStore(s => s.setSession)

  const importTrip = useStore(s => s.importTrip)

  const [step, setStep] = useState<Step>('find')
  const [tripCode, setTripCode] = useState('')
  const [tripPassword, setTripPassword] = useState('')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [foundTrip, setFoundTrip] = useState<{ name: string; id: string } | null>(null)
  const [importedFromLink, setImportedFromLink] = useState(false)
  const [confetti, setConfetti] = useState(false)

  // Import trip from share link — supports both new ?code= format and legacy ?d=<base64-trip>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // New safe format: just the trip code
    const codeParam = params.get('code')
    if (codeParam) {
      setTripCode(codeParam.toUpperCase())
      return
    }

    // Legacy format: full base64-encoded trip object (kept for backward compat)
    const encoded = params.get('d')
    if (!encoded) return
    try {
      const trip: Trip = JSON.parse(atob(encoded))
      if (trip?.tripCode && trip?.id) {
        importTrip(trip)
        setTripCode(trip.tripCode)
        setImportedFromLink(true)
      }
    } catch {
      // invalid encoded data — silently ignore
    }
  }, [importTrip])

  const handleFind = () => {
    const trip = getTripByCode(tripCode.trim().toUpperCase())
    if (!trip) {
      setErrors({ tripCode: 'Trip not found. Check the code and try again.' })
      return
    }
    if (trip.password !== tripPassword) {
      setErrors({ tripPassword: 'Wrong trip password.' })
      return
    }
    setErrors({})
    setFoundTrip({ name: trip.name, id: trip.id })
    setStep('join')
  }

  const handleJoinDetails = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!/^[6-9]\d{9}$/.test(mobile)) errs.mobile = 'Enter a valid 10-digit mobile'
    setErrors(errs)
    if (Object.keys(errs).length === 0) setStep('pin')
  }

  const handleJoin = () => {
    const errs: Record<string, string> = {}
    if (!/^\d{4}$/.test(pin)) errs.pin = 'PIN must be 4 digits'
    if (pin !== pinConfirm) errs.pinConfirm = 'PINs do not match'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const member = joinTrip(tripCode.toUpperCase(), tripPassword, name, mobile, pin)
    if (!member) {
      setErrors({ general: 'Could not join trip. Try again.' })
      return
    }
    setSession({ tripId: foundTrip!.id, memberId: member.id, tripCode: tripCode.toUpperCase() })
    setStep('success')
    setConfetti(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <ConfettiBlast trigger={confetti} type="burst" />

      <div className="w-full max-w-md">
        {step !== 'success' && (
          <Link href="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors">
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
                <p className="text-white/50 text-sm">Enter the trip code shared by your friend</p>
              </div>

              {importedFromLink && (
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
              </div>

              <button id="find-trip-btn" onClick={handleFind} className="btn-brand w-full flex items-center justify-center gap-2">
                Find Trip
                <Search className="w-4 h-4" />
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
                  <p className="text-xs text-white/40">Trip found</p>
                  <p className="font-semibold text-white">{foundTrip.name}</p>
                </div>
              </div>

              <div className="glass rounded-3xl p-7 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Your Details</h2>
                  <p className="text-white/50 text-sm">How should your friends identify you?</p>
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
                <p className="text-white/50 text-sm">You'll use this to log in</p>
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
                <button id="join-final-btn" onClick={handleJoin} className="btn-brand flex-1 flex items-center justify-center gap-2">
                  Join Trip <Check className="w-4 h-4" />
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
              <h2 className="text-2xl font-bold text-white mb-2">You're in! 🎉</h2>
              <p className="text-white/60 text-sm mb-2">Joined <strong className="text-white">{foundTrip.name}</strong></p>
              <p className="text-white/40 text-xs mb-8">Time to start tracking expenses</p>

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
