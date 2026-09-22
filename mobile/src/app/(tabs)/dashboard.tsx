import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Share,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import {
  Plus,
  Share2,
  Copy,
  Receipt,
  Hotel,
  PieChart,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { Colors } from '../../theme/colors'
import { Typography } from '../../theme/typography'
import { SpringPressable } from '../../components/animated/SpringPressable'
import { SlotCounter } from '../../components/animated/SlotCounter'
import { PulseBadge } from '../../components/animated/PulseBadge'
import { GlassCard } from '../../components/ui/GlassCard'
import { Avatar } from '../../components/ui/Avatar'
import { CategoryChip } from '../../components/ui/CategoryChip'
import {
  formatCurrency,
  formatDate,
  createShortJoinLink,
  createTripShareMessage,
  getCategoryIcon,
} from '../../lib/utils'

export default function DashboardScreen() {
  const router = useRouter()
  const activeTrip = useStore(state => state.getActiveTrip())
  const currentMember = useStore(state => state.getCurrentMember())
  const tripId = activeTrip?.id || ''

  const members = useStore(state => state.getTripMembers(tripId))
  const expenses = useStore(state => state.getTripExpenses(tripId))
  const hotelExpenses = useStore(state => state.getTripHotelExpenses(tripId))
  const balances = useStore(state => state.getTripBalances(tripId))
  const routes = useStore(state => state.getTripSettlementRoutes(tripId))

  // Memoized calculations for ultra-fast performance
  const totalSpent = useMemo(() => {
    const regTotal = expenses.reduce((sum, e) => sum + e.amount, 0)
    const hotelTotal = hotelExpenses.reduce((sum, h) => sum + h.totalAmount, 0)
    return regTotal + hotelTotal
  }, [expenses, hotelExpenses])

  const userBalance = useMemo(() => {
    if (!currentMember) return null
    return balances.find(b => b.memberId === currentMember.id) || null
  }, [balances, currentMember])

  const netAmount = userBalance?.netBalance || 0
  const isPositive = netAmount > 0.01
  const isNegative = netAmount < -0.01
  const isSettled = !isPositive && !isNegative

  // Category breakdown for summary
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount
    })
    if (hotelExpenses.length > 0) {
      const hotelSum = hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)
      totals['stay'] = (totals['stay'] || 0) + hotelSum
    }
    return totals
  }, [expenses, hotelExpenses])

  // Copy Short Join Link
  const handleCopyLink = async () => {
    if (!activeTrip) return
    const shortLink = createShortJoinLink(activeTrip.tripCode)
    await Clipboard.setStringAsync(shortLink)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Link Copied! 📋', `Short invite link copied:\n${shortLink}`)
  }

  // Share Full Short Message
  const handleShare = async () => {
    if (!activeTrip) return
    const msg = createTripShareMessage(activeTrip.name, activeTrip.tripCode)
    await Share.share({
      message: msg,
      title: `Join ${activeTrip.name} on TripMate`,
    })
  }

  if (!activeTrip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No Active Trip</Text>
          <Text style={styles.emptySubtitle}>
            Create or join a trip to start managing expenses.
          </Text>
          <SpringPressable
            style={styles.createButton}
            onPress={() => router.push('/create-trip')}
          >
            <Text style={styles.createButtonText}>Create a Trip 🚀</Text>
          </SpringPressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Card */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.tripMetaRow}>
              <PulseBadge>
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>ACTIVE TRIP</Text>
                </View>
              </PulseBadge>
              <Text style={styles.memberCountBadge}>👥 {members.length} members</Text>
            </View>
            <Text style={styles.tripTitle} numberOfLines={1}>
              {activeTrip.name}
            </Text>
          </View>

          {/* Quick Share / Code Pill */}
          <View style={styles.codeShareCol}>
            <SpringPressable
              style={styles.codeButton}
              onPress={handleCopyLink}
            >
              <Text style={styles.codeText}>{activeTrip.tripCode}</Text>
              <Copy size={13} color="#6366F1" style={{ marginLeft: 4 }} />
            </SpringPressable>

            <SpringPressable
              style={styles.shareIconButton}
              onPress={handleShare}
            >
              <Share2 size={16} color="#475569" />
            </SpringPressable>
          </View>
        </View>

        {/* Hero User Net Balance Card */}
        <GlassCard style={styles.heroCard}>
          <LinearGradient
            colors={
              isPositive
                ? ['#ECFDF5', '#D1FAE5'] // Mint gradient for credit
                : isNegative
                ? ['#FFF1F2', '#FFE4E6'] // Rose gradient for debt
                : ['#F8FAFC', '#EEF2FF'] // Neutral gradient for settled
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCardGradient}
          >
            <View style={styles.heroCardHeader}>
              <View>
                <Text style={styles.heroCardSub}>
                  {currentMember ? `${currentMember.name}'s Net Balance` : 'Your Balance'}
                </Text>
                <View style={styles.heroAmountRow}>
                  <Text
                    style={[
                      styles.heroSign,
                      {
                        color: isPositive
                          ? '#059669'
                          : isNegative
                          ? '#DC2626'
                          : '#475569',
                      },
                    ]}
                  >
                    {isPositive ? '+' : isNegative ? '-' : ''}
                  </Text>
                  <SlotCounter
                    value={Math.abs(netAmount)}
                    style={[
                      styles.heroAmount,
                      {
                        color: isPositive
                          ? '#059669'
                          : isNegative
                          ? '#DC2626'
                          : '#475569',
                      },
                    ]}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isPositive
                      ? '#10B981'
                      : isNegative
                      ? '#EF4444'
                      : '#64748B',
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {isPositive
                    ? 'GET BACK'
                    : isNegative
                    ? 'YOU OWE'
                    : 'SETTLED UP'}
                </Text>
              </View>
            </View>

            {/* Breakdown Sub-Row */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#EEF2FF' }]}>
                  <ArrowUpRight size={14} color="#6366F1" />
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>Total Paid</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(userBalance?.totalPaid || 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#FFF7ED' }]}>
                  <ArrowDownLeft size={14} color="#EA580C" />
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>Your Share</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(userBalance?.totalOwed || 0)}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </GlassCard>

        {/* Quick Action Buttons Grid */}
        <View style={styles.quickActionsGrid}>
          <SpringPressable
            style={[styles.actionButton, { flex: 1 }]}
            onPress={() => router.push('/add-expense')}
          >
            <LinearGradient
              colors={Colors.gradients.sunset}
              style={styles.actionGradient}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.actionText}>Add Expense</Text>
            </LinearGradient>
          </SpringPressable>

          <SpringPressable
            style={[styles.actionButton, { flex: 1 }]}
            onPress={() => router.push('/add-hotel')}
          >
            <LinearGradient
              colors={Colors.gradients.ocean}
              style={styles.actionGradient}
            >
              <Hotel size={20} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.actionText}>Hotel Stay</Text>
            </LinearGradient>
          </SpringPressable>
        </View>

        {/* Total Spend & Budget Progress */}
        <GlassCard style={styles.tripSpendCard}>
          <View style={styles.spendHeader}>
            <View>
              <Text style={styles.spendTitle}>Trip Total Spend</Text>
              <SlotCounter
                value={totalSpent}
                style={styles.spendAmount}
              />
            </View>
            <SpringPressable
              style={styles.reportPill}
              onPress={() => router.push('/report')}
            >
              <PieChart size={14} color="#6366F1" />
              <Text style={styles.reportPillText}>Analytics</Text>
            </SpringPressable>
          </View>

          {activeTrip.budget && (
            <View style={styles.budgetSection}>
              <View style={styles.budgetMeta}>
                <Text style={styles.budgetLabel}>
                  Budget: {formatCurrency(activeTrip.budget)}
                </Text>
                <Text style={styles.budgetPercent}>
                  {Math.round((totalSpent / activeTrip.budget) * 100)}% used
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        (totalSpent / activeTrip.budget) * 100,
                        100
                      )}%`,
                      backgroundColor:
                        totalSpent > activeTrip.budget ? '#EF4444' : '#10B981',
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </GlassCard>

        {/* Category Breakdown Chips */}
        {Object.keys(categoryTotals).length > 0 && (
          <View style={styles.categoriesSection}>
            <Text style={styles.sectionTitle}>Spending Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {Object.entries(categoryTotals).map(([cat, amt]) => (
                <View key={cat} style={styles.categoryCard}>
                  <Text style={styles.categoryEmoji}>{getCategoryIcon(cat)}</Text>
                  <Text style={styles.categoryAmt}>{formatCurrency(amt)}</Text>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {cat.toUpperCase()}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent Expenses List */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            <SpringPressable onPress={() => router.push('/(tabs)/expenses')}>
              <Text style={styles.viewAllText}>View All ({expenses.length + hotelExpenses.length})</Text>
            </SpringPressable>
          </View>

          {expenses.length === 0 && hotelExpenses.length === 0 ? (
            <GlassCard style={styles.emptyExpensesCard}>
              <Receipt size={32} color={Colors.textMuted} />
              <Text style={styles.noExpensesText}>No expenses logged yet</Text>
              <Text style={styles.noExpensesSub}>
                Tap "+ Add Expense" above to log the first meal, cab, or tickets!
              </Text>
            </GlassCard>
          ) : (
            expenses.slice(0, 5).map(e => {
              const payer = members.find(m => m.id === e.paidBy)
              return (
                <GlassCard key={e.id} style={styles.expenseRow}>
                  <CategoryChip category={e.category} size="sm" />
                  <View style={styles.expenseRowCenter}>
                    <Text style={styles.expenseTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.expensePayer}>
                      Paid by {payer?.name || 'Member'} • {formatDate(e.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>
                    {formatCurrency(e.amount)}
                  </Text>
                </GlassCard>
              )
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  memberCountBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tripTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  codeShareCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  shareIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroCardGradient: {
    padding: 20,
    borderRadius: 20,
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroCardSub: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroSign: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 2,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  breakdownItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 10,
  },
  breakdownIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 18,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tripSpendCard: {
    marginBottom: 16,
    padding: 18,
  },
  spendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spendTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  spendAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  reportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  reportPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  budgetSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  budgetPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoriesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: 12,
  },
  categoryScroll: {
    gap: 10,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    minWidth: 90,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  categoryEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  categoryAmt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  categoryName: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  recentSection: {
    marginTop: 4,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  emptyExpensesCard: {
    alignItems: 'center',
    padding: 24,
  },
  noExpensesText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  noExpensesSub: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 12,
  },
  expenseRowCenter: {
    flex: 1,
    marginLeft: 10,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  expensePayer: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 16,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
})
