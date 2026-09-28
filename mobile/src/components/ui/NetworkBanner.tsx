// Connection notice that drops in from the top of the screen, app-wide.
//   offline → a dark card slides down; its signal bars sweep, searching.
//   back    → the bars fill green one by one, "Back online", then it slides away.
// After 4 s (or on tap) the offline card tucks into a small pill that stays
// until the connection returns; tap the pill to read the details again.
// Reduced motion: plain fades, no sweep.
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing, cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSyncStatus } from '../../lib/synclog'
import { useTranslation } from '../../lib/i18n'
import { tick } from '../animated/SpringPressable'
import { T } from './Text'
import { F } from '../../theme/typography'

type Mode = 'hidden' | 'offline' | 'back'

const BACK_VISIBLE_MS = 2400
const AUTO_TUCK_MS = 4000
/** The tucked pill rests just below a screen's top bar, clear of its buttons. */
const TUCK_DROP = 58
const HIDDEN_Y = -160
const BAR_HEIGHTS = [5, 8, 11, 14]
const AMBER = '#FBBF24'
const GREEN = '#34D399'

export function NetworkBanner() {
  const online = useSyncStatus(s => s.online)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const [mode, setMode] = useState<Mode>('hidden')
  const [compact, setCompact] = useState(false)
  const [mounted, setMounted] = useState(false)
  const wasOnline = useRef(online)

  const y = useSharedValue(HIDDEN_Y)
  const opacity = useSharedValue(0)
  const scan = useSharedValue(0) // 0→4 sweep across the bars while offline
  const fill = useSharedValue(0) // 0→4 bars turning green when back
  const drop = useSharedValue(0) // extra offset while tucked

  // Online/offline transitions.
  useEffect(() => {
    if (online === wasOnline.current) return
    wasOnline.current = online
    if (!online) {
      setCompact(false)
      setMode('offline')
      tick('warning')
    } else {
      setMode(m => (m === 'hidden' ? 'hidden' : 'back'))
    }
  }, [online])

  // Show / hide and the bar animations for each mode.
  useEffect(() => {
    const show = mode !== 'hidden'
    if (show) setMounted(true)
    if (reduced) {
      y.value = show ? 0 : HIDDEN_Y
      opacity.value = withTiming(show ? 1 : 0, { duration: 180 })
    } else {
      y.value = show ? withSpring(0, { damping: 16, stiffness: 180, mass: 0.9 }) : withTiming(HIDDEN_Y, { duration: 260, easing: Easing.in(Easing.cubic) })
      opacity.value = withTiming(show ? 1 : 0, { duration: show ? 160 : 240 })
    }

    cancelAnimation(scan)
    if (mode === 'offline') {
      fill.value = 0
      scan.value = 0
      // Three sweeps ("searching"), then the bars rest: nothing loops forever.
      if (!reduced) scan.value = withRepeat(withTiming(4, { duration: 1500, easing: Easing.inOut(Easing.quad) }), 3, false)
      // Tuck into a small pill so it never keeps covering the trip header's controls.
      const tuck = setTimeout(() => setCompact(true), AUTO_TUCK_MS)
      return () => clearTimeout(tuck)
    }
    if (!show) {
      // Unmount after the slide-out so it never sits over the screen.
      const timer = setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(timer)
    }
    if (mode === 'back') {
      fill.value = reduced ? 4 : withTiming(4, { duration: 520, easing: Easing.out(Easing.cubic) })
      tick('success')
      const timer = setTimeout(() => setMode('hidden'), BACK_VISIBLE_MS)
      return () => clearTimeout(timer)
    }
  }, [mode, reduced, y, opacity, scan, fill])

  // Tucking glides the pill down below the top bar; un-tucking brings it back.
  const tucked = compact && mode === 'offline'
  useEffect(() => {
    drop.value = reduced ? (tucked ? TUCK_DROP : 0) : withSpring(tucked ? TUCK_DROP : 0, { damping: 18, stiffness: 200 })
  }, [tucked, reduced, drop])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value + drop.value }],
  }))

  if (!mounted && mode === 'hidden') return null

  const back = mode === 'back'
  const title = back ? t('backOnline') : t('noInternet')
  const body = back ? t('backOnlineSyncing') : t('offlineSaved')

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 6 }]}>
      <Animated.View style={[styles.card, compact && !back && styles.cardCompact, back && styles.cardBack, cardStyle]}>
        <Pressable
          onPress={() => !back && setCompact(c => !c)}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${title}. ${body}`}
          accessibilityHint={back ? undefined : compact ? 'Shows the details' : 'Makes this smaller'}
          style={[styles.row, compact && !back && styles.rowCompact]}
        >
          <View style={[styles.iconWell, back && styles.iconWellBack, compact && !back && styles.iconWellCompact]}>
            <SignalBars scan={scan} fill={fill} back={back} />
          </View>
          <View style={styles.text}>
            <T style={[styles.title, compact && !back && styles.titleCompact]} maxFontSizeMultiplier={1.3}>{title}</T>
            {!compact || back ? (
              <T style={styles.body} numberOfLines={2} maxFontSizeMultiplier={1.3}>{body}</T>
            ) : null}
          </View>
          {!back && !compact ? <View style={styles.dot} /> : null}
        </Pressable>
      </Animated.View>
    </View>
  )
}

/** Four rising bars. Offline: a highlight sweeps across them. Back: they fill green in turn. */
function SignalBars({ scan, fill, back }: { scan: SharedValue<number>; fill: SharedValue<number>; back: boolean }) {
  return (
    <View style={styles.bars}>
      {BAR_HEIGHTS.map((h, i) => (
        <Bar key={i} index={i} height={h} scan={scan} fill={fill} back={back} />
      ))}
      {!back && <View style={styles.slash} />}
    </View>
  )
}

function Bar({ index, height, scan, fill, back }: {
  index: number; height: number; scan: SharedValue<number>; fill: SharedValue<number>; back: boolean
}) {
  const style = useAnimatedStyle(() => {
    if (back) {
      const on = interpolate(fill.value, [index, index + 1], [0, 1], 'clamp')
      return { backgroundColor: GREEN, opacity: 0.25 + on * 0.75, transform: [{ scaleY: 0.6 + on * 0.4 }] }
    }
    // Distance from the sweep's head: the nearest bar glows amber, the rest stay dim.
    const d = Math.abs(scan.value - index - 0.5)
    const glow = interpolate(d, [0, 1.2], [1, 0], 'clamp')
    return { backgroundColor: AMBER, opacity: 0.22 + glow * 0.78, transform: [{ scaleY: 1 }] }
  })
  return <Animated.View style={[styles.bar, { height }, style]} />
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 30, alignItems: 'center' },
  card: {
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: '#1E162C',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    boxShadow: '0px 14px 32px rgba(20, 12, 34, 0.35)',
  },
  cardCompact: { alignSelf: 'center', borderRadius: 999 },
  cardBack: { borderColor: 'rgba(52, 211, 153, 0.45)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  iconWell: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  iconWellCompact: { width: 26, height: 26, borderRadius: 9, transform: [{ scale: 0.8 }] },
  rowCompact: { paddingVertical: 6, paddingLeft: 8, paddingRight: 14, gap: 8 },
  titleCompact: { fontSize: 12.5, lineHeight: 16 },
  iconWellBack: { backgroundColor: 'rgba(52, 211, 153, 0.14)' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 16 },
  bar: { width: 3.5, borderRadius: 2 },
  slash: {
    position: 'absolute', left: -3, right: -3, top: 7, height: 2, borderRadius: 1,
    backgroundColor: '#F87171', transform: [{ rotate: '-35deg' }],
  },
  text: { flexShrink: 1, gap: 1 },
  title: { fontFamily: F.bold, fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
  body: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.78)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F87171', marginLeft: 'auto' },
})
