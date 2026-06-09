'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion } from 'framer-motion'
import { MapPin, Sparkles, ArrowRight, Users, Receipt, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const features = [
  { icon: Users,         title: 'Group Trips',    desc: 'Invite friends with a trip code' },
  { icon: Receipt,       title: 'Track Expenses', desc: 'Add expenses in seconds' },
  { icon: CheckCircle2,  title: 'Auto Settle',    desc: 'Smart debt minimization' },
]

export default function Home() {
  const router = useRouter()
  const session = useStore(s => s.session)

  useEffect(() => {
    if (session?.tripId) {
      router.replace(`/dashboard/${session.tripId}`)
    }
  }, [session, router])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-surface-0 noise relative">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="text-center max-w-xl mx-auto z-10 relative"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className="mx-auto mb-6 w-20 h-20 rounded-3xl bg-gradient-brand flex items-center justify-center shadow-glow-brand"
        >
          <MapPin className="w-9 h-9 text-white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-xs font-medium text-brand-700">Premium Trip Expense Manager</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.55 }}
          className="text-5xl font-display font-bold tracking-tight mb-4 text-slate-800"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Split trips,{' '}
          <span className="text-gradient-brand">not friendships</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="text-slate-500 text-lg mb-10 leading-relaxed max-w-md mx-auto font-medium"
        >
          Track every rupee, split every expense, and settle up via UPI — automatically.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link href="/create-trip" id="create-trip-btn" className="btn-brand inline-flex items-center justify-center gap-2 shadow-elevated">
            <span>Create a Trip</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/join-trip" id="join-trip-btn" className="btn-ghost inline-flex items-center justify-center gap-2 bg-white/50 backdrop-blur border border-black/5 hover:bg-white/80">
            <span>Join Existing Trip</span>
          </Link>
          <Link href="/login" id="login-btn" className="btn-ghost inline-flex items-center justify-center gap-2 bg-white/50 backdrop-blur border border-black/5 hover:bg-white/80">
            <span>Login</span>
          </Link>
        </motion.div>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.6 }}
        className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto w-full z-10 relative"
      >
        {features.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
            className="glass rounded-2xl p-5 text-center bg-white/40 border border-white/60 shadow-glass"
          >
            <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
              <feat.icon className="w-5 h-5 text-brand-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">{feat.title}</h3>
            <p className="text-xs text-slate-500 font-medium">{feat.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </main>
  )
}
