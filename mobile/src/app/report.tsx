import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Share,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Share2,
  PieChart,
  Award,
  Wallet,
  Receipt,
  Users,
} from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { GlassCard } from '../components/ui/GlassCard'
import { Avatar } from '../components/ui/Avatar'
import {
  formatCurrency,
  getCategoryIcon,
  getCategoryLabel,
  getCategoryGradientColors,
} from '../lib/utils'

export default function ReportScreen() {
  const router = useRouter()
  const activeTrip = useStore(state => state.getActiveTrip())
  const tripId = activeTrip?.id || ''

  const members = useStore(state => state.getTripMembers(tripId))
  const expenses = useStore(state => state.getTripExpenses(tripId))
  const hotelExpenses = useStore(state => state.getTripHotelExpenses(tripId))
  const balances = useStore(state => state.getTripBalances(tripId))

  const totalSpent = useMemo(() => {
    const expTotal = expenses.reduce((s, e) => s + e.amount, 0)
    const hotelTotal = hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)
    return expTotal + hotelTotal
  }, [expenses, hotelExpenses])

  const avgPerMember = members.length > 0 ? totalSpent / members.length : 0

  // Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {}
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount
    })
    if (hotelExpenses.length > 0) {
      const hotelSum = hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)
      totals['stay'] = (totals['stay'] || 0) + hotelSum
    }
    return Object.entries(totals)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percent: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, hotelExpenses, totalSpent])

  // Highest spender
  const topSpender = useMemo(() => {
    if (balances.length === 0) return null
    return [...balances].sort((a, b) => b.totalPaid - a.totalPaid)[0]
  }, [balances])

  // Highest expense
  const highestExpense = useMemo(() => {
    if (expenses.length === 0 && hotelExpenses.length === 0) return null
    const all = [
      ...expenses.map(e => ({ title: e.title, amount: e.amount, cat: e.category })),
      ...hotelExpenses.map(h => ({ title: h.title, amount: h.totalAmount, cat: 'stay' })),
    ]
    return all.sort((a, b) => b.amount - a.amount)[0]
  }, [expenses, hotelExpenses])

  const handleShareReport = async () => {
    if (!activeTrip) return
    let text = `📊 Trip Summary: ${activeTrip.name} (Code: ${activeTrip.tripCode})\n`
    text += `💰 Total Spend: ${formatCurrency(totalSpent)}\n`
    text += `👥 Members: ${members.length} | Avg/Person: ${formatCurrency(avgPerMember)}\n\n`
    text += `Categories:\n`
    categoryBreakdown.forEach(c => {
      text += `• ${getCategoryIcon(c.category)} ${getCategoryLabel(c.category)}: ${formatCurrency(
        c.amount
      )} (${c.percent.toFixed(1)}%)\n`
    })
    await Share.share({
      message: text,
      title: `${activeTrip.name} - Trip Expense Report`,
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SpringPressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={22} color={Colors.text} />
        </SpringPressable>
        <Text style={styles.headerTitle}>Trip Analytics</Text>
        <SpringPressable
          style={styles.shareButton}
          onPress={handleShareReport}
        >
          <Share2 size={20} color={Colors.text} />
        </SpringPressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Hero Card */}
        <LinearGradient
          colors={Colors.gradients.sunset}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerHero}
        >
          <Text style={styles.bannerTripName}>{activeTrip?.name}</Text>
          <Text style={styles.bannerLabel}>Total Trip Expenditure</Text>
          <Text style={styles.bannerTotal}>{formatCurrency(totalSpent)}</Text>

          <View style={styles.heroSubStats}>
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>Avg / Person</Text>
              <Text style={styles.subStatVal}>{formatCurrency(avgPerMember)}</Text>
            </View>
            <View style={styles.subStatDivider} />
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>Transactions</Text>
              <Text style={styles.subStatVal}>
                {expenses.length + hotelExpenses.length}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Highlights Row */}
        <View style={styles.highlightsRow}>
          {topSpender && (
            <GlassCard style={[styles.highlightCard, { flex: 1 }]}>
              <View style={[styles.highlightIcon, { backgroundColor: '#FEF3C7' }]}>
                <Award size={18} color="#D97706" />
              </View>
              <Text style={styles.highlightSub}>Top Spender</Text>
              <Text style={styles.highlightTitle} numberOfLines={1}>
                {topSpender.name}
              </Text>
              <Text style={styles.highlightAmount}>
                {formatCurrency(topSpender.totalPaid)}
              </Text>
            </GlassCard>
          )}

          {highestExpense && (
            <GlassCard style={[styles.highlightCard, { flex: 1 }]}>
              <View style={[styles.highlightIcon, { backgroundColor: '#EEF2FF' }]}>
                <Receipt size={18} color="#6366F1" />
              </View>
              <Text style={styles.highlightSub}>Biggest Expense</Text>
              <Text style={styles.highlightTitle} numberOfLines={1}>
                {highestExpense.title}
              </Text>
              <Text style={styles.highlightAmount}>
                {formatCurrency(highestExpense.amount)}
              </Text>
            </GlassCard>
          )}
        </View>

        {/* Category Breakdown */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardSectionTitle}>Category Breakdown</Text>
          {categoryBreakdown.map(item => {
            const gradient = getCategoryGradientColors(item.category)
            return (
              <View key={item.category} style={styles.catRow}>
                <View style={styles.catMetaRow}>
                  <View style={styles.catNameGroup}>
                    <Text style={styles.catEmoji}>
                      {getCategoryIcon(item.category)}
                    </Text>
                    <Text style={styles.catName}>
                      {getCategoryLabel(item.category)}
                    </Text>
                  </View>
                  <View style={styles.catAmtGroup}>
                    <Text style={styles.catAmt}>
                      {formatCurrency(item.amount)}
                    </Text>
                    <Text style={styles.catPercent}>
                      {item.percent.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${item.percent}%` }]}
                  />
                </View>
              </View>
            )
          })}
        </GlassCard>

        {/* Member Spending Shares */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardSectionTitle}>Member Contributions</Text>
          {balances.map(b => {
            const isPositive = b.netBalance > 0.01
            const isNegative = b.netBalance < -0.01
            const sharePercent =
              totalSpent > 0 ? (b.totalOwed / totalSpent) * 100 : 0

            return (
              <View key={b.memberId} style={styles.memberShareRow}>
                <Avatar name={b.name} color={b.avatarColor} size={36} />
                <View style={styles.memberShareInfo}>
                  <View style={styles.memberShareTop}>
                    <Text style={styles.memberName}>{b.name}</Text>
                    <Text
                      style={[
                        styles.memberNetText,
                        {
                          color: isPositive
                            ? '#059669'
                            : isNegative
                            ? '#DC2626'
                            : '#64748B',
                        },
                      ]}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrency(b.netBalance)}
                    </Text>
                  </View>
                  <View style={styles.memberShareSub}>
                    <Text style={styles.memberPaidSub}>
                      Paid: {formatCurrency(b.totalPaid)} • Owed:{' '}
                      {formatCurrency(b.totalOwed)}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bannerHero: {
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  bannerTripName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  bannerTotal: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginVertical: 6,
  },
  heroSubStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  subStatItem: {
    alignItems: 'center',
  },
  subStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
  subStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  subStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  highlightsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  highlightCard: {
    padding: 14,
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  highlightSub: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginVertical: 2,
  },
  highlightAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6366F1',
  },
  card: {
    marginBottom: 16,
    padding: 18,
  },
  cardSectionTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 14,
  },
  catRow: {
    marginBottom: 14,
  },
  catMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catEmoji: {
    fontSize: 16,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  catAmtGroup: {
    alignItems: 'flex-end',
  },
  catAmt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  catPercent: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  memberShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  memberShareInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberShareTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  memberNetText: {
    fontSize: 14,
    fontWeight: '800',
  },
  memberShareSub: {
    marginTop: 2,
  },
  memberPaidSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
})
