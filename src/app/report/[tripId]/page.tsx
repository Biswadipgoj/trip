'use client'
import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import {
  calculateNetBalances, calculateSettlements, formatCurrency, formatCompactINR,
  formatDate, getCategoryColor, getCategoryIcon, getCategoryLabel,
  getCategoryGradient, getSubcategoryLabel, SUBCATEGORIES,
} from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { FadeIn } from '@/components/animations/FadeIn'
import { CountUp } from '@/components/animations/CountUp'
import {
  BarChart3, Download, Users, Receipt, CheckCircle2, TrendingUp,
  Flame, Trophy, CalendarDays, Lightbulb, PiggyBank, Crown, Zap, Medal,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
} from 'recharts'

interface ReportPageProps {
  params: Promise<{ tripId: string }>
}

const tooltipStyle = {
  background: '#fffdf8',
  border: '1px solid rgba(139,78,245,0.16)',
  borderRadius: 12,
  color: 'hsl(262, 32%, 18%)',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(139,78,245,0.16)',
}

// SVG progress ring used in member analytics cards
function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const stroke = 5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(pct, 100))
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(139,78,245,0.12)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (clamped / 100) * circ }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  )
}

export default function ReportPage({ params }: ReportPageProps) {
  const { tripId } = React.use(params)

  const trip          = useStore(s => s.trips.find(t => t.id === tripId))
  const allMembers       = useStore(s => s.members)
  const allExpenses      = useStore(s => s.expenses)
  const allHotelExpenses = useStore(s => s.hotelExpenses)
  const allGroups        = useStore(s => s.settlementGroups)
  const allSponsorships  = useStore(s => s.sponsorships)
  const allSettlements   = useStore(s => s.settlements)

  const members       = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses      = useMemo(() => allExpenses.filter(e => e.tripId === tripId), [allExpenses, tripId])
  const hotelExpenses = useMemo(() => allHotelExpenses.filter(h => h.tripId === tripId), [allHotelExpenses, tripId])
  const groups        = useMemo(() => allGroups.filter(g => g.tripId === tripId), [allGroups, tripId])
  const sponsorships  = useMemo(() => allSponsorships.filter(s => s.tripId === tripId), [allSponsorships, tripId])
  const settlements   = useMemo(() => allSettlements.filter(s => s.tripId === tripId), [allSettlements, tripId])

  // totalPaid/totalOwed stay expense-based; netBalance is adjusted by
  // confirmed payments so the report matches the live settlement state.
  const balances = useMemo(
    () => calculateNetBalances(expenses, hotelExpenses, members, settlements),
    [expenses, hotelExpenses, members, settlements]
  )

  const routes = useMemo(
    () => calculateSettlements(balances, members, groups, sponsorships),
    [balances, members, groups, sponsorships]
  )

  // ── Category data (hotel bookings count as "stay") ───────────────────────────
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
    hotelExpenses.forEach(h => { cats['stay'] = (cats['stay'] || 0) + h.totalAmount })
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name), icon: getCategoryIcon(name) }))
      .sort((a, b) => b.value - a.value)
  }, [expenses, hotelExpenses])

  // ── Subcategory breakdown (Budget Allocation) ─────────────────────────────────
  const subcategoryData = useMemo(() => {
    const byCategory: Record<string, { total: number; subs: Record<string, number> }> = {}
    const bump = (cat: string, sub: string | undefined, amt: number) => {
      const entry = (byCategory[cat] ||= { total: 0, subs: {} })
      entry.total += amt
      const key = sub || '_other'
      entry.subs[key] = (entry.subs[key] || 0) + amt
    }
    expenses.forEach(e => bump(e.category, e.subcategory, e.amount))
    hotelExpenses.forEach(h => bump('stay', 'hotel', h.totalAmount))
    return Object.entries(byCategory)
      .map(([cat, data]) => ({
        category: cat,
        total: data.total,
        subs: Object.entries(data.subs)
          .map(([sub, value]) => ({
            sub,
            value,
            label: sub === '_other' ? 'General' : (getSubcategoryLabel(cat, sub) || sub),
          }))
          .sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses, hotelExpenses])

  const memberSpendData = useMemo(() =>
    balances.map(b => ({
      name: b.name.split(' ')[0],
      paid: b.totalPaid,
      owed: b.totalOwed,
      color: b.avatarColor,
    })),
    [balances]
  )

  const totalSpend     = expenses.reduce((s, e) => s + e.amount, 0)
    + hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)
  const settledCount   = settlements.filter(s => s.status === 'confirmed').length
  const perPersonAvg   = members.length > 0 ? totalSpend / members.length : 0
  const budget         = trip?.budget ?? 0
  const budgetUsedPct  = budget > 0 ? (totalSpend / budget) * 100 : 0

  // ── Daily spending ────────────────────────────────────────────────────────────
  const dailySpend = useMemo(() => {
    const days: Record<string, number> = {}
    const add = (dateStr: string, amt: number) => {
      const key = new Date(dateStr).toISOString().slice(0, 10)
      days[key] = (days[key] || 0) + amt
    }
    expenses.forEach(e => add(e.createdAt, e.amount))
    hotelExpenses.forEach(h => add(h.createdAt, h.totalAmount))
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        total,
      }))
  }, [expenses, hotelExpenses])

  // ── Member analytics ──────────────────────────────────────────────────────────
  const memberAnalytics = useMemo(() => {
    return balances.map(b => {
      const expenseCount =
        expenses.filter(e =>
          e.payers && e.payers.length > 0
            ? e.payers.some(p => p.memberId === b.memberId)
            : e.paidBy === b.memberId
        ).length +
        hotelExpenses.filter(h => h.paidBy === b.memberId).length
      return {
        ...b,
        expenseCount,
        contributionPct: totalSpend > 0 ? (b.totalPaid / totalSpend) * 100 : 0,
      }
    }).sort((a, b) => b.totalPaid - a.totalPaid)
  }, [balances, expenses, hotelExpenses, totalSpend])

  // ── Smart insights ────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: React.ReactNode; text: React.ReactNode; id: string }[] = []
    if (totalSpend <= 0) return list

    const topCat = categoryData[0]
    if (topCat) {
      const pct = ((topCat.value / totalSpend) * 100).toFixed(0)
      list.push({
        id: 'top-category',
        icon: <span className="text-base">{topCat.icon}</span>,
        text: <><strong className="capitalize">{getCategoryLabel(topCat.name)}</strong> consumed <strong>{pct}%</strong> of total spend ({formatCompactINR(topCat.value)}).</>,
      })
    }

    if (budget > 0) {
      const diffPct = Math.abs(budgetUsedPct - 100).toFixed(0)
      list.push({
        id: 'budget',
        icon: <PiggyBank className="w-4 h-4 text-emerald-400" />,
        text: budgetUsedPct > 100
          ? <>Trip is <strong className="text-red-400">{diffPct}% over</strong> the planned budget of {formatCompactINR(budget)}.</>
          : <><strong>{budgetUsedPct.toFixed(0)}%</strong> of the {formatCompactINR(budget)} budget used — {formatCompactINR(budget - totalSpend)} remaining.</>,
      })
    }

    const activeDays = dailySpend.length
    if (activeDays > 0) {
      list.push({
        id: 'avg-day',
        icon: <CalendarDays className="w-4 h-4 text-brand-400" />,
        text: <>Average spend per day is <strong>{formatCurrency(totalSpend / activeDays)}</strong> across {activeDays} spending day{activeDays !== 1 ? 's' : ''}.</>,
      })
    }

    if (members.length > 0) {
      list.push({
        id: 'avg-member',
        icon: <Users className="w-4 h-4 text-sky-500" />,
        text: <>Average spend per member is <strong>{formatCurrency(perPersonAvg)}</strong>.</>,
      })
    }

    const topSpender = memberAnalytics[0]
    if (topSpender && topSpender.totalPaid > 0) {
      list.push({
        id: 'top-spender',
        icon: <Crown className="w-4 h-4 text-amber-500" />,
        text: <><strong>{topSpender.name}</strong> is the biggest spender — paid {formatCurrency(topSpender.totalPaid)} ({topSpender.contributionPct.toFixed(0)}% of the trip).</>,
      })
    }

    const mostActive = [...memberAnalytics].sort((a, b) => b.expenseCount - a.expenseCount)[0]
    if (mostActive && mostActive.expenseCount > 0) {
      list.push({
        id: 'most-active',
        icon: <Zap className="w-4 h-4 text-fuchsia-500" />,
        text: <><strong>{mostActive.name}</strong> is the most active contributor with {mostActive.expenseCount} expense{mostActive.expenseCount !== 1 ? 's' : ''} added.</>,
      })
    }

    const allItems = [
      ...expenses.map(e => ({ title: e.title, amount: e.amount })),
      ...hotelExpenses.map(h => ({ title: h.title, amount: h.totalAmount })),
    ].sort((a, b) => b.amount - a.amount)
    if (allItems[0]) {
      list.push({
        id: 'biggest',
        icon: <Flame className="w-4 h-4 text-orange-500" />,
        text: <>Single biggest expense: <strong>{allItems[0].title}</strong> at {formatCurrency(allItems[0].amount)}.</>,
      })
    }

    return list
  }, [totalSpend, categoryData, budget, budgetUsedPct, dailySpend, members.length, perPersonAvg, memberAnalytics, expenses, hotelExpenses])

  // ── Expense timeline (grouped by day, newest first) ──────────────────────────
  const timeline = useMemo(() => {
    const items = [
      ...expenses.map(e => ({
        id: e.id, title: e.title, amount: e.amount, category: e.category,
        subcategory: e.subcategory, paidBy: e.paidBy, createdAt: e.createdAt,
      })),
      ...hotelExpenses.map(h => ({
        id: h.id, title: h.title, amount: h.totalAmount, category: 'stay' as const,
        subcategory: undefined as string | undefined, paidBy: h.paidBy, createdAt: h.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const byDay: { day: string; items: typeof items; total: number }[] = []
    items.forEach(item => {
      const day = formatDate(item.createdAt)
      const last = byDay[byDay.length - 1]
      if (last && last.day === day) {
        last.items.push(item)
        last.total += item.amount
      } else {
        byDay.push({ day, items: [item], total: item.amount })
      }
    })
    return byDay
  }, [expenses, hotelExpenses])

  const handleExport = async () => {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(20)
    doc.text(`Trip Report: ${trip?.name || tripId}`, 14, y); y += 10

    doc.setFontSize(11)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, y); y += 10
    doc.text(`Status: ${trip?.status || 'active'}`, 14, y); y += 14

    doc.setFontSize(13)
    doc.text('Summary', 14, y); y += 8
    doc.setFontSize(10)
    doc.text(`Total Expenses: ${formatCurrency(totalSpend)}`, 14, y); y += 6
    doc.text(`Members: ${members.length}`, 14, y); y += 6
    doc.text(`Avg per person: ${formatCurrency(perPersonAvg)}`, 14, y); y += 6
    if (budget > 0) { doc.text(`Budget: ${formatCurrency(budget)} (${budgetUsedPct.toFixed(0)}% used)`, 14, y); y += 6 }
    y += 6

    doc.setFontSize(13)
    doc.text('Category Breakdown', 14, y); y += 8
    doc.setFontSize(10)
    categoryData.forEach(c => {
      doc.text(`${getCategoryLabel(c.name)}: ${formatCurrency(c.value)} (${((c.value / totalSpend) * 100).toFixed(0)}%)`, 14, y)
      y += 6
    })
    y += 6

    doc.setFontSize(13)
    doc.text('Member Balances', 14, y); y += 8
    doc.setFontSize(10)
    balances.forEach(b => {
      const sign = b.netBalance > 0 ? '+' : ''
      doc.text(`${b.name}: paid ${formatCurrency(b.totalPaid)}, owes ${formatCurrency(b.totalOwed)}, net ${sign}${formatCurrency(b.netBalance)}`, 14, y)
      y += 6
    })
    y += 6

    doc.setFontSize(13)
    doc.text('Settlements', 14, y); y += 8
    doc.setFontSize(10)
    routes.forEach(r => {
      doc.text(`${r.fromName} → ${r.toName}: ${formatCurrency(r.amount)}`, 14, y); y += 6
    })

    doc.save(`trip-report-${trip?.name || tripId}.pdf`)
  }

  const rankMedal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl grad-indigo-purple liquid-sheen flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-pure-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient-brand" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Trip Analytics
              </h1>
              <p className="text-white/40 text-sm">{trip?.name}</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="btn-ghost flex items-center gap-1.5 text-sm py-2 px-4"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </FadeIn>

      {/* KPI row — gradient tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'kpi-total',   icon: Receipt,      label: 'Total Spend', value: formatCompactINR(totalSpend),         grad: 'grad-indigo-purple' },
          { id: 'kpi-members', icon: Users,        label: 'Members',     value: String(members.length),               grad: 'grad-blue-cyan' },
          { id: 'kpi-avg',     icon: TrendingUp,   label: 'Per Person',  value: formatCompactINR(perPersonAvg),       grad: 'grad-orange-pink' },
          { id: 'kpi-settled', icon: CheckCircle2, label: 'Settled',     value: `${settledCount}/${routes.length}`,   grad: 'grad-emerald-teal' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className={`liquid-sheen rounded-2xl p-4 ${kpi.grad}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-pure-white/20 flex items-center justify-center">
                <kpi.icon className="w-3.5 h-3.5 text-pure-white" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-pure-white/70">{kpi.label}</span>
            </div>
            <p id={kpi.id} className="text-xl font-bold text-pure-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {kpi.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Budget consumption meter */}
      {budget > 0 && (
        <FadeIn delay={0.15}>
          <GlassCard hover={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <PiggyBank className="w-4 h-4 text-emerald-500" />
                Budget Consumption
              </h2>
              <span className={`text-xs font-bold ${budgetUsedPct > 100 ? 'text-red-400' : 'text-emerald-400'}`}>
                {budgetUsedPct.toFixed(0)}% used
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                className="h-full rounded-full"
                style={{
                  background: budgetUsedPct > 100
                    ? 'linear-gradient(90deg, hsl(24,95%,56%), hsl(348,88%,56%))'
                    : budgetUsedPct > 75
                    ? 'linear-gradient(90deg, hsl(38,95%,52%), hsl(24,95%,56%))'
                    : 'linear-gradient(90deg, hsl(152,70%,40%), hsl(180,78%,38%))',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>Spent: <strong className="text-white">{formatCurrency(totalSpend)}</strong></span>
              <span>Budget: <strong className="text-white">{formatCurrency(budget)}</strong></span>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* Smart Insights */}
      {insights.length > 0 && (
        <FadeIn delay={0.2}>
          <GlassCard hover={false} className="p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Smart Insights
            </h2>
            <div className="space-y-2.5">
              {insights.map((ins, i) => (
                <motion.div
                  key={ins.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.07 }}
                  className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5"
                >
                  <div className="flex-shrink-0 mt-0.5">{ins.icon}</div>
                  <p className="text-xs text-white/70 leading-relaxed">{ins.text}</p>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut: category-wise spending */}
        {categoryData.length > 0 && (
          <FadeIn delay={0.25}>
            <GlassCard hover={false} className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Category-wise Spending</h2>
              <div className="relative">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={56} outerRadius={82} paddingAngle={3} dataKey="value">
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Total</p>
                  <p className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {formatCompactINR(totalSpend)}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                {categoryData.map(cat => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="text-xs text-white/60 flex-1">{cat.icon} {getCategoryLabel(cat.name)}</span>
                    <span className="text-xs font-medium text-white">{formatCurrency(cat.value)}</span>
                    <span className="text-[10px] text-white/30 w-10 text-right">
                      {totalSpend > 0 ? `${((cat.value / totalSpend) * 100).toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        )}

        {/* Bar: daily spending */}
        {dailySpend.length > 0 && (
          <FadeIn delay={0.3}>
            <GlassCard hover={false} className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Daily Spending</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailySpend} barCategoryGap="25%">
                  <defs>
                    <linearGradient id="dailyBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(262,83%,58%)" />
                      <stop offset="100%" stopColor="hsl(310,80%,56%)" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: 'rgba(58,40,110,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Spent']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(139,78,245,0.06)' }} />
                  <Bar dataKey="total" fill="url(#dailyBarGradient)" radius={[8, 8, 2, 2]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </FadeIn>
        )}
      </div>

      {/* Budget Allocation — category → subcategory breakdown */}
      {subcategoryData.length > 0 && (
        <FadeIn delay={0.32}>
          <GlassCard hover={false} className="p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Budget Allocation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subcategoryData.map((cat, i) => (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm text-pure-white"
                        style={{ background: getCategoryGradient(cat.category) }}
                      >
                        {getCategoryIcon(cat.category)}
                      </div>
                      <span className="text-sm font-semibold text-white">{getCategoryLabel(cat.category)}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCompactINR(cat.total)}</p>
                      <p className="text-[10px] text-white/30">{totalSpend > 0 ? ((cat.total / totalSpend) * 100).toFixed(0) : 0}% of trip</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {cat.subs.map(sub => (
                      <div key={sub.sub} className="flex items-center gap-2">
                        <span className="text-xs text-white/60 flex-1 truncate">{sub.label}</span>
                        <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cat.total > 0 ? (sub.value / cat.total) * 100 : 0}%` }}
                            transition={{ duration: 0.9, delay: 0.5 }}
                            className="h-full rounded-full"
                            style={{ background: getCategoryGradient(cat.category) }}
                          />
                        </div>
                        <span className="text-xs font-medium text-white w-16 text-right">{formatCompactINR(sub.value)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
            {expenses.every(e => !e.subcategory) && expenses.length > 0 && (
              <p className="mt-3 text-[10px] text-white/30">
                Tip: pick a subcategory (Breakfast, Train, Hotel…) when adding expenses for a finer breakdown.
              </p>
            )}
          </GlassCard>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Member contribution chart */}
        {memberSpendData.length > 0 && (
          <FadeIn delay={0.35}>
            <GlassCard hover={false} className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Member Contribution</h2>
              <ResponsiveContainer width="100%" height={Math.max(160, memberSpendData.length * 44)}>
                <BarChart data={memberSpendData} layout="vertical" barCategoryGap="28%">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(58,40,110,0.7)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(139,78,245,0.06)' }} />
                  <Bar dataKey="paid" name="Paid" radius={[0, 8, 8, 0]} animationDuration={900}>
                    {memberSpendData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </FadeIn>
        )}

        {/* Category ranking */}
        {categoryData.length > 0 && (
          <FadeIn delay={0.4}>
            <GlassCard hover={false} className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-amber-500" />
                Category Ranking
              </h2>
              <div className="space-y-3">
                {categoryData.map((cat, i) => (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.06 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-7 text-center text-sm font-bold text-white/60 flex-shrink-0">{rankMedal(i)}</span>
                    <span className="text-sm flex-shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white">{getCategoryLabel(cat.name)}</span>
                        <span className="text-xs font-semibold text-white">{formatCurrency(cat.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(cat.value / categoryData[0].value) * 100}%` }}
                          transition={{ duration: 0.9, delay: 0.5 + i * 0.06, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: getCategoryGradient(cat.name) }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        )}
      </div>

      {/* Member Analytics — gradient cards with progress rings */}
      {memberAnalytics.length > 0 && (
        <FadeIn delay={0.45}>
          <GlassCard hover={false} className="p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Member Analytics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {memberAnalytics.map((m, i) => (
                <motion.div
                  key={m.memberId}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.07 }}
                  className="rounded-2xl border border-white/10 p-4"
                  style={{ background: `linear-gradient(135deg, ${m.avatarColor}14, ${m.avatarColor}05)` }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex items-center justify-center flex-shrink-0">
                      <ProgressRing pct={m.contributionPct} color={m.avatarColor} />
                      <div className="absolute">
                        <Avatar name={m.name} color={m.avatarColor} size="sm" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                        {m.name} {i === 0 && m.totalPaid > 0 && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                      </p>
                      <p className="text-[11px] text-white/40">
                        <CountUp end={m.contributionPct} decimals={0} duration={1.2} />% contribution · {m.expenseCount} expense{m.expenseCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white/5 py-2">
                      <p className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Paid</p>
                      <p className="text-xs font-bold text-white">{formatCompactINR(m.totalPaid)}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 py-2">
                      <p className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Owes</p>
                      <p className="text-xs font-bold text-white">{formatCompactINR(m.totalOwed)}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 py-2">
                      <p className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Net</p>
                      <p className={`text-xs font-bold ${m.netBalance > 0 ? 'text-emerald-400' : m.netBalance < 0 ? 'text-red-400' : 'text-white/50'}`}>
                        {m.netBalance > 0 ? '+' : ''}{formatCompactINR(m.netBalance)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* Expense Timeline */}
      {timeline.length > 0 && (
        <FadeIn delay={0.5}>
          <GlassCard hover={false} className="p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-brand-400" />
              Expense Timeline
            </h2>
            <div className="relative pl-5">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gradient-to-b from-brand-400/50 via-fuchsia-400/30 to-transparent" />
              <div className="space-y-5">
                {timeline.map(group => (
                  <div key={group.day} className="relative">
                    <div className="absolute -left-5 top-1 w-3 h-3 rounded-full grad-violet-fuchsia ring-4 ring-surface-0" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-white">{group.day}</p>
                      <p className="text-xs font-bold text-brand-400">{formatCurrency(group.total)}</p>
                    </div>
                    <div className="space-y-1.5">
                      {group.items.map(item => {
                        const payer = members.find(m => m.id === item.paidBy)
                        return (
                          <div key={item.id} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2">
                            <span className="text-sm flex-shrink-0">{getCategoryIcon(item.category)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{item.title}</p>
                              <p className="text-[10px] text-white/35">
                                {payer?.name}{item.subcategory ? ` · ${getSubcategoryLabel(item.category, item.subcategory)}` : ''}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-white flex-shrink-0">{formatCurrency(item.amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* Settlement summary */}
      {routes.length > 0 && (
        <FadeIn delay={0.55}>
          <GlassCard hover={false} className="p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Settlement Summary</h2>
            <div className="space-y-2">
              {routes.map(r => {
                const s = settlements.find(x => x.fromMemberId === r.fromMemberId && x.toMemberId === r.toMemberId)
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <Avatar name={r.fromName} color={r.fromColor} size="xs" />
                    <span className="text-xs text-white flex-1 truncate">{r.fromName}</span>
                    <span className="text-xs text-white/40">→</span>
                    <span className="text-xs font-medium text-white">{formatCurrency(r.amount)}</span>
                    <span className="text-xs text-white/40">→</span>
                    <span className="text-xs text-white flex-1 truncate text-right">{r.toName}</span>
                    <Avatar name={r.toName} color={r.toColor} size="xs" />
                    <span className={`text-[10px] ml-1 capitalize ${s?.status === 'confirmed' ? 'text-emerald-400' : s?.status === 'paid' ? 'text-brand-400' : 'text-white/30'}`}>
                      {s?.status === 'paid' ? 'paid' : s?.status === 'confirmed' ? 'confirmed' : 'due'}
                    </span>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {totalSpend === 0 && (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 mb-1">No data to analyse yet</p>
          <p className="text-white/30 text-sm">Add a few expenses and the magic happens here ✨</p>
        </div>
      )}
    </div>
  )
}
