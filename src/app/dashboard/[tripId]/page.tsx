'use client'
import React from 'react';

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { calculateBalances, formatCurrency, getCategoryColor, getCategoryIcon } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CountUp } from '@/components/animations/CountUp'
import { FadeIn, StaggerList } from '@/components/animations/FadeIn'
import { ConfettiBlast } from '@/components/animations/ConfettiBlast'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, Users, Receipt, CheckCircle2,
  Clock, ArrowRight, Plus, Trophy, Wallet
} from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface DashboardPageProps {
  params: Promise<{ tripId: string }>
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { tripId } = React.use(params)
  const router = useRouter()

  // Use raw store state + filter in useMemo to avoid React 19 getSnapshot infinite loop
  const trip = useStore(s => s.trips.find(t => t.id === tripId))
  const allMembers = useStore(s => s.members)
  const allExpenses = useStore(s => s.expenses)
  const allHotelExpenses = useStore(s => s.hotelExpenses)
  const allSettlements = useStore(s => s.settlements)
  const session = useStore(s => s.session)
  const closeTrip = useStore(s => s.closeTrip)

  const members = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses = useMemo(() =>
    allExpenses
      .filter(e => e.tripId === tripId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allExpenses, tripId]
  )
  const hotelExpenses = useMemo(() => allHotelExpenses.filter(h => h.tripId === tripId), [allHotelExpenses, tripId])
  const settlements = useMemo(() => allSettlements.filter(s => s.tripId === tripId), [allSettlements, tripId])

  const [showCelebration, setShowCelebration] = useState(false)
  const [confettiFired, setConfettiFired] = useState(false)

  const balances = useMemo(() => calculateBalances(expenses, hotelExpenses, members), [expenses, hotelExpenses, members])

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0)
    + hotelExpenses.reduce((sum, h) => sum + h.totalAmount, 0)
  const settledCount = settlements.filter(s => s.status === 'confirmed').length
  const totalSettlements = settlements.length
  const isFullySettled = totalSettlements > 0 && settledCount === totalSettlements

  // Category breakdown for chart
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    expenses.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount
    })
    return Object.entries(cats).map(([name, value]) => ({
      name,
      value,
      color: getCategoryColor(name),
      icon: getCategoryIcon(name),
    }))
  }, [expenses])

  // Check for trip completion
  useEffect(() => {
    if (isFullySettled && trip?.status === 'active' && !confettiFired) {
      setShowCelebration(true)
      setConfettiFired(true)
      closeTrip(tripId)
    }
  }, [isFullySettled, trip, confettiFired, closeTrip, tripId])

  if (!trip) return null

  const kpiCards = [
    {
      id: 'total-spent',
      icon: Wallet,
      label: 'Total Spent',
      value: totalSpent,
      color: 'hsl(262, 83%, 58%)',
      prefix: '₹',
    },
    {
      id: 'total-members',
      icon: Users,
      label: 'Members',
      value: members.length,
      color: 'hsl(310, 75%, 55%)',
      prefix: '',
    },
    {
      id: 'total-expenses',
      icon: Receipt,
      label: 'Expenses',
      value: expenses.length,
      color: 'hsl(25, 80%, 55%)',
      prefix: '',
    },
    {
      id: 'settled-count',
      icon: CheckCircle2,
      label: 'Settled',
      value: settledCount,
      color: 'hsl(168, 76%, 38%)',
      prefix: '',
      suffix: `/${totalSettlements}`,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <TripClosedOverlay onDismiss={() => setShowCelebration(false)} tripName={trip.name} />
        )}
      </AnimatePresence>

      <ConfettiBlast trigger={showCelebration} type="celebration" />

      {/* Header */}
      <FadeIn>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {trip.name}
              </h1>
              <StatusBadge status={trip.status} />
            </div>
            <p className="text-white/40 text-sm">Code: <span className="font-mono text-brand-400">{trip.tripCode}</span></p>
          </div>
          <Link href={`/expenses/${tripId}`} id="add-expense-btn" className="btn-brand flex items-center gap-1.5 text-sm py-2 px-4">
            <Plus className="w-4 h-4" />
            Add
          </Link>
        </div>
      </FadeIn>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {kpiCards.map((card, i) => (
          <FadeIn key={card.id} delay={i * 0.07}>
            <GlassCard hover className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${card.color}20` }}
                >
                  <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                </div>
                <span className="text-xs text-white/50 font-medium">{card.label}</span>
              </div>
              <div className="text-2xl font-bold text-white" id={card.id}>
                <span>{card.prefix}</span>
                <CountUp end={card.value} decimals={card.prefix === '₹' ? 0 : 0} duration={1.2} />
                {card.suffix && <span className="text-sm text-white/40">{card.suffix}</span>}
              </div>
            </GlassCard>
          </FadeIn>
        ))}
      </div>

      {/* Settlement Progress */}
      {totalSettlements > 0 && (
        <FadeIn delay={0.35}>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-white">Settlement Progress</span>
              </div>
              <span className="text-xs text-white/40">{settledCount} of {totalSettlements} confirmed</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(settledCount / totalSettlements) * 100}%` }}
                transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, hsl(262,83%,58%), hsl(168,76%,38%))' }}
              />
            </div>
            {isFullySettled && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-xs text-emerald-400 font-medium flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                All settled! Trip is complete.
              </motion.p>
            )}
          </GlassCard>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category Chart */}
        {categoryData.length > 0 && (
          <FadeIn delay={0.4}>
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Expense Breakdown</h2>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={200}
                    animationDuration={900}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      background: '#fffdf8',
                      border: '1px solid rgba(139,78,245,0.16)',
                      borderRadius: 12,
                      color: 'hsl(262, 32%, 18%)',
                      fontSize: 12,
                      boxShadow: '0 8px 24px rgba(139,78,245,0.16)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {categoryData.map(cat => (
                  <div key={cat.name} className="flex items-center gap-1.5 text-xs text-white/60">
                    <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                    {cat.icon} {cat.name}
                  </div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        )}

        {/* Recent Activity */}
        <FadeIn delay={0.45}>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Recent Expenses</h2>
              <Link href={`/expenses/${tripId}`} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {expenses.length === 0 ? (
              <div className="text-center py-6">
                <Receipt className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm">No expenses yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.slice(0, 4).map((expense, i) => {
                  const payer = members.find(m => m.id === expense.paidBy)
                  return (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.06 }}
                      className="flex items-center gap-3"
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: `${getCategoryColor(expense.category)}20` }}
                      >
                        {getCategoryIcon(expense.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{expense.title}</p>
                        <p className="text-xs text-white/40">{payer?.name}</p>
                      </div>
                      <span className="text-sm font-semibold text-white">{formatCurrency(expense.amount)}</span>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </GlassCard>
        </FadeIn>
      </div>

      {/* Member Balances Quick View */}
      {balances.length > 0 && (
        <FadeIn delay={0.5}>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Member Balances</h2>
              <Link href={`/members/${tripId}`} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                Full view <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {balances.map((b, i) => (
                <motion.div
                  key={b.memberId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <Avatar name={b.name} color={b.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{b.name}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        b.netBalance > 0
                          ? 'text-emerald-400'
                          : b.netBalance < 0
                          ? 'text-red-400'
                          : 'text-white/40'
                      }`}
                    >
                      {b.netBalance > 0 ? '+' : ''}
                      {formatCurrency(b.netBalance)}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {b.netBalance > 0 ? 'gets back' : b.netBalance < 0 ? 'owes' : 'settled'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      )}
    </div>
  )
}

// Trip Closed Overlay
function TripClosedOverlay({ onDismiss, tripName }: { onDismiss: () => void; tripName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong rounded-3xl p-10 text-center max-w-sm mx-4"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-6xl mb-4"
        >
          🏆
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            TRIP SUCCESSFULLY CLOSED
          </h2>
          <p className="text-white/60 text-sm mb-2">
            <strong className="text-white">{tripName}</strong> is fully settled!
          </p>
          <p className="text-white/40 text-xs mb-8">Everyone's accounts are balanced. Great trip! 🎉</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col gap-3"
        >
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 mx-auto">
            <CheckCircle2 className="w-4 h-4" />
            All Payments Confirmed
          </div>
          <button onClick={onDismiss} id="close-celebration-btn" className="btn-brand mx-auto px-8">
            Back to Dashboard
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
