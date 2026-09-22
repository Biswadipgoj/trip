import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Plus, Users, ArrowRight, ShieldCheck, Zap, Sparkles, MapPin } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { GlassCard } from '../components/ui/GlassCard'
import { formatCurrency, formatDate } from '../lib/utils'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function WelcomeScreen() {
  const router = useRouter()
  const trips = useStore(state => state.trips)
  const session = useStore(state => state.session)
  const setSession = useStore(state => state.setSession)
  const members = useStore(state => state.members)
  const expenses = useStore(state => state.expenses)

  const handleOpenTrip = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId)
    if (!trip) return

    const tripMembers = members.filter(m => m.tripId === tripId)
    // If we have an active session for this trip, go straight to dashboard
    if (session && session.tripId === tripId) {
      router.push('/(tabs)/dashboard')
      return
    }

    // If there's only 1 member (e.g. creator), log in or prompt PIN
    if (tripMembers.length === 1) {
      setSession({
        tripId,
        memberId: tripMembers[0].id,
        tripCode: trip.tripCode,
      })
      router.push('/(tabs)/dashboard')
    } else {
      // Go to member PIN selection screen
      router.push({ pathname: '/login', params: { tripId } })
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Banner */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={Colors.gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroIconBadge}>
              <Text style={styles.heroEmoji}>🌴✈️</Text>
            </View>
            <Text style={styles.appName}>TripMate</Text>
            <Text style={styles.tagline}>
              Smart group expense manager with 1-tap UPI settlements 💳
            </Text>

            {/* Quick Primary Actions */}
            <View style={styles.actionsRow}>
              <SpringPressable
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={() => router.push('/create-trip')}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={styles.buttonGradient}
                >
                  <Plus size={18} color="#FF6B6B" strokeWidth={2.5} />
                  <Text style={[styles.buttonText, { color: '#FF6B6B' }]}>
                    New Trip
                  </Text>
                </LinearGradient>
              </SpringPressable>

              <SpringPressable
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={() => router.push('/join-trip')}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={styles.buttonGradient}
                >
                  <Users size={18} color="#4E65FF" strokeWidth={2.5} />
                  <Text style={[styles.buttonText, { color: '#4E65FF' }]}>
                    Join Trip
                  </Text>
                </LinearGradient>
              </SpringPressable>
            </View>
          </LinearGradient>
        </View>

        {/* Active Trips Section */}
        {trips.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Trips</Text>
              <Text style={styles.tripCountBadge}>{trips.length}</Text>
            </View>

            {trips.map(trip => {
              const tripMembers = members.filter(m => m.tripId === trip.id)
              const tripExpenses = expenses.filter(e => e.tripId === trip.id)
              const totalSpent = tripExpenses.reduce((sum, e) => sum + e.amount, 0)

              return (
                <SpringPressable
                  key={trip.id}
                  style={styles.tripCardContainer}
                  onPress={() => handleOpenTrip(trip.id)}
                >
                  <GlassCard style={styles.tripCard}>
                    <View style={styles.tripCardHeader}>
                      <View style={styles.tripBadgeIcon}>
                        <MapPin size={18} color="#FF6B6B" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.tripName} numberOfLines={1}>
                          {trip.name}
                        </Text>
                        <Text style={styles.tripDate}>
                          Created {formatDate(trip.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.tripCodePill}>
                        <Text style={styles.tripCodeText}>{trip.tripCode}</Text>
                      </View>
                    </View>

                    <View style={styles.tripCardFooter}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Total Spend</Text>
                        <Text style={styles.statValue}>
                          {formatCurrency(totalSpent)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Members</Text>
                        <Text style={styles.statValue}>
                          👥 {tripMembers.length}
                        </Text>
                      </View>
                      <View style={styles.openArrowPill}>
                        <ArrowRight size={16} color="#6366F1" />
                      </View>
                    </View>
                  </GlassCard>
                </SpringPressable>
              )
            })}
          </View>
        )}

        {/* Feature Highlights Showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why TripMate?</Text>

          <GlassCard style={styles.featureCard}>
            <View style={[styles.featureIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Zap size={22} color="#6366F1" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Greedy Debt Minimization</Text>
              <Text style={styles.featureDesc}>
                Calculates the fewest possible transactions so everyone settles
                cleanly without endless back-and-forth payments.
              </Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.featureCard}>
            <View style={[styles.featureIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Sparkles size={22} color="#10B981" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Multi-Split & Hotel Rooms</Text>
              <Text style={styles.featureDesc}>
                Split equally, by exact amount, percentages, quantities, or by
                individual hotel room allocations with zero math errors.
              </Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.featureCard}>
            <View style={[styles.featureIconBox, { backgroundColor: '#FFF7ED' }]}>
              <ShieldCheck size={22} color="#F97316" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Instant UPI Deep Links</Text>
              <Text style={styles.featureDesc}>
                Pay any group member directly with 1-tap Google Pay, PhonePe, or
                Paytm using native UPI intent links.
              </Text>
            </View>
          </GlassCard>
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
    paddingBottom: 40,
  },
  heroSection: {
    padding: 16,
    paddingTop: 12,
  },
  heroGradient: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  heroIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroEmoji: {
    fontSize: 26,
  },
  appName: {
    ...Typography.h1,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  tagline: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 20,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 18,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  tripCountBadge: {
    marginLeft: 8,
    backgroundColor: '#EEF2FF',
    color: '#6366F1',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tripCardContainer: {
    marginBottom: 14,
  },
  tripCard: {
    padding: 18,
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  tripBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripName: {
    ...Typography.h3,
    color: Colors.text,
  },
  tripDate: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tripCodePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tripCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  tripCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: {
    gap: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  openArrowPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 16,
  },
  featureIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
})
