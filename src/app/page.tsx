'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  LogIn,
  ArrowRight,
  Users,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Check,
  WifiOff,
  Download,
  QrCode,
  Camera,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslation } from '@/lib/i18n'
import { LanguageSelector } from '@/components/shared/LanguageSelector'
import { AppInstallLink } from '@/components/download/AppInstallLink'
import { usePlatform } from '@/lib/platform'

export default function Home() {
  const router = useRouter()
  const session = useStore(s => s.session)
  const [activeTab, setActiveTab] = useState<'minimal' | 'messy'>('minimal')
  const platform = usePlatform()
  const { t } = useTranslation()

  useEffect(() => {
    if (session?.tripId) {
      router.replace(`/dashboard/${session.tripId}`)
    }
  }, [session, router])

  const features = [
    {
      icon: Users,
      title: t('feat1Title'),
      desc: t('feat1Desc'),
    },
    {
      icon: Receipt,
      title: t('feat2Title'),
      desc: t('feat2Desc'),
    },
    {
      icon: CheckCircle2,
      title: t('feat3Title'),
      desc: t('feat3Desc'),
    },
    {
      icon: WifiOff,
      title: t('feat4Title'),
      desc: t('feat4Desc'),
    },
  ]

  return (
    <main className="min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-12 py-8 lg:py-16 max-w-7xl mx-auto overflow-hidden">
      {/* Top Bar with Language Selector and Navigation */}
      <div className="flex items-center justify-between mb-8 sm:mb-12 pb-4 border-b border-brand-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md ring-2 ring-brand-500/30">
            <Image
              src="/logo.png"
              alt="TripMate"
              width={40}
              height={40}
              priority
              className="w-full h-full object-cover"
            />
          </div>
          <span
            className="text-xl font-extrabold tracking-tight text-slate-950"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            TripMate
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 20-Language Selector Dropdown / Modal */}
          <LanguageSelector />

          <Link
            href="/login"
            id="header-login-link"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-800 bg-pure-white/90 hover:bg-pure-white border border-brand-500/20 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log in</span>
          </Link>

          <AppInstallLink
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-brand-700 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 transition-all"
            iconClassName="w-3.5 h-3.5"
          />
        </div>
      </div>

      {/* Hero Section: Responsive Split on Desktop, Focused Stack on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left Column: Headline & Action Triggers */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center lg:text-left lg:col-span-6 xl:col-span-7"
        >
          {/* Friendly Tagline Pill */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-600/10 px-3.5 py-1.5 mb-4 shadow-sm backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-brand-500 animate-spin" style={{ animationDuration: '8s' }} />
              <span className="text-xs font-bold tracking-wide text-brand-700">
                TripMate · {t('tagline')}
              </span>
            </div>
          </div>

          {/* Main Headline — De-AI-fied, Human & Relatable */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.55 }}
            className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-slate-950 mb-5 leading-[1.12]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('splitHero')}{' '}
            <span className="text-gradient-brand">{t('splitSub')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-slate-600 text-base sm:text-lg mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal"
          >
            {t('heroLead')}
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
              <span>{t('createTrip')}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>

            <Link
              href="/join-trip"
              id="join-trip-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-slate-800 bg-pure-white/90 hover:bg-pure-white border border-brand-500/20 shadow-card hover:shadow-card-hover hover:scale-105 active:scale-95 transition-all"
            >
              <span>{t('joinTrip')}</span>
            </Link>

            <Link
              href="/login"
              id="login-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-brand-700 bg-pure-white/90 hover:bg-pure-white border border-brand-500/20 shadow-card hover:shadow-card-hover hover:scale-105 active:scale-95 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('login')}</span>
            </Link>

            <AppInstallLink
              id="download-app-btn"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold text-brand-700 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 hover:scale-105 active:scale-95 transition-all"
              iconClassName="w-4 h-4 text-brand-600"
            />
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-8 pt-6 border-t border-brand-500/15 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-500"
          >
            <span className="inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> {t('freeNoAds')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {t('localFirstSync')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" /> {t('upiSettle')}
            </span>
          </motion.div>
        </motion.div>

        {/* Right Column: Interactive Friendly Showcase Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 32 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="lg:col-span-6 xl:col-span-5 relative"
        >
          {/* Floating Expense Stickers */}
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
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Card Header */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-brand-500/10">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🌴</span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">Goa Trip 2026</h2>
                  <p className="text-[11px] font-semibold text-slate-500">4 friends · ₹28,600 spent</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t('demoTitle')}
              </span>
            </div>

            {/* Interactive Settlement Simulator */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('settlements')}</p>
                </div>
                {/* Toggle tab */}
                <div className="inline-flex items-center p-0.5 rounded-xl bg-surface-2 border border-brand-500/15 text-[11px] font-bold shrink-0 self-start sm:self-auto shadow-xs">
                  <button
                    onClick={() => setActiveTab('minimal')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeTab === 'minimal'
                        ? 'bg-pure-white text-brand-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('minimalTransfers')}
                  </button>
                  <button
                    onClick={() => setActiveTab('messy')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeTab === 'messy'
                        ? 'bg-pure-white text-amber-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('messyTransfers')}
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
                        {t('optimalPath')}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-pure-white">
                        {t('frictionFree')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-pure-white/90 border border-emerald-500/20 shadow-sm gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-600 text-pure-white flex items-center justify-center font-bold text-xs shrink-0">
                          B
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">Biswodip</p>
                          <p className="text-[10px] text-slate-500 truncate">pays via Google Pay UPI</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0 mx-1" />
                      <div className="flex items-center gap-2 text-right min-w-0">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">Alex</p>
                          <p className="text-xs font-extrabold text-emerald-600">₹1,250</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-pure-white flex items-center justify-center font-bold text-xs shrink-0">
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
                        {t('messyPath')}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-pure-white">
                        Too Many Payments
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
                  <p className="text-[10px] font-bold uppercase text-slate-500">{t('addBill')}</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">📸 Bill & UPI Photos</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-1/80 border border-brand-500/10 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">{t('offlineBadge')}</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">⚡ Auto Cloud Sync</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Dedicated Offline Support App Showcase Section */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-16 sm:mt-24 rounded-[32px] p-6 sm:p-10 border border-brand-500/25 bg-gradient-to-br from-violet-600/10 via-purple-500/5 to-emerald-500/10 backdrop-blur-xl shadow-xl"
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-800 mb-3">
              <WifiOff className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('offlineApp')}</span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Works 100% Offline, Everywhere You Travel
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl font-normal">
              {t('offlineAppDesc')}
            </p>
            {platform === 'android' && (
              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <Link
                  href="/download"
                  className="btn-brand inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold shadow-md hover:scale-105 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('downloadApk')}</span>
                </Link>
                <span className="text-xs font-semibold text-slate-500">
                  Direct safe APK download · No Play Store account needed
                </span>
              </div>
            )}
            {platform === 'ios' && (
              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <AppInstallLink
                  className="btn-brand inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold shadow-md hover:scale-105 transition-all"
                  iconClassName="w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-500">
                  Installs from your browser · No App Store needed
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <div className="p-4 rounded-2xl bg-pure-white/90 border border-brand-500/15 text-center shadow-sm">
              <Camera className="w-6 h-6 text-brand-600 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-900">Receipt Snap</p>
              <p className="text-[10px] text-slate-500">Compressed & offline</p>
            </div>
            <div className="p-4 rounded-2xl bg-pure-white/90 border border-brand-500/15 text-center shadow-sm">
              <QrCode className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-900">UPI Settle</p>
              <p className="text-[10px] text-slate-500">GPay, PhonePe, Paytm</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Feature Grid Below — Translated to all 20 Languages */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full"
      >
        {features.map((feat) => (
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
