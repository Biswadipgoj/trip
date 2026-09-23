// Page header used by the trip tabs (web: 40 px icon tile + title + subtitle,
// with an optional action on the right).
import { useCallback, useState, type ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { ArrowLeft, Check } from 'lucide-react-native'
import { C, G, brand600, emerald, ink } from '../../theme/colors'
import { SCREEN_PADDING } from '../../theme/spacing'
import { FadeIn } from '../animated/FadeInView'
import { BrandFooter } from './BrandFooter'
import { GradientText, T } from './Text'
import type { IconType } from './Button'

interface PageHeaderProps {
  icon: IconType
  title: string
  subtitle?: string
  /** Gradient icon tile + gradient title (web Report page style). */
  vivid?: boolean
  right?: ReactNode
}

export function PageHeader({ icon: Icon, title, subtitle, vivid, right }: PageHeaderProps) {
  return (
    <FadeIn>
      <View style={styles.row}>
        {vivid ? (
          <LinearGradient colors={G.indigoPurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
            <Icon size={20} color={C.white} strokeWidth={2.2} />
          </LinearGradient>
        ) : (
          <View style={[styles.tile, { backgroundColor: brand600(0.16) }]}>
            <Icon size={20} color={C.brand500} strokeWidth={2.2} />
          </View>
        )}
        <View style={styles.text}>
          {vivid ? (
            <GradientText variant="h2" style={styles.vividTitle}>{title}</GradientText>
          ) : (
            <T variant="h2" numberOfLines={1}>{title}</T>
          )}
          {subtitle ? <T variant="body" color={ink(0.6)} numberOfLines={2}>{subtitle}</T> : null}
        </View>
        {right}
      </View>
    </FadeIn>
  )
}

interface PageScrollProps {
  children: ReactNode
  /** Pull-to-refresh handler (usually a cloud sync). */
  onRefresh?: () => Promise<unknown> | void
  /** Extra space at the end so the FAB never covers the last card. */
  bottomPadding?: number
  gap?: number
}

/** Scrolling page body for the trip tabs, ending with the brand footer. */
export function PageScroll({ children, onRefresh, bottomPadding = 110, gap = 18 }: PageScrollProps) {
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await onRefresh?.()
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])
  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { gap, paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[C.brand500, C.fuchsia]}
            tintColor={C.brand500}
            progressBackgroundColor={C.white}
          />
        ) : undefined
      }
    >
      {children}
      <BrandFooter bottomPadding={0} />
    </ScrollView>
  )
}

/** "← Back" link at the top of the create / join / login flows. */
export function BackLink({ label = 'Back', onPress }: { label?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      hitSlop={10}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <ArrowLeft size={16} color={ink(0.65)} strokeWidth={2.2} />
      <T variant="bodyMedium" color={ink(0.65)}>{label}</T>
    </Pressable>
  )
}

/** Emerald check that springs in on success screens. */
export function SuccessCheck() {
  const reduced = useReducedMotion()
  return (
    <Animated.View
      entering={reduced ? undefined : ZoomIn.delay(100).springify().damping(12).stiffness(220)}
      style={styles.success}
    >
      <Check size={40} color={C.emerald400} strokeWidth={2.6} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: SCREEN_PADDING, paddingTop: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 6 },
  success: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: emerald(0.16),
    borderWidth: 1,
    borderColor: emerald(0.3),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    boxShadow: '0px 10px 30px rgba(29, 165, 120, 0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  vividTitle: { fontFamily: 'SpaceGrotesk_700Bold' },
})
