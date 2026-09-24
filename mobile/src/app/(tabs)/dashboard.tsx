// Dashboard (web /dashboard/[tripId]): trip header, gradient stat tiles, budget
// and settlement progress, category donut, recent expenses and member
// balances. When every payment is confirmed the trip closes with a
// celebration. Mobile additions: UPI-ID nudge, pull-to-refresh, FAB.
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CircleCheck, HandCoins, Hotel, PiggyBank, Pencil, Plus,
  Receipt, Sparkles, TrendingUp, Wallet,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { useTripData } from '../../lib/hooks'
import { syncTrip } from '../../lib/sync'
import { cloudCloseTrip, cloudUpdateUpi, withCloud } from '../../lib/cloud'
import {
  formatCompactINR, formatCurrency, getCategoryColor, getCategoryIcon, getCategoryLabel, isValidUpiId,
} from '../../lib/utils'
import { withAlpha } from '../../lib/color'
import { toast } from '../../lib/toast'
import { useTranslation } from '../../lib/i18n'
import { TRAVEL_DESTINATIONS } from '../../constants/travelImages'
import { GlassCard } from '../../components/ui/GlassCard'
import { T } from '../../components/ui/Text'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { StatCard } from '../../components/ui/StatCard'
import { DonutChart } from '../../components/ui/DonutChart'
import { Overlay } from '../../components/ui/BottomSheet'
import { PageScroll } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/animated/PulseBadge'
import { ProgressBar } from '../../components/animated/ProgressRing'
import { Collapsible, FadeIn, stagger } from '../../components/animated/FadeInView'
import { FAB } from '../../components/animated/FloatingActionButton'
import { Confetti } from '../../components/animated/ConfettiBlast'
import { CardSkeleton } from '../../components/animated/ShimmerLoader'
import { PressScale, tick } from '../../components/animated/SpringPressable'
import { C, G, emerald, ink, whiteA } from '../../theme/colors'
import { F } from '../../theme/typography'

export default function DashboardScreen() {
  const { t } = useTranslation()
  const session = useStore(s => s.session)
  const tripId = session?.tripId
  const {
    trip, members, expenses, hotelExpenses, settlements, balances, totalSpent, me, memberMap,
  } = useTripData(tripId)
  const setTripBudget = useStore(s => s.setTripBudget)
  const generateSettlements = useStore(s => s.generateSettlements)
  const [savingUpi, setSavingUpi] = useState(false)

  // Recompute dues from live data on entry (heals stale persisted settlements).
  useEffect(() => {
    if (tripId) generateSettlements(tripId)
  }, [tripId, generateSettlements])

  const [celebrate, setCelebrate] = useState(false)
  const [confetti, setConfetti] = useState(0)
  const fired = useRef(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [upiInput, setUpiInput] = useState('')
  const [upiError, setUpiError] = useState<string | null>(null)
  const [upiDismissed, setUpiDismissed] = useState(false)

  const settledCount = settlements.filter(s => s.status === 'confirmed').length
  const totalSettlements = settlements.length
  const isFullySettled = totalSettlements > 0 && settledCount === totalSettlements

  const myBalance = balances.find(b => b.memberId === session?.memberId)
  const myContribution = myBalance?.totalPaid ?? 0
  const amountOwed = settlements
    .filter(s => s.fromMemberId === session?.memberId && s.status !== 'confirmed')
    .reduce((sum, s) => sum + s.amount, 0)
  const amountReceivable = settlements
    .filter(s => s.toMemberId === session?.memberId && s.status !== 'confirmed')
    .reduce((sum, s) => sum + s.amount, 0)

  const budget = trip?.budget ?? 0
  const remainingBudget = budget - totalSpent
  const budgetUsedPct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0
  const overBudget = budget > 0 && totalSpent > budget
  const contributionPct = totalSpent > 0 ? (myContribution / totalSpent) * 100 : 0
  const itemCount = expenses.length + hotelExpenses.length

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
    hotelExpenses.forEach(h => { cats.stay = (cats.stay || 0) + h.totalAmount })
    return Object.entries(cats).map(([name, value]) => ({ key: name, value, color: getCategoryColor(name) }))
  }, [expenses, hotelExpenses])

  const recent = useMemo(
    () =>
      [
        ...expenses.map(e => ({ id: e.id, title: e.title, amount: e.amount, category: e.category as string, paidBy: e.paidBy, createdAt: e.createdAt, hotel: false })),
        ...hotelExpenses.map(h => ({ id: h.id, title: h.title, amount: h.totalAmount, category: 'stay', paidBy: h.paidBy, createdAt: h.createdAt, hotel: true })),
      ]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [expenses, hotelExpenses]
  )

  // Trip completion: every payment confirmed → close with a celebration.
  useEffect(() => {
    if (isFullySettled && trip?.status === 'active' && !fired.current && tripId) {
      fired.current = true
      setCelebrate(true)
      setConfetti(n => n + 1)
      tick('success')
      // Saved in the cloud for everyone; if it fails it is retried next time.
      cloudCloseTrip(tripId).catch(() => { fired.current = false })
    }
  }, [isFullySettled, trip?.status, tripId])

  if (!trip || !tripId) {
    return (
      <PageScroll onRefresh={() => syncTrip(tripId)}>
        <T variant="body" color={ink(0.6)} center>Loading your trip…</T>
        <CardSkeleton />
        <CardSkeleton />
      </PageScroll>
    )
  }

  const saveBudget = () => {
    const val = parseFloat(budgetInput)
    if (val > 0) {
      setTripBudget(tripId, val)
      tick('success')
    }
    setEditingBudget(false)
  }

  const saveUpi = async () => {
    const value = upiInput.trim()
    if (!isValidUpiId(value)) {
      setUpiError('Enter a valid UPI ID, e.g. name@okhdfcbank')
      return
    }
    if (!me || savingUpi) return
    setSavingUpi(true)
    const saved = await withCloud(async () => {
      await cloudUpdateUpi(me.id, value)
      return true
    })
    setSavingUpi(false)
    if (!saved) return
    setUpiError(null)
    tick('success')
    toast.success('UPI ID saved — friends can now pay you in one tap')
  }

  const showUpiNudge = !!me && !me.upiId && !upiDismissed

  return (
    <View style={styles.fill}>
      <PageScroll onRefresh={async () => { await syncTrip(tripId); generateSettlements(tripId) }}>
        {/* Scenic Trip Cover Card */}
        <FadeIn>
          <View style={styles.scenicCard}>
            {/* Brand gradient underneath: the cover photo is remote, and without
                a connection the card would otherwise be a grey block. */}
            <LinearGradient colors={G.indigoPurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Image
              source={{ uri: TRAVEL_DESTINATIONS[0].image }}
              alt=""
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['rgba(25, 14, 42, 0.4)', 'rgba(25, 14, 42, 0.88)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.scenicContent}>
              <View style={styles.scenicTop}>
                <StatusBadge status={trip.status} />
              </View>
              <View style={styles.scenicBottom}>
                <View style={styles.flex}>
                  <T variant="h2" color={C.white} numberOfLines={1}>{trip.name}</T>
                  <T variant="small" color={whiteA(0.85)}>
                    Code: <T variant="smallMedium" color={C.amber400} style={styles.mono}>{trip.tripCode}</T>
                    {`  ·  ${members.length} friends`}
                  </T>
                </View>
                <Button
                  title={t('addExpense')}
                  icon={Plus}
                  size="sm"
                  onPress={() => router.push('/add-expense')}
                  testID="add-expense-btn"
                />
              </View>
            </View>
          </View>
        </FadeIn>

        {/* UPI nudge (mobile) */}
        {showUpiNudge && (
          <FadeIn delay={40}>
            <GlassCard padding={16} contentStyle={styles.gap10}>
              <View style={styles.row}>
                <View style={[styles.iconTile, { backgroundColor: emerald(0.14) }]}>
                  <HandCoins size={18} color={C.emerald400} />
                </View>
                <View style={styles.flex}>
                  <T variant="title">Add your UPI ID</T>
                  <T variant="small" color={ink(0.6)}>So friends can pay you back in one tap</T>
                </View>
                <T variant="smallMedium" color={ink(0.5)} onPress={() => setUpiDismissed(true)} suppressHighlighting>Later</T>
              </View>
              <View style={styles.row}>
                <Field
                  placeholder="yourname@okhdfcbank"
                  value={upiInput}
                  onChangeText={v => { setUpiInput(v.replace(/\s/g, '')); setUpiError(null) }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  mono
                  dense
                  error={upiError}
                  containerStyle={styles.flex}
                  returnKeyType="done"
                  onSubmitEditing={() => void saveUpi()}
                />
                <Button title="Save" size="sm" icon={Check} loading={savingUpi} onPress={() => void saveUpi()} style={styles.alignTop} />
              </View>
            </GlassCard>
          </FadeIn>
        )}

        {/* Hero stat */}
        <StatCard
          gradient="indigoPurple"
          icon={Wallet}
          label="Total Trip Cost"
          value={totalSpent}
          trend={`${itemCount} expense${itemCount !== 1 ? 's' : ''} · avg ${formatCompactINR(members.length > 0 ? totalSpent / members.length : 0)}/person`}
          testID="total-spent"
        />

        {/* Personal + budget grid */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard
              gradient={overBudget ? 'orangePink' : 'emeraldTeal'}
              icon={PiggyBank}
              label={overBudget ? 'Over Budget' : 'Remaining Budget'}
              value={Math.abs(budget > 0 ? remainingBudget : 0)}
              trend={budget > 0 ? `${budgetUsedPct.toFixed(0)}% of ${formatCompactINR(budget)} used` : 'Tap ✎ to set a budget'}
              trendUp={budget > 0 ? !overBudget : null}
              delay={80}
              style={styles.flex}
              action={
                <PressScale
                  onPress={() => {
                    setBudgetInput(budget > 0 ? String(budget) : '')
                    setEditingBudget(v => !v)
                  }}
                  style={styles.editBudget}
                  accessibilityRole="button"
                  accessibilityLabel="Set budget"
                >
                  <Pencil size={14} color={C.white} strokeWidth={2.4} />
                </PressScale>
              }
            />
            <StatCard
              gradient="blueCyan"
              icon={HandCoins}
              label="Your Contribution"
              value={myContribution}
              trend={totalSpent > 0 ? `${contributionPct.toFixed(0)}% of trip spend` : 'No expenses yet'}
              delay={160}
              style={styles.flex}
            />
          </View>
          <View style={styles.gridRow}>
            <StatCard
              gradient="orangePink"
              icon={ArrowUpRight}
              label="You Owe"
              value={amountOwed}
              trend={amountOwed > 0 ? 'Settle up to clear' : 'All clear 🎉'}
              trendUp={amountOwed > 0 ? false : null}
              delay={240}
              style={styles.flex}
            />
            <StatCard
              gradient="violetFuchsia"
              icon={ArrowDownLeft}
              label="You'll Receive"
              value={amountReceivable}
              trend={amountReceivable > 0 ? 'Friends owe you' : 'Nothing pending'}
              trendUp={amountReceivable > 0 ? true : null}
              delay={320}
              style={styles.flex}
            />
          </View>
        </View>

        {/* Budget editor */}
        <Collapsible open={editingBudget}>
          <GlassCard padding={14}>
            <View style={styles.row}>
              <T variant="body" color={ink(0.6)}>Trip budget ₹</T>
              <Field
                placeholder="e.g. 50000"
                value={budgetInput}
                onChangeText={v => setBudgetInput(v.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                dense
                autoFocus
                containerStyle={styles.flex}
                returnKeyType="done"
                onSubmitEditing={saveBudget}
                testID="budget-input"
              />
              <Button title="Save" icon={Check} size="sm" onPress={saveBudget} testID="save-budget-btn" />
            </View>
          </GlassCard>
        </Collapsible>

        {/* Budget consumption */}
        {budget > 0 && (
          <FadeIn delay={300}>
            <GlassCard>
              <View style={styles.cardHead}>
                <View style={styles.row}>
                  <PiggyBank size={16} color={C.brand500} />
                  <T variant="title">Budget Consumption</T>
                </View>
                <T variant="smallSemibold" color={overBudget ? C.red500 : C.emerald400}>
                  {formatCompactINR(totalSpent)} / {formatCompactINR(budget)}
                </T>
              </View>
              <ProgressBar pct={budgetUsedPct} colors={overBudget ? G.budgetOver : G.budgetOk} height={12} />
              {overBudget && (
                <T variant="smallMedium" color={C.red500} style={styles.note}>
                  Over budget by {formatCurrency(totalSpent - budget)} — time to go easy on the shopping? 😅
                </T>
              )}
            </GlassCard>
          </FadeIn>
        )}

        {/* Settlement progress */}
        {totalSettlements > 0 && (
          <FadeIn delay={350}>
            <GlassCard onPress={() => router.push('/settlements')} accessibilityLabel="Open payments">
              <View style={styles.cardHead}>
                <View style={styles.row}>
                  <TrendingUp size={16} color={C.brand500} />
                  <T variant="title">Settlement Progress</T>
                </View>
                <T variant="small" color={ink(0.6)}>{settledCount} of {totalSettlements} confirmed</T>
              </View>
              <ProgressBar pct={(settledCount / totalSettlements) * 100} colors={G.settle} height={8} />
              {isFullySettled && (
                <View style={[styles.row, styles.note]}>
                  <CircleCheck size={14} color={C.emerald400} />
                  <T variant="smallMedium" color={C.emerald400}>All settled! Trip is complete.</T>
                </View>
              )}
            </GlassCard>
          </FadeIn>
        )}

        {/* Category breakdown */}
        {categoryData.length > 0 && (
          <FadeIn delay={400}>
            <GlassCard>
              <View style={[styles.row, styles.cardTitle]}>
                <Sparkles size={16} color={C.brand500} />
                <T variant="title">Expense Breakdown</T>
              </View>
              <View style={styles.donutWrap}>
                <DonutChart data={categoryData} size={172} thickness={26}>
                  <T variant="label" color={ink(0.55)}>Total</T>
                  <T variant="moneySm">{formatCompactINR(totalSpent)}</T>
                </DonutChart>
              </View>
              <View style={styles.legend}>
                {categoryData.map(c => (
                  <View key={c.key} style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: c.color }]} />
                    <T variant="small" color={ink(0.62)}>{getCategoryIcon(c.key)} {getCategoryLabel(c.key)}</T>
                  </View>
                ))}
              </View>
            </GlassCard>
          </FadeIn>
        )}

        {/* Recent activity */}
        <FadeIn delay={450}>
          <GlassCard>
            <View style={styles.cardHead}>
              <T variant="title">Recent Expenses</T>
              <PressScale onPress={() => router.push('/expenses')} style={styles.row} haptic="selection">
                <T variant="smallMedium" color={C.brand500}>View all</T>
                <ArrowRight size={13} color={C.brand500} />
              </PressScale>
            </View>
            {recent.length === 0 ? (
              <View style={styles.empty}>
                <Receipt size={30} color={ink(0.35)} />
                <T variant="body" color={ink(0.6)}>No expenses yet</T>
                <Button title="Add the first one" icon={Plus} variant="soft" size="sm" onPress={() => router.push('/add-expense')} />
              </View>
            ) : (
              <View style={styles.list}>
                {recent.map((item, i) => (
                  <FadeIn key={item.id} delay={stagger(i, 500, 60)} direction="left">
                    <View style={styles.row}>
                      <View style={[styles.catTile, { backgroundColor: withAlpha(getCategoryColor(item.category), 0.14) }]}>
                        {item.hotel ? <Hotel size={16} color={C.brand500} /> : <T variant="body">{getCategoryIcon(item.category)}</T>}
                      </View>
                      <View style={styles.flex}>
                        <T variant="bodyMedium" numberOfLines={1}>{item.title}</T>
                        <T variant="small" color={ink(0.6)} numberOfLines={1}>{memberMap[item.paidBy]?.name ?? '—'}</T>
                      </View>
                      <T variant="title">{formatCurrency(item.amount)}</T>
                    </View>
                  </FadeIn>
                ))}
              </View>
            )}
          </GlassCard>
        </FadeIn>

        {/* Member balances */}
        {balances.length > 0 && (
          <FadeIn delay={500}>
            <GlassCard>
              <View style={styles.cardHead}>
                <T variant="title">Member Balances</T>
                <PressScale onPress={() => router.push('/members')} style={styles.row} haptic="selection">
                  <T variant="smallMedium" color={C.brand500}>Full view</T>
                  <ArrowRight size={13} color={C.brand500} />
                </PressScale>
              </View>
              <View style={styles.list}>
                {balances.map((b, i) => (
                  <FadeIn key={b.memberId} delay={stagger(i, 550, 50)}>
                    <View style={styles.row}>
                      <Avatar name={b.name} color={b.avatarColor} size="sm" />
                      <T variant="bodyMedium" numberOfLines={1} style={styles.flex}>
                        {b.name}{b.memberId === session?.memberId ? ' (you)' : ''}
                      </T>
                      <View style={styles.right}>
                        <T variant="title" color={b.netBalance > 0 ? C.emerald400 : b.netBalance < 0 ? C.red500 : ink(0.6)}>
                          {b.netBalance > 0 ? '+' : ''}{formatCurrency(b.netBalance)}
                        </T>
                        <T variant="tiny" color={ink(0.5)}>
                          {b.netBalance > 0 ? 'gets back' : b.netBalance < 0 ? 'owes' : 'settled'}
                        </T>
                      </View>
                    </View>
                  </FadeIn>
                ))}
              </View>
            </GlassCard>
          </FadeIn>
        )}
      </PageScroll>

      <FAB onPress={() => router.push('/add-expense')} />
      <Confetti shot={confetti} type="celebration" />
      <TripClosedOverlay visible={celebrate} onDismiss={() => setCelebrate(false)} tripName={trip.name} />
    </View>
  )
}

function TripClosedOverlay({ visible, onDismiss, tripName }: { visible: boolean; onDismiss: () => void; tripName: string }) {
  return (
    <Overlay visible={visible} onClose={onDismiss}>
      <GlassCard strong radius={28} padding={28} contentStyle={styles.closed}>
        <Trophy />
        <T variant="h2" center style={styles.closedTitle}>TRIP SUCCESSFULLY CLOSED</T>
        <T variant="body" color={ink(0.62)} center>
          <T variant="title">{tripName}</T> is fully settled!
        </T>
        <T variant="small" color={ink(0.6)} center style={styles.closedText}>
          Everyone’s accounts are balanced. Great trip! 🎉
        </T>
        <View style={styles.confirmedPill}>
          <CircleCheck size={16} color={C.emerald400} />
          <T variant="smallSemibold" color={C.emerald400}>All Payments Confirmed</T>
        </View>
        <Button title="Back to Dashboard" onPress={onDismiss} full />
      </GlassCard>
    </Overlay>
  )
}

function Trophy() {
  const reduced = useReducedMotion()
  const rot = useSharedValue(0)
  const scale = useSharedValue(1)
  useEffect(() => {
    if (reduced) return
    rot.value = withDelay(300, withSequence(
      withTiming(-10, { duration: 130 }), withTiming(10, { duration: 130 }), withTiming(-10, { duration: 130 }),
      withTiming(10, { duration: 130 }), withTiming(0, { duration: 130 })
    ))
    scale.value = withDelay(300, withSequence(withTiming(1.2, { duration: 320 }), withTiming(1, { duration: 320 })))
  }, [reduced, rot, scale])
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }, { scale: scale.value }] }))
  return (
    <Animated.View style={[styles.trophy, style]}>
      <T style={styles.trophyText}>🏆</T>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gap10: { gap: 10 },
  alignTop: { alignSelf: 'flex-start', marginTop: 2 },
  scenicCard: {
    height: 154,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: C.brand600,
  },
  scenicContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  scenicTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  scenicBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  tripName: { fontFamily: F.display, fontSize: 24, lineHeight: 30 },
  mono: { fontFamily: F.mono },
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  editBudget: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: whiteA(0.22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  cardTitle: { marginBottom: 14 },
  note: { marginTop: 10 },
  donutWrap: { alignItems: 'center', marginVertical: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  list: { gap: 14 },
  catTile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  closed: { alignItems: 'center', maxWidth: 360 },
  closedTitle: { fontFamily: F.display, marginBottom: 8 },
  closedText: { marginTop: 4, marginBottom: 20 },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: emerald(0.3),
    backgroundColor: emerald(0.1),
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  trophy: { marginBottom: 12 },
  trophyText: { fontSize: 60, lineHeight: 72 },
})
