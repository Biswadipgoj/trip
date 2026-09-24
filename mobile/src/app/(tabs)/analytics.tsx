// Report (web /report/[tripId]): KPI tiles, budget meter, smart insights,
// category donut, daily spending, budget allocation, member contribution,
// category ranking, member analytics rings, expense timeline and settlement
// summary — plus "Export PDF" (styled report via expo-print → share sheet).
import { useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
  CalendarDays, ChartColumn, CircleCheck, Crown, Download, Flame, Lightbulb, Medal, PiggyBank, Receipt,
  TrendingUp, Trophy, Users, Zap,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { useTripData } from '../../lib/hooks'
import { syncTrip } from '../../lib/sync'
import { toast } from '../../lib/toast'
import {
  formatCompactINR, formatCurrency, formatDate, formatDayShort, getCategoryColor, getCategoryGradientColors,
  getCategoryIcon, getCategoryLabel, getSubcategoryLabel,
} from '../../lib/utils'
import { withAlpha } from '../../lib/color'
import { GlassCard } from '../../components/ui/GlassCard'
import { T } from '../../components/ui/Text'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { StatCard } from '../../components/ui/StatCard'
import { BarChart, DonutChart, HBarChart } from '../../components/ui/DonutChart'
import { PageHeader, PageScroll } from '../../components/ui/PageHeader'
import { CountUp } from '../../components/animated/SlotCounter'
import { ProgressBar, ProgressRing } from '../../components/animated/ProgressRing'
import { FadeIn, stagger } from '../../components/animated/FadeInView'
import { EmptyState } from '../../components/animated/AnimatedEmptyState'
import { C, G, ink } from '../../theme/colors'
import { tick } from '../../components/animated/SpringPressable'

const rankMedal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

export default function ReportScreen() {
  const session = useStore(s => s.session)
  const tripId = session?.tripId
  const { trip, members, expenses, hotelExpenses, settlements, balances, routes, memberMap, totalSpent: totalSpend } = useTripData(tripId)
  const [exporting, setExporting] = useState(false)

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
    hotelExpenses.forEach(h => { cats.stay = (cats.stay || 0) + h.totalAmount })
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name), icon: getCategoryIcon(name) }))
      .sort((a, b) => b.value - a.value)
  }, [expenses, hotelExpenses])

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
          .map(([sub, value]) => ({ sub, value, label: sub === '_other' ? 'General' : getSubcategoryLabel(cat, sub) || sub }))
          .sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses, hotelExpenses])

  const settledCount = settlements.filter(s => s.status === 'confirmed').length
  const perPersonAvg = members.length > 0 ? totalSpend / members.length : 0
  const budget = trip?.budget ?? 0
  const budgetUsedPct = budget > 0 ? (totalSpend / budget) * 100 : 0

  const dailySpend = useMemo(() => {
    const days: Record<string, number> = {}
    const add = (dateStr: string, amt: number) => {
      const d = new Date(dateStr)
      if (Number.isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days[key] = (days[key] || 0) + amt
    }
    expenses.forEach(e => add(e.createdAt, e.amount))
    hotelExpenses.forEach(h => add(h.createdAt, h.totalAmount))
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ key: date, label: formatDayShort(`${date}T12:00:00`), value: total }))
  }, [expenses, hotelExpenses])

  const memberAnalytics = useMemo(
    () =>
      balances
        .map(b => {
          const expenseCount =
            expenses.filter(e => (e.payers && e.payers.length > 0 ? e.payers.some(p => p.memberId === b.memberId) : e.paidBy === b.memberId)).length +
            hotelExpenses.filter(h => h.paidBy === b.memberId).length
          return { ...b, expenseCount, contributionPct: totalSpend > 0 ? (b.totalPaid / totalSpend) * 100 : 0 }
        })
        .sort((a, b) => b.totalPaid - a.totalPaid),
    [balances, expenses, hotelExpenses, totalSpend]
  )

  const insights = useMemo(() => {
    const list: { id: string; icon: ReactNode; text: ReactNode }[] = []
    if (totalSpend <= 0) return list
    const B = ({ children, color }: { children: ReactNode; color?: string }) => <T variant="smallSemibold" color={color ?? C.ink}>{children}</T>

    const topCat = categoryData[0]
    if (topCat) {
      list.push({
        id: 'top-category',
        icon: <T variant="body">{topCat.icon}</T>,
        text: <><B>{getCategoryLabel(topCat.name)}</B> consumed <B>{((topCat.value / totalSpend) * 100).toFixed(0)}%</B> of total spend ({formatCompactINR(topCat.value)}).</>,
      })
    }
    if (budget > 0) {
      const diffPct = Math.abs(budgetUsedPct - 100).toFixed(0)
      list.push({
        id: 'budget',
        icon: <PiggyBank size={16} color={C.emerald400} />,
        text: budgetUsedPct > 100
          ? <>Trip is <B color={C.red500}>{diffPct}% over</B> the planned budget of {formatCompactINR(budget)}.</>
          : <><B>{budgetUsedPct.toFixed(0)}%</B> of the {formatCompactINR(budget)} budget used — {formatCompactINR(budget - totalSpend)} remaining.</>,
      })
    }
    if (dailySpend.length > 0) {
      list.push({
        id: 'avg-day',
        icon: <CalendarDays size={16} color={C.brand500} />,
        text: <>Average spend per day is <B>{formatCurrency(totalSpend / dailySpend.length)}</B> across {dailySpend.length} spending day{dailySpend.length !== 1 ? 's' : ''}.</>,
      })
    }
    if (members.length > 0) {
      list.push({
        id: 'avg-member',
        icon: <Users size={16} color={C.sky500} />,
        text: <>Average spend per member is <B>{formatCurrency(perPersonAvg)}</B>.</>,
      })
    }
    const top = memberAnalytics[0]
    if (top && top.totalPaid > 0) {
      list.push({
        id: 'top-spender',
        icon: <Crown size={16} color={C.amber500} />,
        text: <><B>{top.name}</B> is the biggest spender — paid {formatCurrency(top.totalPaid)} ({top.contributionPct.toFixed(0)}% of the trip).</>,
      })
    }
    const mostActive = [...memberAnalytics].sort((a, b) => b.expenseCount - a.expenseCount)[0]
    if (mostActive && mostActive.expenseCount > 0) {
      list.push({
        id: 'most-active',
        icon: <Zap size={16} color={C.fuchsia500} />,
        text: <><B>{mostActive.name}</B> is the most active contributor with {mostActive.expenseCount} expense{mostActive.expenseCount !== 1 ? 's' : ''} added.</>,
      })
    }
    const biggest = [
      ...expenses.map(e => ({ title: e.title, amount: e.amount })),
      ...hotelExpenses.map(h => ({ title: h.title, amount: h.totalAmount })),
    ].sort((a, b) => b.amount - a.amount)[0]
    if (biggest) {
      list.push({
        id: 'biggest',
        icon: <Flame size={16} color={C.orange500} />,
        text: <>Single biggest expense: <B>{biggest.title}</B> at {formatCurrency(biggest.amount)}.</>,
      })
    }
    return list
  }, [totalSpend, categoryData, budget, budgetUsedPct, dailySpend, members.length, perPersonAvg, memberAnalytics, expenses, hotelExpenses])

  const timeline = useMemo(() => {
    const items = [
      ...expenses.map(e => ({ id: e.id, title: e.title, amount: e.amount, category: e.category as string, subcategory: e.subcategory, paidBy: e.paidBy, createdAt: e.createdAt })),
      ...hotelExpenses.map(h => ({ id: h.id, title: h.title, amount: h.totalAmount, category: 'stay', subcategory: undefined as string | undefined, paidBy: h.paidBy, createdAt: h.createdAt })),
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
    if (!trip) return
    setExporting(true)
    try {
      const html = buildReportHtml({
        tripName: trip.name,
        tripCode: trip.tripCode,
        status: trip.status,
        totalSpend,
        members: members.length,
        perPersonAvg,
        budget,
        budgetUsedPct,
        categories: categoryData.map(c => ({ label: `${c.icon} ${getCategoryLabel(c.name)}`, value: c.value, color: c.color })),
        balances: balances.map(b => ({ name: b.name, paid: b.totalPaid, owed: b.totalOwed, net: b.netBalance })),
        routes: routes.map(r => ({ from: r.fromName, to: r.toName, amount: r.amount })),
        items: timeline.flatMap(g => g.items.map(i => ({ date: g.day, title: i.title, amount: i.amount, payer: memberMap[i.paidBy]?.name ?? '' }))),
      })
      const { uri } = await Print.printToFileAsync({ html })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Trip report — ${trip.name}`, UTI: 'com.adobe.pdf' })
      } else {
        toast.info('PDF saved, but sharing is not available on this device')
      }
      tick('success')
    } catch (err) {
      toast.error(`Could not create the PDF: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }

  const kpis = [
    { key: 'total', icon: Receipt, label: 'Total Spend', text: formatCompactINR(totalSpend), gradient: 'indigoPurple' as const },
    { key: 'members', icon: Users, label: 'Members', text: String(members.length), gradient: 'blueCyan' as const },
    { key: 'avg', icon: TrendingUp, label: 'Per Person', text: formatCompactINR(perPersonAvg), gradient: 'orangePink' as const },
    // confirmed / (confirmed + still due) — reads "3/3" when done (web shows "3/0")
    { key: 'settled', icon: CircleCheck, label: 'Settled', text: `${settledCount}/${routes.length + settledCount}`, gradient: 'emeraldTeal' as const },
  ]

  return (
    <PageScroll onRefresh={() => syncTrip(tripId)}>
      <PageHeader
        icon={ChartColumn}
        title="Trip Analytics"
        subtitle={trip?.name}
        vivid
        right={<Button title="PDF" icon={Download} variant="ghost" size="sm" loading={exporting} disabled={!trip || totalSpend === 0} onPress={() => void handleExport()} accessibilityLabel="Export PDF" />}
      />

      <View style={styles.kpis}>
        {[kpis.slice(0, 2), kpis.slice(2)].map((row, r) => (
          <View key={r} style={styles.kpiRow}>
            {row.map((k, i) => (
              <StatCard key={k.key} compact gradient={k.gradient} icon={k.icon} label={k.label} text={k.text} delay={(r * 2 + i) * 80} style={styles.flex} />
            ))}
          </View>
        ))}
      </View>

      {totalSpend === 0 ? (
        <EmptyState icon={ChartColumn} title="No data to analyse yet" subtitle="Add a few expenses and the magic happens here ✨" />
      ) : (
        <>
          {budget > 0 && (
            <FadeIn delay={150}>
              <GlassCard>
                <View style={styles.head}>
                  <View style={styles.row}>
                    <PiggyBank size={16} color={C.emerald400} />
                    <T variant="title">Budget Consumption</T>
                  </View>
                  <T variant="smallSemibold" color={budgetUsedPct > 100 ? C.red500 : C.emerald400}>{budgetUsedPct.toFixed(0)}% used</T>
                </View>
                <ProgressBar
                  pct={Math.min(budgetUsedPct, 100)}
                  colors={budgetUsedPct > 100 ? G.budgetOver : budgetUsedPct > 75 ? G.budgetWarn : G.budgetOk}
                  height={12}
                />
                <View style={[styles.between, styles.mt8]}>
                  <T variant="small" color={ink(0.6)}>Spent: <T variant="smallSemibold">{formatCurrency(totalSpend)}</T></T>
                  <T variant="small" color={ink(0.6)}>Budget: <T variant="smallSemibold">{formatCurrency(budget)}</T></T>
                </View>
              </GlassCard>
            </FadeIn>
          )}

          {insights.length > 0 && (
            <FadeIn delay={200}>
              <GlassCard>
                <View style={[styles.row, styles.title]}>
                  <Lightbulb size={16} color={C.amber500} />
                  <T variant="title">Trip Highlights</T>
                </View>
                <View style={styles.gap10}>
                  {insights.map((ins, i) => (
                    <FadeIn key={ins.id} delay={stagger(i, 250, 70)} direction="right">
                      <View style={styles.insight}>
                        <View style={styles.insightIcon}>{ins.icon}</View>
                        <T variant="small" color={ink(0.72)} style={styles.flex}>{ins.text}</T>
                      </View>
                    </FadeIn>
                  ))}
                </View>
              </GlassCard>
            </FadeIn>
          )}

          <FadeIn delay={250}>
            <GlassCard>
              <T variant="title" style={styles.title}>Category-wise Spending</T>
              <View style={styles.center}>
                <DonutChart data={categoryData.map(c => ({ key: c.name, value: c.value, color: c.color }))} size={196} thickness={28}>
                  <T variant="label" color={ink(0.55)}>Total</T>
                  <T variant="moneySm">{formatCompactINR(totalSpend)}</T>
                </DonutChart>
              </View>
              <View style={[styles.gap8, styles.mt12]}>
                {categoryData.map(cat => (
                  <View key={cat.name} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: cat.color }]} />
                    <T variant="small" color={ink(0.62)} style={styles.flex}>{cat.icon} {getCategoryLabel(cat.name)}</T>
                    <T variant="smallSemibold">{formatCurrency(cat.value)}</T>
                    <T variant="tiny" color={ink(0.5)} style={styles.pct}>{((cat.value / totalSpend) * 100).toFixed(0)}%</T>
                  </View>
                ))}
              </View>
            </GlassCard>
          </FadeIn>

          {dailySpend.length > 0 && (
            <FadeIn delay={300}>
              <GlassCard>
                <T variant="title" style={styles.title}>Daily Spending</T>
                <BarChart data={dailySpend} height={200} />
              </GlassCard>
            </FadeIn>
          )}

          {subcategoryData.length > 0 && (
            <FadeIn delay={320}>
              <GlassCard>
                <T variant="title" style={styles.title}>Budget Allocation</T>
                <View style={styles.gap12}>
                  {subcategoryData.map((cat, i) => (
                    <FadeIn key={cat.category} delay={stagger(i, 350, 60)}>
                      <View style={styles.alloc}>
                        <View style={styles.between}>
                          <View style={styles.row}>
                            <View style={[styles.catTile, { backgroundColor: getCategoryGradientColors(cat.category)[0] }]}>
                              <T variant="body">{getCategoryIcon(cat.category)}</T>
                            </View>
                            <T variant="title">{getCategoryLabel(cat.category)}</T>
                          </View>
                          <View style={styles.right}>
                            <T variant="title">{formatCompactINR(cat.total)}</T>
                            <T variant="tiny" color={ink(0.5)}>{((cat.total / totalSpend) * 100).toFixed(0)}% of trip</T>
                          </View>
                        </View>
                        <View style={[styles.gap8, styles.mt12]}>
                          {cat.subs.map(sub => (
                            <View key={sub.sub} style={styles.row}>
                              <T variant="small" color={ink(0.6)} numberOfLines={1} style={styles.flex}>{sub.label}</T>
                              <ProgressBar
                                pct={cat.total > 0 ? (sub.value / cat.total) * 100 : 0}
                                colors={getCategoryGradientColors(cat.category)}
                                height={6}
                                style={styles.allocBar}
                              />
                              <T variant="smallSemibold" style={styles.allocValue}>{formatCompactINR(sub.value)}</T>
                            </View>
                          ))}
                        </View>
                      </View>
                    </FadeIn>
                  ))}
                </View>
                {expenses.length > 0 && expenses.every(e => !e.subcategory) && (
                  <T variant="tiny" color={ink(0.5)} style={styles.mt12}>
                    Tip: pick a subcategory (Breakfast, Train, Hotel…) when adding expenses for a finer breakdown.
                  </T>
                )}
              </GlassCard>
            </FadeIn>
          )}

          {memberAnalytics.length > 0 && (
            <FadeIn delay={350}>
              <GlassCard>
                <T variant="title" style={styles.title}>Member Contribution</T>
                <HBarChart
                  data={memberAnalytics.map(m => ({ key: m.memberId, label: m.name.split(' ')[0], value: m.totalPaid, color: m.avatarColor }))}
                  format={formatCompactINR}
                />
              </GlassCard>
            </FadeIn>
          )}

          {categoryData.length > 0 && (
            <FadeIn delay={400}>
              <GlassCard>
                <View style={[styles.row, styles.title]}>
                  <Medal size={16} color={C.amber500} />
                  <T variant="title">Category Ranking</T>
                </View>
                <View style={styles.gap12}>
                  {categoryData.map((cat, i) => (
                    <FadeIn key={cat.name} delay={stagger(i, 450, 60)} direction="right">
                      <View style={styles.row}>
                        <T variant="title" color={ink(0.6)} style={styles.medal}>{rankMedal(i)}</T>
                        <T variant="body">{cat.icon}</T>
                        <View style={styles.flex}>
                          <View style={[styles.between, styles.mb4]}>
                            <T variant="smallMedium">{getCategoryLabel(cat.name)}</T>
                            <T variant="smallSemibold">{formatCurrency(cat.value)}</T>
                          </View>
                          <ProgressBar
                            pct={(cat.value / categoryData[0].value) * 100}
                            colors={getCategoryGradientColors(cat.name)}
                            height={6}
                          />
                        </View>
                      </View>
                    </FadeIn>
                  ))}
                </View>
              </GlassCard>
            </FadeIn>
          )}

          {memberAnalytics.length > 0 && (
            <FadeIn delay={450}>
              <GlassCard>
                <View style={[styles.row, styles.title]}>
                  <Trophy size={16} color={C.amber500} />
                  <T variant="title">Member Analytics</T>
                </View>
                <View style={styles.gap12}>
                  {memberAnalytics.map((m, i) => (
                    <FadeIn key={m.memberId} delay={stagger(i, 500, 70)}>
                      <View style={[styles.memberCard, { backgroundColor: withAlpha(m.avatarColor, 0.07), borderColor: withAlpha(m.avatarColor, 0.18) }]}>
                        <View style={[styles.row, styles.mb12]}>
                          <ProgressRing pct={m.contributionPct} color={m.avatarColor} size={58}>
                            <Avatar name={m.name} color={m.avatarColor} size="sm" glow={false} />
                          </ProgressRing>
                          <View style={styles.flex}>
                            <View style={styles.row}>
                              <T variant="title" numberOfLines={1} style={styles.shrink}>{m.name}</T>
                              {i === 0 && m.totalPaid > 0 && <Crown size={14} color={C.amber500} />}
                            </View>
                            <View style={styles.inline}>
                              <CountUp value={m.contributionPct} suffix="%" duration={1.2} variant="small" color={ink(0.6)} />
                              <T variant="small" color={ink(0.6)}>
                                {` contribution · ${m.expenseCount} expense${m.expenseCount !== 1 ? 's' : ''}`}
                              </T>
                            </View>
                          </View>
                        </View>
                        <View style={styles.row}>
                          <MiniStat label="Paid" value={formatCompactINR(m.totalPaid)} />
                          <MiniStat label="Owes" value={formatCompactINR(m.totalOwed)} />
                          <MiniStat
                            label="Net"
                            value={`${m.netBalance > 0 ? '+' : ''}${formatCompactINR(m.netBalance)}`}
                            color={m.netBalance > 0 ? C.emerald400 : m.netBalance < 0 ? C.red500 : ink(0.65)}
                          />
                        </View>
                      </View>
                    </FadeIn>
                  ))}
                </View>
              </GlassCard>
            </FadeIn>
          )}

          {timeline.length > 0 && (
            <FadeIn delay={500}>
              <GlassCard>
                <View style={[styles.row, styles.title]}>
                  <CalendarDays size={16} color={C.brand500} />
                  <T variant="title">Expense Timeline</T>
                </View>
                <View style={styles.timeline}>
                  <View style={styles.rail} />
                  {timeline.map(group => (
                    <View key={group.day} style={styles.day}>
                      <View style={styles.node} />
                      <View style={[styles.between, styles.mb8]}>
                        <T variant="smallSemibold">{group.day}</T>
                        <T variant="smallSemibold" color={C.brand500}>{formatCurrency(group.total)}</T>
                      </View>
                      <View style={styles.gap6}>
                        {group.items.map(item => (
                          <View key={item.id} style={styles.timelineItem}>
                            <T variant="body">{getCategoryIcon(item.category)}</T>
                            <View style={styles.flex}>
                              <T variant="smallMedium" numberOfLines={1}>{item.title}</T>
                              <T variant="tiny" color={ink(0.55)} numberOfLines={1}>
                                {memberMap[item.paidBy]?.name ?? '—'}
                                {item.subcategory ? ` · ${getSubcategoryLabel(item.category, item.subcategory)}` : ''}
                              </T>
                            </View>
                            <T variant="smallSemibold">{formatCurrency(item.amount)}</T>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </FadeIn>
          )}

          {routes.length > 0 && (
            <FadeIn delay={550}>
              <GlassCard>
                <T variant="title" style={styles.title}>Settlement Summary</T>
                <View style={styles.gap10}>
                  {routes.map(r => {
                    const s = settlements.find(x => x.fromMemberId === r.fromMemberId && x.toMemberId === r.toMemberId && x.status !== 'confirmed')
                    return (
                      <View key={`${r.fromMemberId}→${r.toMemberId}`} style={styles.row}>
                        <Avatar name={r.fromName} color={r.fromColor} size="xs" glow={false} />
                        <T variant="small" numberOfLines={1} style={styles.flex}>{r.fromName}</T>
                        <T variant="small" color={ink(0.6)}>→</T>
                        <T variant="smallSemibold">{formatCurrency(r.amount)}</T>
                        <T variant="small" color={ink(0.6)}>→</T>
                        <T variant="small" numberOfLines={1} style={[styles.flex, styles.alignRight]}>{r.toName}</T>
                        <Avatar name={r.toName} color={r.toColor} size="xs" glow={false} />
                        <T variant="tinySemibold" color={s?.status === 'paid' ? C.brand500 : ink(0.5)} style={styles.status}>
                          {s?.status === 'paid' ? 'paid' : 'due'}
                        </T>
                      </View>
                    )
                  })}
                </View>
              </GlassCard>
            </FadeIn>
          )}
        </>
      )}
    </PageScroll>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.mini}>
      <T variant="tinySemibold" color={ink(0.6)} style={styles.miniLabel}>{label.toUpperCase()}</T>
      <T variant="smallSemibold" color={color ?? C.ink} numberOfLines={1}>{value}</T>
    </View>
  )
}

// ─── PDF report ───────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildReportHtml(r: {
  tripName: string
  tripCode: string
  status: string
  totalSpend: number
  members: number
  perPersonAvg: number
  budget: number
  budgetUsedPct: number
  categories: { label: string; value: number; color: string }[]
  balances: { name: string; paid: number; owed: number; net: number }[]
  routes: { from: string; to: string; amount: number }[]
  items: { date: string; title: string; amount: number; payer: string }[]
}) {
  const money = (n: number) => esc(formatCurrency(n))
  const kpi = (label: string, value: string) => `<div class="kpi"><div class="kl">${label}</div><div class="kv">${value}</div></div>`
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; color: #2A1F3D; margin: 0; padding: 28px; }
    .hero { border-radius: 18px; padding: 22px 24px; color: #fff; background: linear-gradient(135deg, #7C3BED, #E935CB); }
    .hero h1 { margin: 0 0 4px; font-size: 26px; } .hero p { margin: 0; opacity: .85; font-size: 12px; }
    .kpis { display: flex; gap: 10px; margin: 16px 0 6px; }
    .kpi { flex: 1; border-radius: 12px; padding: 12px; background: #F5F0FF; }
    .kl { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #6b5f82; } .kv { font-size: 18px; font-weight: 700; margin-top: 2px; }
    h2 { font-size: 15px; margin: 22px 0 8px; color: #5720B6; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6b5f82; border-bottom: 1px solid #ECE3D0; padding: 6px 4px; }
    td { padding: 7px 4px; border-bottom: 1px solid #F4EDDD; } .r { text-align: right; } .pos { color: #148A63; } .neg { color: #DC2626; }
    .bar { height: 8px; border-radius: 4px; }
    .foot { margin-top: 26px; font-size: 10px; color: #8d82a3; text-align: center; }
  </style></head><body>
    <div class="hero"><h1>${esc(r.tripName)}</h1><p>Trip report · ${esc(r.tripCode)} · ${esc(r.status)} · generated ${esc(formatDate(new Date().toISOString()))}</p></div>
    <div class="kpis">${kpi('Total spend', money(r.totalSpend))}${kpi('Members', String(r.members))}${kpi('Per person', money(r.perPersonAvg))}${r.budget > 0 ? kpi('Budget used', `${r.budgetUsedPct.toFixed(0)}%`) : ''}</div>
    <h2>Category breakdown</h2>
    <table><tr><th>Category</th><th></th><th class="r">Amount</th><th class="r">Share</th></tr>
      ${r.categories.map(c => `<tr><td>${esc(c.label)}</td><td style="width:40%"><div class="bar" style="width:${r.totalSpend > 0 ? ((c.value / r.totalSpend) * 100).toFixed(1) : 0}%;background:${esc(c.color)}"></div></td><td class="r">${money(c.value)}</td><td class="r">${r.totalSpend > 0 ? ((c.value / r.totalSpend) * 100).toFixed(0) : 0}%</td></tr>`).join('')}
    </table>
    <h2>Member balances</h2>
    <table><tr><th>Member</th><th class="r">Paid</th><th class="r">Share</th><th class="r">Net</th></tr>
      ${r.balances.map(b => `<tr><td>${esc(b.name)}</td><td class="r">${money(b.paid)}</td><td class="r">${money(b.owed)}</td><td class="r ${b.net > 0.01 ? 'pos' : b.net < -0.01 ? 'neg' : ''}">${b.net > 0 ? '+' : ''}${money(b.net)}</td></tr>`).join('')}
    </table>
    <h2>Settlements</h2>
    ${r.routes.length === 0 ? '<p style="font-size:12px">Everyone is settled 🎉</p>' : `<table><tr><th>From</th><th>To</th><th class="r">Amount</th></tr>${r.routes.map(x => `<tr><td>${esc(x.from)}</td><td>${esc(x.to)}</td><td class="r">${money(x.amount)}</td></tr>`).join('')}</table>`}
    <h2>All expenses</h2>
    <table><tr><th>Date</th><th>Expense</th><th>Paid by</th><th class="r">Amount</th></tr>
      ${r.items.map(i => `<tr><td>${esc(i.date)}</td><td>${esc(i.title)}</td><td>${esc(i.payer)}</td><td class="r">${money(i.amount)}</td></tr>`).join('')}
    </table>
    <div class="foot">Made with TripMate · Mastermind Behind The Code: Biswodip Goj</div>
  </body></html>`
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  center: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
  alignRight: { textAlign: 'right' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { marginBottom: 14 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  kpis: { gap: 12 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ink(0.08),
    backgroundColor: ink(0.03),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  insightIcon: { marginTop: 1, width: 20, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  pct: { width: 36, textAlign: 'right' },
  alloc: { borderRadius: 16, borderWidth: 1, borderColor: ink(0.08), backgroundColor: ink(0.03), padding: 14 },
  catTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  allocBar: { width: 82 },
  allocValue: { width: 62, textAlign: 'right' },
  medal: { width: 28, textAlign: 'center' },
  memberCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  mini: { flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.55)', paddingVertical: 8 },
  miniLabel: { fontSize: 9, letterSpacing: 0.6, marginBottom: 2 },
  timeline: { paddingLeft: 20 },
  rail: { position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, borderRadius: 1, backgroundColor: 'rgba(155,104,243,0.3)' },
  day: { marginBottom: 18 },
  node: {
    position: 'absolute',
    left: -20,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.brand500,
    borderWidth: 3,
    borderColor: C.surface0,
  },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: ink(0.04), paddingHorizontal: 12, paddingVertical: 9 },
  status: { marginLeft: 4, textTransform: 'capitalize' },
})
