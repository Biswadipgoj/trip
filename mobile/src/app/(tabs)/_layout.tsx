// Trip area (web AppNav + trip layout): session guard, live cloud sync, the
// top bar, one shared liquid backdrop behind all tabs, and the five web tabs
// — Dashboard, Members, Expenses, Payments, Report.
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated'
import { Redirect, Tabs, useIsFocused } from 'expo-router'
import { WifiOff } from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { useSyncStatus } from '../../lib/synclog'
import { T } from '../../components/ui/Text'
import { useTripSync } from '../../lib/sync'
import { confirmAction } from '../../lib/dialogs'
import { leaveTrip } from '../../lib/nav'
import { TripTopBar } from '../../components/ui/AnimatedHeader'
import { LiquidBackground } from '../../components/ui/Screen'
import { TabBar } from '../../components/animated/AnimatedTabBar'
import { C, amber } from '../../theme/colors'

export const unstable_settings = { initialRouteName: 'dashboard' }

export default function TripTabsLayout() {
  const session = useStore(s => s.session)
  const trip = useStore(s => (s.session ? s.trips.find(t => t.id === s.session!.tripId) : undefined))
  const me = useStore(s => (s.session ? s.members.find(m => m.id === s.session!.memberId) : undefined))
  // Badge on Payments: dues I still have to pay.
  const myDues = useStore(s =>
    s.session
      ? s.settlements.filter(x => x.tripId === s.session!.tripId && x.status === 'pending' && x.fromMemberId === s.session!.memberId).length
      : 0
  )
  const logout = useStore(s => s.logout)
  const focused = useIsFocused()

  useTripSync(session?.tripId)

  if (!session) return <Redirect href="/login" />

  const onLogout = async () => {
    const ok = await confirmAction({
      title: 'Log out?',
      message: 'Your trip is safely saved in the cloud. Log in again anytime with your trip code, mobile number and PIN.',
      confirmLabel: 'Log out',
      destructive: true,
    })
    if (!ok) return
    logout()
    leaveTrip()
  }

  return (
    <View style={styles.root}>
      <LiquidBackground paused={!focused} />
      <TripTopBar
        tripId={session.tripId}
        tripName={trip?.name || 'TripMate'}
        subtitle={`${me?.name ? `${me.name} · ` : ''}${session.tripCode}`}
        onLogout={onLogout}
      />
      <OfflineBanner />
      <Tabs
        tabBar={props => <TabBar {...props} badges={{ settlements: myDues }} />}
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          lazy: true,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="members" options={{ title: 'Members' }} />
        <Tabs.Screen name="expenses" options={{ title: 'Expenses' }} />
        <Tabs.Screen name="settlements" options={{ title: 'Payments' }} />
        <Tabs.Screen name="analytics" options={{ title: 'Report' }} />
      </Tabs>
    </View>
  )
}

/** Offline banner: confirms all data stays safe on device and will auto-sync when back online. */
function OfflineBanner() {
  const online = useSyncStatus(s => s.online)
  const reduced = useReducedMotion()
  if (online) return null
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInUp.duration(260)}
      exiting={reduced ? undefined : FadeOutUp.duration(200)}
      style={styles.offline}
      accessibilityRole="alert"
    >
      <WifiOff size={16} color={C.amber700} strokeWidth={2.3} />
      <T variant="smallMedium" color={C.amber700} style={styles.flex}>
        Offline mode · All changes stay safe on this phone and will auto-sync when reconnected.
      </T>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface0 },
  flex: { flex: 1 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: amber(0.35),
    backgroundColor: 'rgba(255, 247, 230, 0.96)',
    boxShadow: '0px 6px 18px rgba(217, 119, 6, 0.15)',
  },
})
