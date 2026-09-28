// Trip area (web AppNav + trip layout): session guard, live cloud sync, the
// top bar, one shared liquid backdrop behind all tabs, and the five web tabs
// — Dashboard, Members, Expenses, Payments, Report.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LAST_MOBILE_KEY, isValidMobile } from '../../lib/tripLogin'
import { StyleSheet, View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { useStore } from '../../lib/store'
import { useTripSync } from '../../lib/sync'
import { confirmAction } from '../../lib/dialogs'
import { leaveTrip } from '../../lib/nav'
import { TripTopBar } from '../../components/ui/AnimatedHeader'
import { LiquidBackground } from '../../components/ui/Screen'
import { TabBar } from '../../components/animated/AnimatedTabBar'
import { C } from '../../theme/colors'
import { useTranslation } from '../../lib/i18n'
import { serverLogout } from '../../lib/session'

export const unstable_settings = { initialRouteName: 'dashboard' }

export default function TripTabsLayout() {
  const { t } = useTranslation()
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

  useTripSync(session?.tripId)

  if (!session) return <Redirect href="/login" />

  const onLogout = async () => {
    const ok = await confirmAction({
      title: 'Log out?',
      message: 'Your trip is safely saved in the cloud. Log in again anytime with your mobile number and PIN.',
      confirmLabel: 'Log out',
      destructive: true,
    })
    if (!ok) return
    // Remember the number so logging back in starts with it filled in.
    if (me?.mobile && isValidMobile(me.mobile)) AsyncStorage.setItem(LAST_MOBILE_KEY, me.mobile).catch(() => {})
    // Ends this trip on the server too, so the phone's saved token no longer opens it.
    void serverLogout(session.tripId).catch(() => {})
    logout()
    leaveTrip()
  }

  return (
    <View style={styles.root}>
      <LiquidBackground />
      <TripTopBar
        tripId={session.tripId}
        tripName={trip?.name || 'TripMate'}
        subtitle={`${me?.name ? `${me.name} · ` : ''}${session.tripCode}`}
        onLogout={onLogout}
      />
      <Tabs
        tabBar={props => <TabBar {...props} badges={{ settlements: myDues }} />}
        screenOptions={{
          headerShown: false,
          // Tabs are peers: switching is instant, never a slide.
          animation: 'none',
          lazy: true,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: t('dashboard') }} />
        <Tabs.Screen name="members" options={{ title: t('members') }} />
        <Tabs.Screen name="expenses" options={{ title: t('expenses') }} />
        <Tabs.Screen name="settlements" options={{ title: t('payments') }} />
        <Tabs.Screen name="analytics" options={{ title: t('report') }} />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface0 },
  flex: { flex: 1 },
})
