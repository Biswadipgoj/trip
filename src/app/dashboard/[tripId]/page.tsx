'use client'
import React from 'react';

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { calculateNetBalances, formatCurrency, formatCompactINR, getCategoryColor, getCategoryIcon, getCategoryLabel } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CountUp } from '@/components/animations/CountUp'
import { FadeIn } from '@/components/animations/FadeIn'
import { ConfettiBlast } from '@/components/animations/ConfettiBlast'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, TrendingDown, Receipt, CheckCircle2,
  ArrowRight, Plus, Wallet, PiggyBank, HandCoins,
  ArrowUpRight, ArrowDownLeft, Pencil, Check, Sparkles
} from 'lucide-react'
import Link from 'next/link'

interface DashboardPageProps {
  params: Promise<{ tripId: string }>
}

// Premium gradient stat card — Cred/PhonePe-style tile with sheen + counter
function StatCard({
  id, gradient, icon: Icon, label, value, trend, trendUp, delay = 0, action,
}: {
  id: string
  gradient: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  trend?: string
  trendUp?: boolean | null
  delay?: number
  action?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      whileHover={{ y: -4, scale: 1.015 }}
      className={`liquid-sheen relative rounded-3xl p-5 ${gradient}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-2xl bg-pure-white/20 backdrop-blur-sm flex items-center justify-center">
          <Icon className="w-5 h-5 text-pure-white" />
        </div>
        {action}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-pure-white/70 mb-1">{label}</p>
      <p id={id} className="text-2xl font-bold text-pure-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        ₹<CountUp end={value} indian duration={1.4} />
      </p>
      {trend && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-pure-white/80">
          {trendUp === true && <TrendingUp className="w-3 h-3" />}
          {trendUp === false && <TrendingDown className="w-3 h-3" />}
          {trend}
        </p>
      )}
    </motion.div>
  )
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { tripId } = React.use(params)

  // Use raw store state + filter in useMemo to avoid React 19 getSnapshot infinite loop
  const trip = useStore(s => s.trips.find(t => t.id === tripId))
  const allMembers = useStore(s => s.members)
  const allExpenses = useStore(s => s.expenses)
  const allHotelExpenses = useStore(s => s.hotelExpenses)
  const allSettlements = useStore(s => s.settlements)
  const allGroups = useStore(s => s.settlementGroups)
  const allSponsorships = useStore(s => s.sponsorships)
  const session = useStore(s => s.session)
  const closeTrip = useStore(s => s.closeTrip)
  const setTripBudget = useStore(s => s.setTripBudget)
  const generateSettlements = useStore(s => s.generateSettlements)

  const members = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses = useMemo(() =>
    allExpenses
      .filter(e => e.tripId === tripId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allExpenses, tripId]
  )
  const hotelExpenses = useMemo(() => allHotelExpenses.filter(h => h.tripId === tripId), [allHotelExpenses, tripId])
  const settlements = useMemo(() => allSettlements.filter(s => s.tripId === tripId), [allSettlements, tripId])
  const groups = useMemo(() => allGroups.filter(g => g.tripId === tripId), [allGroups, tripId])
  const sponsorships = useMemo(() => allSponsorships.filter(s => s.tripId === tripId), [allSponsorships, tripId])

  // Recompute dues from the live data on entry — heals stale persisted
  // settlements from before the engine fix without waiting for a sync tick.
  useEffect(() => {
    generateSettlements(tripId)
  }, [tripId, generateSettlements])

  const [showCelebration, setShowCelebration] = useState(false)
  const [confettiFired, setConfettiFired] = useState(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  // Live balances: expense math minus confirmed transfers (group-aware), so
  // confirming a payment immediately updates every figure on this screen.
  const balances = useMemo(
    () => calculateNetBalances(expenses, hotelExpenses, members, settlements, groups, sponsorships),
    [expenses, hotelExpenses, members, settlements, groups, sponsorships]
  )

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0)
    + hotelExpenses.reduce((sum, h) => sum + h.totalAmount, 0)
  const settledCount = settlements.filter(s => s.status === 'confirmed').length
  const totalSettlements = settlements.length
  const isFullySettled = totalSettlements > 0 && settledCount === totalSettlements

  // ── "Your" numbers (session member) ──────────────────────────────────────────
  const myBalance = balances.find(b => b.memberId === session?.memberId)
  const myContribution = myBalance?.totalPaid ?? 0
  const amountOwed = settlements
    .filter(s => s.fromMemberId === session?.memberId && s.status !== 'confirmed')
    .reduce((sum, s) => sum + s.amount, 0)
  const amountReceivable = settlements
    .filter(s => s.toMemberId === session?.memberId && s.status !== 'confirmed')
    .reduce((sum, s) => sum + s.amount, 0)

  // ── Budget ───────────────────────────────────────────────────────────────────
  const budget = trip?.budget ?? 0
  const remainingBudget = budget - totalSpent
  const budgetUsedPct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0
  const overBudget = budget > 0 && totalSpent > budget

  const contributionPct = totalSpent > 0 ? (myContribution / totalSpent) * 100 : 0

  // Category breakdown for chart
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    expenses.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount
    })
    hotelExpenses.forEach(h => {
      cats['stay'] = (cats['stay'] || 0) + h.totalAmount
    })
    return Object.entries(cats).map(([name, value]) => ({
      name,
      value,
      color: getCategoryColor(name),
      icon: getCategoryIcon(name),
    }))
  }, [expenses, hotelExpenses])

  // Check for trip completion
  useEffect(() => {
    if (isFullySettled && trip?.status === 'active' && !confettiFired) {
      setShowCelebration(true)
      setConfettiFired(true)
      closeTrip(tripId)
    }
  }, [isFullySettled, trip, confettiFired, closeTrip, tripId])

  if (!trip) return null

  const saveBudget = () => {
    const val = parseFloat(budgetInput)
    if (val > 0) setTripBudget(tripId, val)
    setEditingBudget(false)
  }

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
              <h1 className="text-2xl font-bold text-gradient-brand" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {trip.name}
              </h1>
              <StatusBadge status={trip.status} />
            </div>
            <p className="text-white/40 text-sm">
              Code: <span className="font-mono text-brand-400">{trip.tripCode}</span>
              <span className="mx-1.5">·</span>{members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link href={`/expenses/${tripId}`} id="add-expense-btn" className="btn-brand flex items-center gap-1.5 text-sm py-2 px-4">
            <Plus className="w-4 h-4" />
            Add
          </Link>
        </div>
      </FadeIn>

      {/* Hero stat: Total Trip Cost */}
      <StatCard
        id="total-spent"
        gradient="grad-indigo-purple"
        icon={Wallet}
        label="Total Trip Cost"
        value={totalSpent}
        trend={`${expenses.length + hotelExpenses.length} expenses · avg ${formatCompactINR(members.length > 0 ? totalSpent / members.length : 0)}/person`}
        trendUp={null}
      />

      {/* Personal + budget stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          id="remaining-budget"
          gradient={overBudget ? 'grad-orange-pink' : 'grad-emerald-teal'}
          icon={PiggyBank}
          label={overBudget ? 'Over Budget' : 'Remaining Budget'}
          value={Math.abs(budget > 0 ? remainingBudget : 0)}
          trend={budget > 0 ? `${budgetUsedPct.toFixed(0)}% of ${formatCompactINR(budget)} used` : 'Tap ✎ to set a budget'}
          trendUp={budget > 0 ? !overBudget : null}
          delay={0.08}
          action={
            <button
              id="edit-budget-btn"
              onClick={() => { setBudgetInput(budget > 0 ? String(budget) : ''); setEditingBudget(true) }}
              className="w-7 h-7 rounded-full bg-pure-white/20 flex items-center justify-center hover:bg-pure-white/30 transition-colors"
              aria-label="Set budget"
            >
              <Pencil className="w-3.5 h-3.5 text-pure-white" />
            </button>
          }
        />
        <StatCard
          id="my-contribution"
          gradient="grad-blue-cyan"
          icon={HandCoins}
          label="Your Contribution"
          value={myContribution}
          trend={totalSpent > 0 ? `${contributionPct.toFixed(0)}% of trip spend` : 'No expenses yet'}
          trendUp={null}
          delay={0.16}
        />
        <StatCard
          id="amount-owed"
          gradient="grad-orange-pink"
          icon={ArrowUpRight}
          label="You Owe"
          value={amountOwed}
          trend={amountOwed > 0 ? 'Settle up to clear' : 'All clear 🎉'}
          trendUp={amountOwed > 0 ? false : null}
          delay={0.24}
        />
        <StatCard
          id="amount-receivable"
          gradient="grad-violet-fuchsia"
          icon={ArrowDownLeft}
          label="You'll Receive"
          value={amountReceivable}
          trend={amountReceivable > 0 ? 'Friends owe you' : 'Nothing pending'}
          trendUp={amountReceivable > 0 ? true : null}
          delay={0.32}
        />
      </div>

      {/* Budget edit inline panel */}
      <AnimatePresence>
        {editingBudget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassCard hover={false} className="p-4 flex items-center gap-3">
              <span className="text-sm text-white/60 flex-shrink-0">Trip budget ₹</span>
              <input
                id="budget-input"
                className="input-glass flex-1 py-2"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 50000"
                value={budgetInput}
                autoFocus
                onChange={e => setBudgetInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveBudget()}
              />
              <button id="save-budget-btn" onClick={saveBudget} className="btn-brand py-2 px-4 flex items-center gap-1.5 text-sm">
                <Check className="w-4 h-4" /> Save
              </button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget consumption meter */}
      {budget > 0 && (
        <FadeIn delay={0.3}>
          <GlassCard hover={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-white">Budget Consumption</span>
              </div>
              <span className={`text-xs font-bold ${overBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(totalSpent)} / {formatCurrency(budget)}
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${budgetUsedPct}%` }}
                transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  background: overBudget
                    ? 'linear-gradient(90deg, hsl(24,95%,56%), hsl(348,88%,56%))'
                    : 'linear-gradient(90deg, hsl(152,70%,40%), hsl(180,78%,38%))',
                }}
              />
            </div>
            {overBudget && (
              <p className="mt-2 text-xs text-red-400 font-medium">
                Over budget by {formatCurrency(totalSpent - budget)} — time to go easy on the shopping? 😅
              </p>
            )}
          </GlassCard>
        </FadeIn>
      )}

      {/* Settlement Progress */}
      {totalSettlements > 0 && (
        <FadeIn delay={0.35}>
          <GlassCard hover={false} className="p-5">
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
            <GlassCard hover={false} className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-400" />
                Expense Breakdown
              </h2>
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
                    {cat.icon} {getCategoryLabel(cat.name)}
                  </div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        )}

        {/* Recent Activity */}
        <FadeIn delay={0.45}>
          <GlassCard hover={false} className="p-5">
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
          <GlassCard hover={false} className="p-5">
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

      {/* Floating Add Expense button (mobile) */}
      <Link
        href={`/expenses/${tripId}`}
        id="fab-dashboard-add"
        className="lg:hidden fixed right-5 z-40 w-14 h-14 rounded-full grad-violet-fuchsia liquid-sheen flex items-center justify-center active:scale-90 transition-transform"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6 text-pure-white" />
      </Link>
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
          <p className="text-white/40 text-xs mb-8">Everyone&apos;s accounts are balanced. Great trip! 🎉</p>
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
