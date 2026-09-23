// Landing (web /): logo pop, gradient wordmark, headline, three CTAs and the
// feature cards. Mobile additions: 20-Language switch, natural travel hero card,
// and "Recent Cloud Trips" for one-tap login.
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { Redirect, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowRight, ChevronRight, CircleCheck, LogIn, Receipt, Sparkles, UserPlus, Users } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { useTranslation } from '../lib/i18n'
import { Screen } from '../components/ui/Screen'
import { Logo } from '../components/ui/Logo'
import { GradientText, T } from '../components/ui/Text'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { BrandFooter } from '../components/ui/BrandFooter'
import { StatusBadge } from '../components/animated/PulseBadge'
import { FadeIn, stagger } from '../components/animated/FadeInView'
import { LanguagePicker, LanguageTriggerButton } from '../components/ui/LanguagePicker'
import { C, brand500, brand600, ink } from '../theme/colors'
import { F } from '../theme/typography'

const POP_SPRING = { stiffness: 300, damping: 20 }

function PoppingLogo() {
  const reduced = useReducedMotion()
  const scale = useSharedValue(reduced ? 1 : 0)
  const rotate = useSharedValue(reduced ? 0 : -20)
  const floatY = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    scale.value = withDelay(100, withSpring(1, POP_SPRING))
    rotate.value = withDelay(100, withSpring(0, POP_SPRING))
    floatY.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    )
  }, [reduced, scale, rotate, floatY])

  const pop = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
      { translateY: floatY.value },
    ],
  }))

  return (
    <Animated.View style={[styles.logoWrap, pop]}>
      <Logo size={104} />
    </Animated.View>
  )
}

export default function Home() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const session = useStore(s => s.session)
  const trips = useStore(s => s.trips)
  const members = useStore(s => s.members)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)

  // Trips someone can log in to (members with mobile + PIN).
  const localTrips = useMemo(
    () =>
      trips
        .map(t => ({ trip: t, people: members.filter(m => m.tripId === t.id) }))
        .filter(x => x.people.some(m => !!m.mobile && !!m.pin))
        .sort((a, b) => b.trip.createdAt.localeCompare(a.trip.createdAt))
        .slice(0, 5),
    [trips, members]
  )

  if (session?.tripId) return <Redirect href="/dashboard" />

  return (
    <Screen edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar with Language Selector */}
        <View style={styles.topRow}>
          <View style={styles.cloudChip}>
            <View style={styles.liveDot} />
            <T variant="tiny" color={C.emerald500}>Cloud Synced</T>
          </View>
          <LanguageTriggerButton onPress={() => setShowLanguagePicker(true)} />
        </View>

        <PoppingLogo />

        <FadeIn delay={250} direction="none">
          <GradientText center style={styles.wordmark}>{t('appName')}</GradientText>
          <View style={styles.pill}>
            <Sparkles size={14} color={C.brand500} strokeWidth={2.2} />
            <T variant="smallMedium" color={C.brand500}>{t('tagline')}</T>
          </View>
        </FadeIn>

        <FadeIn delay={300}>
          <T variant="hero" center>{t('splitHero')}</T>
          <GradientText variant="hero" center>{t('splitSub')}</GradientText>
        </FadeIn>

        <FadeIn delay={400}>
          <T variant="lead" color={ink(0.65)} center style={styles.lead}>
            {t('heroLead')}
          </T>
        </FadeIn>

        <FadeIn delay={500} style={styles.ctas}>
          <Button
            title={t('createTrip')}
            iconRight={ArrowRight}
            size="lg"
            onPress={() => router.push('/create-trip')}
            full
            testID="create-trip-btn"
          />
          <Button
            title={t('joinTrip')}
            icon={UserPlus}
            variant="ghost"
            size="lg"
            onPress={() => router.push('/join-trip')}
            full
            testID="join-trip-btn"
          />
          <Button
            title={t('login')}
            icon={LogIn}
            variant="ghost"
            size="lg"
            onPress={() => router.push('/login')}
            full
            testID="login-btn"
          />
        </FadeIn>

        {localTrips.length > 0 && (
          <FadeIn delay={600} style={styles.section}>
            <T variant="label" color={ink(0.55)} style={styles.sectionTitle}>{t('recentTrips')}</T>
            <View style={styles.list}>
              {localTrips.map(({ trip, people }) => (
                <GlassCard
                  key={trip.id}
                  padding={14}
                  onPress={() => router.push({ pathname: '/login', params: { code: trip.tripCode } })}
                  accessibilityLabel={`Log in to ${trip.name}`}
                >
                  <View style={styles.tripRow}>
                    <View style={styles.flex}>
                      <T variant="title" numberOfLines={1}>{trip.name}</T>
                      <T variant="small" color={ink(0.6)}>
                        <T variant="small" style={styles.code} color={C.brand500}>{trip.tripCode}</T>
                        {`  ·  ${people.length} member${people.length !== 1 ? 's' : ''}`}
                      </T>
                    </View>
                    <StatusBadge status={trip.status} />
                    <ChevronRight size={18} color={ink(0.4)} />
                  </View>
                </GlassCard>
              ))}
            </View>
          </FadeIn>
        )}

        <View style={styles.features}>
          <FadeIn delay={700}>
            <GlassCard contentStyle={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Users size={20} color={C.brand500} strokeWidth={2.2} />
              </View>
              <T variant="title" center>{t('feature1Title')}</T>
              <T variant="small" color={ink(0.65)} center>{t('feature1Desc')}</T>
            </GlassCard>
          </FadeIn>

          <FadeIn delay={800}>
            <GlassCard contentStyle={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Receipt size={20} color={C.brand500} strokeWidth={2.2} />
              </View>
              <T variant="title" center>{t('feature2Title')}</T>
              <T variant="small" color={ink(0.65)} center>{t('feature2Desc')}</T>
            </GlassCard>
          </FadeIn>

          <FadeIn delay={900}>
            <GlassCard contentStyle={styles.featureCard}>
              <View style={styles.featureIcon}>
                <CircleCheck size={20} color={C.brand500} strokeWidth={2.2} />
              </View>
              <T variant="title" center>{t('feature3Title')}</T>
              <T variant="small" color={ink(0.65)} center>{t('feature3Desc')}</T>
            </GlassCard>
          </FadeIn>
        </View>

        <BrandFooter />

        <LanguagePicker
          visible={showLanguagePicker}
          onClose={() => setShowLanguagePicker(false)}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cloudChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(29, 165, 120, 0.1)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.emerald500,
  },
  logoWrap: { alignSelf: 'center', marginBottom: 20 },
  wordmark: { fontFamily: F.display, fontSize: 34, lineHeight: 42, letterSpacing: -0.6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brand500(0.3),
    backgroundColor: brand600(0.08),
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 20,
  },
  lead: { marginTop: 12, marginBottom: 20, paddingHorizontal: 6 },
  ctas: { gap: 12 },
  section: { marginTop: 32 },
  sectionTitle: { marginBottom: 10, marginLeft: 4 },
  list: { gap: 10 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  code: { fontFamily: F.mono },
  features: { gap: 14, marginTop: 36 },
  featureCard: { alignItems: 'center', gap: 4 },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: brand600(0.12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
})
