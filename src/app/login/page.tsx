'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { MapPin, ArrowRight, Phone, Hash, Shield } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const login = useStore(s => s.login)
  const setSession = useStore(s => s.setSession)
  const getTripByCode = useStore(s => s.getTripByCode)

  const [tripCode, setTripCode] = useState('')
  const [mobile, setMobile] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)

    await new Promise(r => setTimeout(r, 600))

    const member = login(tripCode.trim().toUpperCase(), mobile.trim(), pin)
    setLoading(false)

    if (!member) {
      setError('Invalid trip code, mobile, or PIN. Please check and try again.')
      setShake(true)
      setTimeout(() => setShake(false), 600)
      return
    }

    const trip = getTripByCode(tripCode.toUpperCase())
    if (!trip) return

    setSession({ tripId: trip.id, memberId: member.id, tripCode: trip.tripCode })
    router.push(`/dashboard/${trip.id}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-white/50 text-sm">Login to your trip</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, x: shake ? [-8, 8, -8, 8, 0] : 0 }}
          transition={{ duration: shake ? 0.4 : 0.4 }}
          className="glass rounded-3xl p-7 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              <Hash className="w-3.5 h-3.5 inline mr-1.5" />
              Trip Code
            </label>
            <input
              id="login-trip-code"
              className="input-glass text-center text-lg font-bold tracking-widest uppercase"
              placeholder="TRP-XXXX"
              value={tripCode}
              onChange={e => setTripCode(e.target.value.toUpperCase().slice(0, 8))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              <Phone className="w-3.5 h-3.5 inline mr-1.5" />
              Mobile Number
            </label>
            <input
              id="login-mobile"
              className="input-glass"
              placeholder="10-digit number"
              inputMode="numeric"
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              <Shield className="w-3.5 h-3.5 inline mr-1.5" />
              4-Digit PIN
            </label>
            <input
              id="login-pin"
              className="input-glass text-center text-2xl tracking-[0.4em]"
              placeholder="••••"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-red-400 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            id="login-submit-btn"
            onClick={handleLogin}
            disabled={loading}
            className="btn-brand w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                Login
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center space-y-2"
        >
          <p className="text-white/40 text-sm">
            New trip?{' '}
            <Link href="/create-trip" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
          <p className="text-white/40 text-sm">
            Have a code?{' '}
            <Link href="/join-trip" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Join a trip
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  )
}
