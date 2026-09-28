'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import {
  isRemoteEnabled,
  remoteFetchTripBundle,
} from '@/lib/remote'
import {
  LAST_MOBILE_KEY, isValidMobile, normalizeMobileInput, localTripChoices, sortTripChoices, type TripChoice,
} from '@/lib/tripLogin'
import { authLogin, authLookupTrips, authUnavailable } from '@/lib/authClient'
import { safeNextPath } from '@/lib/auth/safeNext'
import { ArrowLeft, ArrowRight, Phone, Shield, Users, ChevronRight, Radio } from 'lucide-react'
import { LanguageSelector } from '@/components/shared/LanguageSelector'
import Link from 'next/link'
import Image from 'next/image'

type Step = 'mobile' | 'trips' | 'pin'

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      className="w-4 h-4 border-2 border-pure-white/30 border-t-pure-white rounded-full"
    />
  )
}

export default function LoginPage() {
  const router = useRouter()
  const trips = useStore(s => s.trips)
  const members = useStore(s => s.members)
  const setSession = useStore(s => s.setSession)
  const mergeRemoteTrip = useStore(s => s.mergeRemoteTrip)

  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [choices, setChoices] = useState<TripChoice[]>([])
  const [selected, setSelected] = useState<TripChoice | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  // Returning users: prefill the number they last logged in with.
  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_MOBILE_KEY)
      if (last && isValidMobile(last)) setMobile(last)
    } catch {
      // storage unavailable (private mode)
    }
  }, [])

  const liveCount = useMemo(() => choices.filter(c => c.status === 'active').length, [choices])
  const pastCount = choices.length - liveCount

  const fail = (message: string) => {
    setError(message)
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const findTrips = async () => {
    setError('')
    if (!isValidMobile(mobile)) {
      fail('Enter the 10-digit mobile number you joined the trip with.')
      return
    }
    setLoading(true)
    try {
      const res = await authLookupTrips(mobile)
      let found: TripChoice[]
      if (res.ok) found = sortTripChoices(res.data.trips)
      else if (authUnavailable(res)) found = await legacyFindTrips()
      else {
        fail(res.error)
        return
      }
      if (found.length === 0) {
        fail('No trips found for this number. Join with a trip code or create a new trip.')
        return
      }
      setChoices(found)
      setStep('trips')
    } finally {
      setLoading(false)
    }
  }

  // Servers without login secrets (local development) can only offer the
  // trips on this device. Production always goes through /api/auth.
  const legacyFindTrips = async () => localTripChoices(trips, members, mobile)

  const chooseTrip = (choice: TripChoice) => {
    setSelected(choice)
    setPin('')
    setError('')
    setStep('pin')
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
      // The server checks the PIN and sets the httpOnly session cookies.
      const res = await authLogin(selected.memberId, pin)
      if (!res.ok) {
        if (!authUnavailable(res)) {
          fail(res.error)
          return
        }
        const localMember = members.find(m => m.id === selected.memberId)
        if (!localMember?.pin || localMember.pin !== pin) {
          fail('That PIN doesn’t match this trip. Try again.')
          return
        }
      }

      // Pull the latest trip data; fine to continue if it's already on this device.
      if (isRemoteEnabled()) {
        const bundle = await remoteFetchTripBundle(selected.tripId).catch(() => null)
        if (bundle) mergeRemoteTrip(bundle)
        else if (!trips.some(t => t.id === selected.tripId)) {
          fail('Couldn’t download this trip. Check your connection and try again.')
          return
        }
      }

      try {
        localStorage.setItem(LAST_MOBILE_KEY, mobile)
      } catch {
        // ignore
      }
      setSession({ tripId: selected.tripId, memberId: selected.memberId, tripCode: selected.tripCode })
      const next = safeNextPath(new URLSearchParams(window.location.search).get('next'))
      router.push(next && next.includes(selected.tripId) ? next : `/dashboard/${selected.tripId}`)
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    setError('')
    if (step === 'pin') setStep('trips')
    else if (step === 'trips') setStep('mobile')
    else router.push('/')
  }

  const errorLine = (
    <AnimatePresence>
      {error && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="text-xs text-red-500 text-center"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  )

  return (
    <main className="min-h-[100dvh] flex items-start sm:items-center justify-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 sm:py-16">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <LanguageSelector />
        </div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl overflow-hidden shadow-glow-brand ring-1 ring-brand-500/30">
            <Image src="/logo.png" alt="TripMate" width={64} height={64} priority className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-white/65 text-sm">
            {step === 'mobile' && 'Log in with your mobile number'}
            {step === 'trips' && 'Choose the trip to open'}
            {step === 'pin' && 'Enter your PIN for this trip'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, x: shake ? [-8, 8, -8, 8, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className="glass rounded-3xl p-7 space-y-4"
        >
          {step === 'mobile' && (
            <>
              <div>
                <label htmlFor="login-mobile" className="block text-xs font-medium text-white/75 mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1.5" />
                  Mobile Number
                </label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-2 left-0 flex items-center border-r border-brand-500/20 pl-4 pr-3 text-lg font-semibold text-slate-500"
                  >
                    +91
                  </span>
                  <input
                    id="login-mobile"
                    type="tel"
                    className="input-glass !pl-[4.75rem] text-lg font-semibold tracking-wide placeholder:font-normal placeholder:tracking-normal"
                    placeholder="98765 43210"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    aria-describedby="login-mobile-hint"
                    value={mobile}
                    onChange={e => setMobile(normalizeMobileInput(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && findTrips()}
                  />
                </div>
                <p id="login-mobile-hint" className="mt-1.5 text-[11px] text-slate-500">
                  The number you used when you joined or created the trip.
                </p>
              </div>
              {errorLine}
              <button
                id="login-find-trips-btn"
                type="button"
                onClick={findTrips}
                disabled={loading}
                className="btn-brand w-full flex items-center justify-center gap-2"
              >
                {loading ? <Spinner /> : (<>Find my trips <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </>
          )}

          {step === 'trips' && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                  <Radio className="w-3.5 h-3.5" />
                  {liveCount} live {liveCount === 1 ? 'trip' : 'trips'}
                </span>
                {pastCount > 0 && <span className="text-white/55">{pastCount} past</span>}
              </div>
              <ul className="space-y-2.5" aria-label="Your trips">
                {choices.map(c => (
                  <li key={c.tripId}>
                    <button
                      type="button"
                      onClick={() => chooseTrip(c)}
                      className="w-full flex items-center gap-3 rounded-2xl border border-brand-500/15 bg-pure-white/80 hover:bg-pure-white hover:border-brand-500/40 p-3.5 text-left transition-all active:scale-[0.98]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">{c.name}</span>
                          {c.status === 'active' ? (
                            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Live
                            </span>
                          ) : (
                            <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              Closed
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                          {c.tripCode} · as {c.memberName}
                          {c.createdAt ? ` · ${formatDate(c.createdAt)}` : ''}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Users className="w-3 h-3" /> {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setStep('mobile')}
                className="w-full text-xs text-white/75 hover:text-white/80"
              >
                Not {mobile}? Use a different number
              </button>
            </>
          )}

          {step === 'pin' && selected && (
            <>
              <div className="rounded-2xl bg-brand-500/10 border border-brand-500/20 p-3 text-center">
                <p className="font-bold text-slate-900">{selected.name}</p>
                <p className="text-[11px] text-slate-500">
                  {selected.tripCode} · as {selected.memberName}
                </p>
              </div>
              <div>
                <label htmlFor="login-pin" className="block text-xs font-medium text-white/75 mb-1.5">
                  <Shield className="w-3.5 h-3.5 inline mr-1.5" />
                  4-Digit PIN
                </label>
                <input
                  id="login-pin"
                  className="input-glass text-center text-2xl tracking-[0.4em]"
                  placeholder="••••"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  autoFocus
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && openTrip()}
                />
              </div>
              {errorLine}
              <button
                id="login-submit-btn"
                type="button"
                onClick={openTrip}
                disabled={loading}
                className="btn-brand w-full flex items-center justify-center gap-2"
              >
                {loading ? <Spinner /> : (<>Open trip <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center space-y-2"
        >
          <p className="text-white/75 text-sm">
            New trip?{' '}
            <Link href="/create-trip" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">
              Create one
            </Link>
          </p>
          <p className="text-white/75 text-sm">
            Have a code?{' '}
            <Link href="/join-trip" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">
              Join a trip
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  )
}
