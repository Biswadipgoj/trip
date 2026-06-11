'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Receipt,
  CreditCard,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { useTripSync } from '@/hooks/useTripSync'
// Sync pill removed — clicking it opened the debug page; removed to disable that action

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

function getNavItems(tripId: string): NavItem[] {
  return [
    { href: `/dashboard/${tripId}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/members/${tripId}`,   label: 'Members',   icon: Users },
    { href: `/expenses/${tripId}`,  label: 'Expenses',  icon: Receipt },
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
  const trip = useStore(s => s.getTripById(tripId))
  const me = useStore(s => s.members.find(m => m.id === s.session?.memberId))
  const setSession = useStore(s => s.setSession)
  const navItems = getNavItems(tripId)

  // Cross-device sync: pull this trip's data from the cloud while in the app
  useTripSync(tripId)

  const handleLogout = () => {
    setSession(null)
    router.replace('/login')
  }

  return (
    <>
      {/* Mobile top bar — trip identity + logout */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-pure-white/85 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 px-4 h-14">
          <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-white/30 flex-shrink-0">
            <Image src="/logo.png" alt="TripMate" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {trip?.name || 'TripMate'}
            </p>
            <p className="text-[11px] text-white/65 truncate leading-tight">
              {me?.name ? `${me.name} · ` : ''}{session?.tripCode || ''}
            </p>
          </div>
          {/* Sync pill removed */}
          <button
            id="logout-btn-mobile"
            onClick={handleLogout}
            aria-label="Log out"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/20 active:scale-95 transition-transform"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>
      {/* In-flow spacer so page content clears the fixed mobile top bar */}
      <div className="lg:hidden h-14" />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-white/10 bg-surface-1/80 backdrop-blur-xl z-50 p-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-glow-sm ring-1 ring-white/40 flex-shrink-0">
            <Image src="/logo.png" alt="TripMate" width={36} height={36} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-white/60 font-medium">TripMate</p>
            <p className="text-sm font-semibold text-white truncate max-w-[140px]">
              {trip?.name || 'Loading...'}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-white/65 hover:text-white hover:bg-white/5'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-brand-600/30 border border-brand-500/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className={cn('w-4 h-4 relative z-10', isActive && 'text-brand-400')} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 mt-4 space-y-2">
          <div className="px-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-white/65">Logged in as</p>
              <p className="text-sm font-medium text-white truncate">
                {me?.name || session?.tripCode || '—'}
              </p>
            </div>
            {/* Sync pill removed */}
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav — safe-area aware so it stays stable on notched phones */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-pure-white/85 backdrop-blur-xl shadow-elevated"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl min-w-[52px]',
                  'transition-colors',
                  isActive ? 'text-white' : 'text-white/60 hover:text-white/70'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 rounded-xl bg-brand-600/25"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className={cn('w-5 h-5 relative z-10', isActive && 'text-brand-400')} />
                <span className="relative z-10 text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
