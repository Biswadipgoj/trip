'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn, formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Receipt,
  CreditCard,
  BarChart3,
  LogOut,
  Copy,
  Check,
  Plus,
  Sparkles,
  Smartphone,
  ShieldCheck,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { useTripSync } from '@/hooks/useTripSync'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeKey?: 'expenses' | 'members'
}

function getNavItems(tripId: string): NavItem[] {
  return [
    { href: `/dashboard/${tripId}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/members/${tripId}`,   label: 'Members',   icon: Users, badgeKey: 'members' },
    { href: `/expenses/${tripId}`,  label: 'Expenses',  icon: Receipt, badgeKey: 'expenses' },
    { href: `/payments/${tripId}`,  label: 'Payments',  icon: CreditCard },
    { href: `/report/${tripId}`,    label: 'Report',    icon: BarChart3 },
  ]
}

interface AppNavProps {
  tripId: string
}

export function AppNav({ tripId }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const session = useStore(s => s.session)
  const allTrips = useStore(s => s.trips)
  const allMembers = useStore(s => s.members)
  const allExpenses = useStore(s => s.expenses)
  const allSettlements = useStore(s => s.settlements)
  const setSession = useStore(s => s.setSession)

  const trip = React.useMemo(() => allTrips.find(t => t.id === tripId), [allTrips, tripId])
  const me = React.useMemo(() => allMembers.find(m => m.id === session?.memberId), [allMembers, session?.memberId])
  const members = React.useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses = React.useMemo(() => allExpenses.filter(e => e.tripId === tripId), [allExpenses, tripId])
  const settlements = React.useMemo(() => allSettlements.filter(st => st.tripId === tripId), [allSettlements, tripId])
  const navItems = React.useMemo(() => getNavItems(tripId), [tripId])

  const [copiedCode, setCopiedCode] = useState(false)

  // Cross-device sync: pull this trip's data from the cloud while in the app
  useTripSync(tripId)

  const handleLogout = () => {
    setSession(null)
    router.replace('/login')
  }

  const handleCopyCode = async () => {
    if (!session?.tripCode) return
    try {
      await navigator.clipboard.writeText(session.tripCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2200)
    } catch {
      // Fallback
    }
  }

  // Calculate quick metrics for desktop sidebar
  const totalSpend = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const pendingDues = settlements.filter(s => s.status !== 'confirmed' && s.status !== 'paid').length

  return (
    <>
      {/* =========================================================================
          MOBILE TOP BAR — Crisp, high-contrast, trip identity & quick logout
         ========================================================================= */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 border-b border-brand-500/15 bg-pure-white/90 backdrop-blur-2xl shadow-sm">
        <div className="flex items-center gap-2.5 px-4 h-14">
          <Link href={`/dashboard/${tripId}`} className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-brand-500/20 flex-shrink-0 active:scale-95 transition-transform">
            <Image src="/logo.png" alt="TripMate" width={32} height={32} className="w-full h-full object-cover" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate leading-tight">
              {trip?.name || 'TripMate'}
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate leading-tight flex items-center gap-1.5">
              <span>{me?.name ? `${me.name} · ` : ''}</span>
              <span className="font-mono bg-brand-500/10 text-brand-700 px-1 rounded">{session?.tripCode || ''}</span>
            </p>
          </div>

          <button
            id="logout-btn-mobile"
            onClick={handleLogout}
            aria-label="Log out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-transform"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </header>

      {/* In-flow spacer for mobile top bar */}
      <div className="lg:hidden h-14" />

      {/* =========================================================================
          DESKTOP SIDEBAR — Separate, highly animated, playful industry standard
         ========================================================================= */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-72 border-r border-brand-500/15 bg-pure-white/85 backdrop-blur-2xl z-50 p-5 shadow-sm">
        {/* Brand & Floating Icon */}
        <div className="flex items-center gap-3 px-1 py-2 mb-4">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, -5, 0], scale: 1.08 }}
            transition={{ duration: 0.5 }}
            className="w-10 h-10 rounded-2xl overflow-hidden shadow-glow-sm ring-1 ring-brand-500/30 flex-shrink-0 cursor-pointer"
          >
            <Image src="/logo.png" alt="TripMate" width={40} height={40} className="w-full h-full object-cover" />
          </motion.div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                TripMate
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-600/10 text-brand-600 border border-brand-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Cloud Live Sync
            </p>
          </div>
        </div>

        {/* Current Trip Card & 1-Click Code Copy */}
        <motion.div
          whileHover={{ y: -2 }}
          className="mb-4 p-3 rounded-2xl bg-surface-1/90 border border-brand-500/15 shadow-sm"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Trip</span>
            <button
              onClick={handleCopyCode}
              title="Copy Trip Invite Code"
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all',
                copiedCode
                  ? 'bg-emerald-500 text-pure-white shadow-sm'
                  : 'bg-brand-600/10 text-brand-700 hover:bg-brand-600/20 active:scale-95'
              )}
            >
              {copiedCode ? (
                <>
                  <Check className="w-3 h-3 text-pure-white" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="font-mono">{session?.tripCode || 'CODE'}</span>
                </>
              )}
            </button>
          </div>
          <p className="text-sm font-bold text-slate-900 truncate">
            {trip?.name || 'My Trip'}
          </p>

          {/* Mini Real-time Trip Metrics */}
          <div className="mt-3 pt-2.5 border-t border-brand-500/10 flex items-center justify-between text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Total Spent</span>
              <span className="font-bold text-slate-900">₹{totalSpend.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">Settlement</span>
              <span className={cn('font-bold', pendingDues === 0 ? 'text-emerald-600' : 'text-amber-600')}>
                {pendingDues === 0 ? '🎉 All Settled' : `${pendingDues} Dues Pending`}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Quick Add Expense Action */}
        <Link
          href={`/expenses/${tripId}`}
          className="mb-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-pure-white bg-gradient-brand shadow-glow-sm hover:shadow-glow-brand hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 text-pure-white stroke-[2.5]" />
          <span>Add Expense</span>
        </Link>

        {/* Main Desktop Navigation Items with Spring Hover & Active Glances */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {navItems.map(item => {
            const isActive = pathname === item.href
            const badgeValue = item.badgeKey === 'expenses' ? expenses.length : item.badgeKey === 'members' ? members.length : null

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'text-brand-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:translate-x-1 hover:bg-brand-500/5'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="desktop-sidebar-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-600/15 via-brand-500/20 to-brand-400/10 border border-brand-500/30 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <div className="flex items-center gap-3 relative z-10">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                    isActive ? 'bg-brand-600 text-pure-white shadow-glow-sm' : 'bg-surface-2/80 text-slate-600 group-hover:bg-brand-500/15 group-hover:text-brand-600'
                  )}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="relative z-10">{item.label}</span>
                </div>

                {badgeValue !== null && (
                  <span className={cn(
                    'relative z-10 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors',
                    isActive
                      ? 'bg-brand-600 text-pure-white shadow-sm'
                      : 'bg-surface-2 text-slate-600 group-hover:bg-brand-500/10 group-hover:text-brand-600'
                  )}>
                    {badgeValue}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Desktop Sidebar Footer & User Profile */}
        <div className="border-t border-brand-500/15 pt-3.5 mt-auto space-y-2">
          {/* User Profile Card */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-surface-1/70 border border-brand-500/10">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-pure-white flex items-center justify-center font-bold text-sm shadow-sm">
                {me?.name ? me.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-pure-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {me?.name || 'Member'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                {trip?.creatorId === session?.memberId ? 'Trip Admin 👑' : 'Group Member'}
              </p>
            </div>
          </div>

          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MOBILE FROZEN BOTTOM NAVIGATION DOCK — "ALL 5 BUTTON FREEZING UNDER ALL"
          Fixed at bottom-0, high z-index, elevated frosted glass, tactile spring bounce
         ========================================================================= */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-[60] border-t border-brand-500/20 bg-pure-white/95 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(108,62,200,0.14)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  'relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl min-w-[56px] transition-all',
                  'active:scale-90 select-none'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-frozen-nav-active"
                    className="absolute inset-0 rounded-2xl bg-brand-600/15 border border-brand-500/25 shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <div className={cn(
                  'relative z-10 transition-transform duration-200',
                  isActive ? 'scale-110 text-brand-600' : 'text-slate-500 hover:text-slate-800'
                )}>
                  <item.icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className={cn(
                  'relative z-10 text-[10px] mt-1 tracking-tight transition-colors',
                  isActive ? 'font-extrabold text-brand-700' : 'font-medium text-slate-500'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-dot"
                    className="w-1.5 h-1.5 rounded-full bg-brand-600 shadow-glow-sm mt-0.5"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
