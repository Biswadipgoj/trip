'use client'
import React, { useMemo, useRef } from 'react'
import { useStore } from '@/lib/store'
import {
  calculateBalances, calculateSettlements, formatCurrency, formatDate,
  getCategoryColor, getCategoryIcon
} from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { FadeIn } from '@/components/animations/FadeIn'
import {
  BarChart3, Download, Users, Receipt, ArrowLeftRight,
  CheckCircle2, TrendingUp, Hotel
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

interface ReportPageProps {
  params: Promise<{ tripId: string }>
}

export default function ReportPage({ params }: ReportPageProps) {
  const { tripId } = React.use(params)

  const trip          = useStore(s => s.getTripById(tripId))
  const members       = useStore(s => s.getMembersByTrip(tripId))
  const expenses      = useStore(s => s.getExpensesByTrip(tripId))
  const hotelExpenses = useStore(s => s.getHotelExpensesByTrip(tripId))
  const groups        = useStore(s => s.getGroupsByTrip(tripId))
  const sponsorships  = useStore(s => s.getSponsorshipsByTrip(tripId))
  const settlements   = useStore(s => s.getSettlementsByTrip(tripId))

  const balances = useMemo(
    () => calculateBalances(expenses, hotelExpenses, members),
    [expenses, hotelExpenses, members]
  )

  const routes = useMemo(
    () => calculateSettlements(balances, members, groups, sponsorships),
    [balances, members, groups, sponsorships]
  )

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name), icon: getCategoryIcon(name) }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])

  const memberSpendData = useMemo(() =>
    balances.map(b => ({
      name: b.name.split(' ')[0],
      paid: b.totalPaid,
      owed: b.totalOwed,
    })),
    [balances]
  )

  const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0)
  const totalHotel     = hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)
  const totalSpend     = totalExpenses + totalHotel
  const settledCount   = settlements.filter(s => s.status === 'confirmed').length
  const perPersonAvg   = members.length > 0 ? totalSpend / members.length : 0

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
    doc.text(`Avg per person: ${formatCurrency(perPersonAvg)}`, 14, y); y += 12

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Report</h1>
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

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Receipt,       label: 'Total Spend',   value: formatCurrency(totalSpend),          color: 'hsl(240,78%,58%)' },
          { icon: Users,         label: 'Members',       value: String(members.length),              color: 'hsl(280,78%,55%)' },
          { icon: TrendingUp,    label: 'Per Person',    value: formatCurrency(perPersonAvg),        color: 'hsl(25,80%,55%)' },
          { icon: CheckCircle2,  label: 'Settled',       value: `${settledCount}/${routes.length}`,  color: 'hsl(158,60%,45%)' },
        ].map((kpi, i) => (
          <FadeIn key={kpi.label} delay={i * 0.07}>
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}20` }}>
                  <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
                </div>
                <span className="text-xs text-white/50">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{kpi.value}</p>
            </GlassCard>
          </FadeIn>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category breakdown */}
        {categoryData.length > 0 && (
          <FadeIn delay={0.3}>
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Expense by Category</h2>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{ background: 'hsl(222,36%,10%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.map(cat => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="text-xs text-white/60 flex-1 capitalize">{cat.icon} {cat.name}</span>
                    <span className="text-xs font-medium text-white">{formatCurrency(cat.value)}</span>
                    <span className="text-[10px] text-white/30 w-10 text-right">
                      {totalExpenses > 0 ? `${((cat.value / totalExpenses) * 100).toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        )}

        {/* Member spend bars */}
        {memberSpendData.length > 0 && (
          <FadeIn delay={0.35}>
            <GlassCard className="p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Paid vs Owed per Member</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={memberSpendData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{ background: 'hsl(222,36%,10%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 12 }}
                  />
                  <Bar dataKey="paid" fill="hsl(240,78%,58%)" radius={[4, 4, 0, 0]} name="Paid" />
                  <Bar dataKey="owed" fill="hsl(280,78%,55%)" radius={[4, 4, 0, 0]} name="Owed" />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </FadeIn>
        )}
      </div>

      {/* Member Balances table */}
      <FadeIn delay={0.4}>
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Member Balances</h2>
          <div className="space-y-3">
            {balances.map(b => (
              <div key={b.memberId} className="flex items-center gap-3">
                <Avatar name={b.name} color={b.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{b.name}</p>
                  <p className="text-xs text-white/40">paid {formatCurrency(b.totalPaid)} · owes {formatCurrency(b.totalOwed)}</p>
                </div>
                <p className={`text-sm font-semibold ${
                  b.netBalance > 0 ? 'text-emerald-400' : b.netBalance < 0 ? 'text-red-400' : 'text-white/40'
                }`}>
                  {b.netBalance > 0 ? '+' : ''}{formatCurrency(b.netBalance)}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      </FadeIn>

      {/* Settlement summary */}
      {routes.length > 0 && (
        <FadeIn delay={0.45}>
          <GlassCard className="p-5">
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
                    <span className={`text-[10px] ml-1 ${s?.status === 'confirmed' ? 'text-emerald-400' : s?.status === 'paid' ? 'text-brand-400' : 'text-white/30'}`}>
                      {s?.status || 'pending'}
                    </span>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </FadeIn>
      )}
    </div>
  )
}
