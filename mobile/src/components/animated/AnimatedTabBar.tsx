// Bottom tab bar (web AppNav mobile nav): five tabs, a violet pill that
// springs between them, a bounce on the newly active icon, a haptic tick,
// badges, and safe-area padding for gesture-nav phones. Hides while the
// keyboard is open.
import { useEffect, useState, type ComponentProps } from 'react'
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Tabs } from 'expo-router'
import { ChartColumn, CreditCard, LayoutDashboard, Receipt, Users } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { C, G, ink, shadow } from '../../theme/colors'
import { F } from '../../theme/typography'
import { T } from '../ui/Text'
import type { IconType } from '../ui/Button'
import { tick } from './SpringPressable'

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

const ICONS: Record<string, IconType> = {
  dashboard: LayoutDashboard,
  members: Users,
  expenses: Receipt,
  settlements: CreditCard,
  analytics: ChartColumn,
}

const PILL_SPRING = { damping: 20, stiffness: 240, mass: 0.8 }

export function TabBar({ state, descriptors, navigation, badges = {} }: TabBarProps & { badges?: Record<string, number> }) {
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const [width, setWidth] = useState(0)
  const [keyboard, setKeyboard] = useState(false)
  const count = state.routes.length
  const itemW = width / Math.max(1, count)
  const x = useSharedValue(0)

  useEffect(() => {
    if (!itemW) return
    x.value = reduced ? state.index * itemW : withSpring(state.index * itemW, PILL_SPRING)
  }, [state.index, itemW, reduced, x])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  if (keyboard) return null

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
      <View style={styles.row} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View style={[styles.pill, { width: itemW - 8 }, pill]}>
            <LinearGradient colors={G.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const focused = state.index === index
          const label = typeof options.title === 'string' ? options.title : route.name
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) {
              tick('selection')
              navigation.navigate(route.name, route.params)
            }
          }
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              testID={`tab-${route.name}`}
            >
              <TabIcon Icon={ICONS[route.name] ?? LayoutDashboard} focused={focused} badge={badges[route.name] ?? 0} />
              <T
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
                style={[styles.label, { color: focused ? C.white : ink(0.58), fontFamily: focused ? F.semibold : F.medium }]}
              >
                {label}
              </T>
            </Pressable>
          )
        })}
      </View>
      </View>
    </View>
  )
}

function TabIcon({ Icon, focused, badge }: { Icon: IconType; focused: boolean; badge: number }) {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  useEffect(() => {
    if (focused && !reduced) {
      scale.value = withSequence(withSpring(1.2, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 12, stiffness: 300 }))
    }
  }, [focused, reduced, scale])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={style}>
      <Icon size={21} color={focused ? C.white : ink(0.55)} strokeWidth={focused ? 2.4 : 2} />
      {badge > 0 && (
        <View style={styles.badge}>
          <T style={styles.badgeText} maxFontSizeMultiplier={1}>{badge > 9 ? '9+' : badge}</T>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Floating glass dock over the liquid backdrop.
  dock: { paddingHorizontal: 12, paddingTop: 6 },
  bar: {
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    boxShadow: '0px 12px 34px rgba(108, 62, 200, 0.18)',
    padding: 6,
  },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  pill: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: shadow.glowSm,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 7 },
  label: { fontSize: 10.5, lineHeight: 13 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.red500,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.white,
  },
  badgeText: { color: C.white, fontSize: 9, lineHeight: 11, fontFamily: 'Inter_700Bold' },
})
