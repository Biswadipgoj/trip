// Renders the newest toast from lib/toast as a glass banner under the status
// bar. Springs in, auto-dismisses, tap to dismiss; optional action button.
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeOutUp, SlideInUp, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react-native'
import { useToastStore, type ToastKind } from '../../lib/toast'
import { C, ink, shadow } from '../../theme/colors'
import { withAlpha } from '../../lib/color'
import { T } from './Text'

const KIND: Record<ToastKind, { color: string; Icon: typeof Info }> = {
  success: { color: C.emerald400, Icon: CircleCheck },
  error: { color: C.red500, Icon: CircleAlert },
  warning: { color: C.amber600, Icon: TriangleAlert },
  info: { color: C.brand500, Icon: Info },
}

export function ToastHost() {
  const current = useToastStore(s => s.current)
  const dismiss = useToastStore(s => s.dismiss)
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => dismiss(current.id), current.duration)
    return () => clearTimeout(t)
  }, [current, dismiss])

  const kind = current ? KIND[current.kind] : null

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {current && kind && (
        <Animated.View
          key={current.id}
          entering={reduced ? undefined : SlideInUp.springify().damping(17).stiffness(190)}
          exiting={reduced ? undefined : FadeOutUp.duration(180)}
          style={styles.shadow}
        >
          <Pressable
            onPress={() => dismiss(current.id)}
            style={[styles.toast, { borderColor: withAlpha(kind.color, 0.28) }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <View style={[styles.icon, { backgroundColor: withAlpha(kind.color, 0.12) }]}>
              <kind.Icon size={16} color={kind.color} strokeWidth={2.4} />
            </View>
            <T variant="bodyMedium" style={styles.message} numberOfLines={3}>{current.message}</T>
            {current.action && (
              <Pressable
                onPress={() => {
                  current.action?.onPress()
                  dismiss(current.id)
                }}
                hitSlop={8}
                style={[styles.action, { backgroundColor: withAlpha(kind.color, 0.12) }]}
              >
                <T variant="smallSemibold" color={kind.color}>{current.action.label}</T>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, alignItems: 'stretch', zIndex: 1000, elevation: 1000 },
  shadow: { borderRadius: 16, boxShadow: shadow.elevated },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1, color: ink(0.9) },
  action: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
})
