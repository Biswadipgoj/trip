'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Receipt,
  CreditCard,
  BarChart3,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { useTripSync } from '@/hooks/useTripSync'

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
  const session = useStore(s => s.session)
  const trip = useStore(s => s.getTripById(tripId))
  const navItems = getNavItems(tripId)

  // Cross-device sync: pull this trip's data from the cloud while in the app
  useTripSync(tripId)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-white/10 bg-surface-1/80 backdrop-blur-xl z-50 p-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-glow-sm ring-1 ring-white/40 flex-shrink-0">
            <Image src="/logo.png" alt="TripMate" width={36} height={36} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-white/40 font-medium">TripMate</p>
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
                    : 'text-white/50 hover:text-white hover:bg-white/5'
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
        <div className="border-t border-white/10 pt-4 mt-4">
          <div className="px-3 py-2">
            <p className="text-xs text-white/30">Logged in as</p>
            <p className="text-sm font-medium text-white/70 truncate">
              {session?.tripCode || '—'}
            </p>
          </div>
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
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
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
