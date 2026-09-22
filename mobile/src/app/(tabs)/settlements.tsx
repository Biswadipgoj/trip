import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  HandCoins,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { Colors } from '../../theme/colors'
import { Typography } from '../../theme/typography'
import { SpringPressable } from '../../components/animated/SpringPressable'
import { ConfettiBlast } from '../../components/animated/ConfettiBlast'
import { GlassCard } from '../../components/ui/GlassCard'
import { Avatar } from '../../components/ui/Avatar'
import { formatCurrency } from '../../lib/utils'
import { SettlementRoute } from '../../types'

export default function SettlementsScreen() {
  const router = useRouter()
  const activeTrip = useStore(state => state.getActiveTrip())
  const currentMember = useStore(state => state.getCurrentMember())
  const tripId = activeTrip?.id || ''

  const routes = useStore(state => state.getTripSettlementRoutes(tripId))
  const settlements = useStore(state => state.getTripSettlements(tripId))
  const updateSettlementStatus = useStore(state => state.updateSettlementStatus)

  const [celebrate, setCelebrate] = useState(routes.length === 0)

  const getRouteStatus = (route: SettlementRoute) => {
    const existing = settlements.find(
      s => s.fromMemberId === route.fromMemberId && s.toMemberId === route.toMemberId
    )
    return existing?.status || 'pending'
  }

  const handleMarkPaid = (route: SettlementRoute) => {
    updateSettlementStatus(route, tripId, 'paid')
    Alert.alert('Payment Marked as Sent! 💸', 'Waiting for receiver to confirm.')
  }

  const handleConfirmPayment = (route: SettlementRoute) => {
    updateSettlementStatus(route, tripId, 'confirmed')
    Alert.alert('Payment Confirmed! ✅', 'Balances have been updated.')
  }

  const handleOpenPayment = (route: SettlementRoute) => {
    router.push({
      pathname: '/payment-modal',
      params: {
        fromId: route.fromMemberId,
        toId: route.toMemberId,
        amount: route.amount.toString(),
        fromName: route.fromName,
        toName: route.toName,
        toUpi: route.toUpiId || '',
      },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      {routes.length === 0 && <ConfettiBlast />}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Settlements</Text>
          <Text style={styles.headerSubtitle}>
            Minimized debt matching with 1-tap UPI
          </Text>
        </View>

        <View style={styles.minimizerPill}>
          <Zap size={14} color="#6366F1" />
          <Text style={styles.minimizerText}>
            {routes.length} transfers needed
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* If completely settled */}
        {routes.length === 0 ? (
          <GlassCard style={styles.celebrationCard}>
            <LinearGradient
              colors={Colors.gradients.mint}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.celebrationGradient}
            >
              <Text style={styles.celebrationEmoji}>🎉🏆</Text>
              <Text style={styles.celebrationTitle}>All Settled Up!</Text>
              <Text style={styles.celebrationSubtitle}>
                Everyone has balanced out! There are zero outstanding dues in
                this trip.
              </Text>
            </LinearGradient>
          </GlassCard>
        ) : (
          <View style={styles.infoBanner}>
            <Sparkles size={16} color="#6366F1" />
            <Text style={styles.infoBannerText}>
              Algorithm reduced everyone's expenses into the absolute minimum
              number of transfers!
            </Text>
          </View>
        )}

        {/* Routes List */}
        {routes.map(route => {
          const status = getRouteStatus(route)
          const isPending = status === 'pending'
          const isPaid = status === 'paid'
          const isConfirmed = status === 'confirmed'

          const isUserPaying = currentMember?.id === route.fromMemberId
          const isUserReceiving = currentMember?.id === route.toMemberId

          return (
            <GlassCard key={route.id} style={styles.routeCard}>
              <View style={styles.routeHeader}>
                {/* From member */}
                <View style={styles.memberSide}>
                  <Avatar name={route.fromName} color={route.fromColor} size={36} />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {route.fromName}
                  </Text>
                  <Text style={styles.roleText}>Owes</Text>
                </View>

                {/* Arrow and amount */}
                <View style={styles.arrowCol}>
                  <Text style={styles.routeAmount}>
                    {formatCurrency(route.amount)}
                  </Text>
                  <View style={styles.arrowCircle}>
                    <ArrowRight size={14} color="#6366F1" />
                  </View>
                </View>

                {/* To member */}
                <View style={styles.memberSide}>
                  <Avatar name={route.toName} color={route.toColor} size={36} />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {route.toName}
                  </Text>
                  <Text style={styles.roleText}>Receives</Text>
                </View>
              </View>

              {/* Status pill */}
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusBadge,
                    isPending && styles.badgePending,
                    isPaid && styles.badgePaid,
                    isConfirmed && styles.badgeConfirmed,
                  ]}
                >
                  {isPending && <Clock size={12} color="#D97706" />}
                  {isPaid && <HandCoins size={12} color="#2563EB" />}
                  {isConfirmed && <CheckCircle2 size={12} color="#059669" />}
                  <Text
                    style={[
                      styles.statusText,
                      isPending && styles.textPending,
                      isPaid && styles.textPaid,
                      isConfirmed && styles.textConfirmed,
                    ]}
                  >
                    {isPending
                      ? 'Payment Pending'
                      : isPaid
                      ? 'Marked as Paid'
                      : 'Confirmed & Settled'}
                  </Text>
                </View>

                {/* UPI ID note */}
                {route.toUpiId && (
                  <Text style={styles.upiNoteText}>UPI: {route.toUpiId}</Text>
                )}
              </View>

              {/* Action Buttons */}
              {!isConfirmed && (
                <View style={styles.actionButtonsRow}>
                  {/* Pay via UPI button */}
                  <SpringPressable
                    style={[styles.payUpiButton, { flex: 1 }]}
                    onPress={() => handleOpenPayment(route)}
                  >
                    <LinearGradient
                      colors={Colors.gradients.sunset}
                      style={styles.payUpiGradient}
                    >
                      <HandCoins size={16} color="#FFFFFF" />
                      <Text style={styles.payUpiText}>Pay via UPI ⚡</Text>
                    </LinearGradient>
                  </SpringPressable>

                  {/* Mark Paid / Confirm */}
                  {isPending ? (
                    <SpringPressable
                      style={styles.markPaidButton}
                      onPress={() => handleMarkPaid(route)}
                    >
                      <Text style={styles.markPaidText}>Mark Paid</Text>
                    </SpringPressable>
                  ) : (
                    <SpringPressable
                      style={styles.confirmButton}
                      onPress={() => handleConfirmPayment(route)}
                    >
                      <Text style={styles.confirmText}>Confirm Receipt</Text>
                    </SpringPressable>
                  )}
                </View>
              )}
            </GlassCard>
          )
        })}
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  minimizerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  minimizerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  celebrationCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 20,
  },
  celebrationGradient: {
    padding: 28,
    alignItems: 'center',
    borderRadius: 20,
  },
  celebrationEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  celebrationTitle: {
    ...Typography.h1,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  celebrationSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#4338CA',
    lineHeight: 16,
    fontWeight: '500',
  },
  routeCard: {
    marginBottom: 14,
    padding: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  memberSide: {
    alignItems: 'center',
    width: 84,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  roleText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  arrowCol: {
    alignItems: 'center',
    gap: 4,
  },
  routeAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgePaid: {
    backgroundColor: '#DBEAFE',
  },
  badgeConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textPending: {
    color: '#B45309',
  },
  textPaid: {
    color: '#1D4ED8',
  },
  textConfirmed: {
    color: '#15803D',
  },
  upiNoteText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  payUpiButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  payUpiGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 14,
  },
  payUpiText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  markPaidButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markPaidText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
})
