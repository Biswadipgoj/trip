'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  Users,
  Receipt,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  Zap,
  TrendingDown,
  ArrowUpRight,
  Download,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const features = [
  {
    icon: Users,
    title: 'Instant Group Trips',
    desc: 'Share a simple 6-letter trip code with friends. No app install required for web guests.',
  },
  {
    icon: Receipt,
    title: 'Reliable Bill & UPI Snaps',
    desc: 'Attach bill photos and UPI payment screenshots. Saved offline and synced to the cloud.',
  },
  {
    icon: CheckCircle2,
    title: 'Minimal Debt Transfers',
    desc: 'Our engine compresses complex debts into the fewest direct UPI transfers.',
  },
]

export default function Home() {
  const router = useRouter()
  const session = useStore(s => s.session)
  const [activeTab, setActiveTab] = useState<'minimal' | 'messy'>('minimal')

  useEffect(() => {
    if (session?.tripId) {
      router.replace(`/dashboard/${session.tripId}`)
    }
  }, [session, router])

  return (
    <main className="min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-12 py-12 lg:py-20 max-w-7xl mx-auto overflow-hidden">
      {/* Hero Section: Responsive Split on Desktop, Focused Stack on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left Column: Headline & Action Triggers */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center lg:text-left lg:col-span-6 xl:col-span-7"
        >
          {/* Logo with playful hover bounce */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.08, rotate: [0, -8, 8, -4, 0] }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            className="inline-block mb-6 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden shadow-glow-brand ring-2 ring-brand-500/30 cursor-pointer"
          >
            <Image
              src="/logo.png"
              alt="TripMate"
              width={96}
              height={96}
              priority
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Super-title Pill */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-600/10 px-3.5 py-1.5 mb-4 shadow-sm backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-brand-500 animate-spin" style={{ animationDuration: '8s' }} />
              <span className="text-xs font-bold tracking-wide text-brand-700">TripMate 4.0 · Smart Group Expense Manager</span>
            </div>
          </div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.55 }}
            className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-slate-950 mb-5 leading-[1.12]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Split trips,{' '}
            <span className="text-gradient-brand">not friendships</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-slate-600 text-base sm:text-lg mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal"
          >
            Track every rupee, attach bill photos & UPI screenshots, and settle group expenses automatically with the fewest direct payments.
          </motion.p>

          {/* CTA Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
          >
            <Link
              href="/create-trip"
              id="create-trip-btn"
              className="btn-brand inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-bold shadow-glow-sm hover:shadow-glow-brand hover:scale-105 active:scale-95 transition-all"
            >
              <span>Create a Trip</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>

            <Link
              href="/join-trip"
              id="join-trip-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-slate-800 bg-pure-white/90 hover:bg-pure-white border border-brand-500/20 shadow-card hover:shadow-card-hover hover:scale-105 active:scale-95 transition-all"
            >
              <span>Join Existing Trip</span>
            </Link>

            <Link
              href="/download"
              id="download-app-btn"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold text-brand-700 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Smartphone className="w-4 h-4 text-brand-600" />
              <span>Get Android App</span>
            </Link>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-8 pt-6 border-t border-brand-500/15 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-500"
          >
            <span className="inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> 100% Free & No Ads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Local-First + Supabase Sync
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" /> Instant UPI Direct Settle
            </span>
          </motion.div>
        </motion.div>

        {/* Right Column: Playful Animated Desktop Showcase Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 32 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="lg:col-span-6 xl:col-span-5 relative"
        >
          {/* Playful Floating Expense Stickers with spring physics */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="hidden sm:flex items-center gap-2.5 absolute -top-6 -left-6 z-20 px-3.5 py-2 rounded-2xl bg-pure-white/95 backdrop-blur-xl border border-brand-500/20 shadow-card"
          >
            <span className="text-xl">🍕</span>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">Beach Shack Feast</p>
              <p className="text-[10px] font-semibold text-emerald-600">₹3,200 · Split 4 ways</p>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="hidden sm:flex items-center gap-2.5 absolute -bottom-5 -right-4 z-20 px-3.5 py-2 rounded-2xl bg-pure-white/95 backdrop-blur-xl border border-brand-500/20 shadow-card"
          >
            <span className="text-xl">🚕</span>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">Airport Cab to Villa</p>
              <p className="text-[10px] font-semibold text-brand-600">₹1,400 · Settled via UPI</p>
            </div>
          </motion.div>

          {/* Interactive Showcase Card */}
          <div className="relative rounded-3xl p-6 sm:p-7 bg-pure-white/85 backdrop-blur-2xl border border-brand-500/20 shadow-elevated overflow-hidden">
            {/* Ambient card aura */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Card Header */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-brand-500/10">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🌴</span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">Goa Getaway 2026</h2>
                  <p className="text-[11px] font-semibold text-slate-500">4 members · ₹28,600 spent</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Demo
              </span>
            </div>

            {/* Playful Interactive Settlement Engine Simulator */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Smart Settlement Engine</p>
                {/* Toggle tab */}
                <div className="flex items-center p-0.5 rounded-xl bg-surface-2 border border-brand-500/15 text-[11px] font-bold">
                  <button
                    onClick={() => setActiveTab('minimal')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${activeTab === 'minimal' ? 'bg-pure-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    TripMate (1 Pay)
                  </button>
                  <button
                    onClick={() => setActiveTab('messy')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${activeTab === 'messy' ? 'bg-pure-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Standard (6 Pays)
                  </button>
                </div>
              </div>

              {/* Dynamic Content based on toggle */}
              <AnimatePresence mode="wait">
                {activeTab === 'minimal' ? (
                  <motion.div
                    key="minimal"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-brand-500/5 to-transparent border border-emerald-500/25"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        Optimal Path: 1 Single Transfer
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-pure-white">
                        83% Less Friction
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-pure-white/90 border border-emerald-500/20 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-600 text-pure-white flex items-center justify-center font-bold text-xs">
                          B
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Biswodip</p>
                          <p className="text-[10px] text-slate-500">pays via Google Pay UPI</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-600" />
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Alex</p>
                          <p className="text-xs font-extrabold text-emerald-600">₹1,250</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-pure-white flex items-center justify-center font-bold text-xs">
                          A
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="messy"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-amber-800">
                        Without TripMate: 6 Confusing Transfers
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-pure-white">
                        High Confusion
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                      <p className="p-1.5 rounded-lg bg-pure-white/70">Priya ➔ Biswodip: ₹450</p>
                      <p className="p-1.5 rounded-lg bg-pure-white/70">Biswodip ➔ Alex: ₹1,700</p>
                      <p className="p-1.5 rounded-lg bg-pure-white/70">Rohit ➔ Alex: ₹850</p>
                      <p className="text-[10px] text-amber-700 italic">+ 3 more circular back-and-forth payments!</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick Trip Features Glances */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="p-3 rounded-xl bg-surface-1/80 border border-brand-500/10 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Bill Receipts</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">📸 Full Size Zooms</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-1/80 border border-brand-500/10 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Offline Ready</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">⚡ Instant Local State</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Feature Grid Below */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mt-20 lg:mt-24 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full"
      >
        {features.map((feat, i) => (
          <motion.div
            key={feat.title}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="p-6 rounded-3xl bg-pure-white/80 backdrop-blur-xl border border-brand-500/15 shadow-card hover:shadow-card-hover transition-all text-left"
          >
            <div className="mb-4 w-12 h-12 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center">
              <feat.icon className="w-6 h-6 text-brand-600" />
            </div>
            <h3 className="text-base font-bold text-slate-950 mb-2">{feat.title}</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">{feat.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </main>
  )
}
