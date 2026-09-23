// Floating "Add" button (web: fixed violet → fuchsia circle above the bottom
// nav). Pops in with a spring, carries the liquid sheen, squishes on press.
import { StyleSheet, View } from 'react-native'
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Plus } from 'lucide-react-native'
import { C, G, shadow } from '../../theme/colors'
import { PressScale } from './SpringPressable'
import { Sheen } from '../ui/StatCard'
import type { IconType } from '../ui/Button'

interface FABProps {
  onPress: () => void
  /** Distance from the bottom of the screen area (above the tab bar). */
  bottom?: number
  icon?: IconType
  accessibilityLabel?: string
}

export function FAB({ onPress, bottom = 20, icon: Icon = Plus, accessibilityLabel = 'Add expense' }: FABProps) {
  const reduced = useReducedMotion()
  return (
    <Animated.View
      entering={reduced ? undefined : ZoomIn.delay(250).springify().damping(13).stiffness(220)}
      style={[styles.wrap, { bottom }]}
    >
      <PressScale onPress={onPress} scaleTo={0.9} haptic="medium" accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        <LinearGradient colors={G.violetFuchsia} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <Sheen period={4.5} />
          <View style={styles.icon}>
            <Icon size={26} color={C.white} strokeWidth={2.4} />
          </View>
        </LinearGradient>
      </PressScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 20, borderRadius: 30, boxShadow: shadow.violetFuchsia },
  fab: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  icon: { alignItems: 'center', justifyContent: 'center' },
})
