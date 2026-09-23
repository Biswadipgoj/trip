// Swipe-left-to-delete row (web: drag="x" card revealing a red Delete tile).
// Uses gesture-handler's ReanimatedSwipeable so vertical scrolling stays
// smooth; deleting always asks for confirmation first.
import { useRef, type ReactNode } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { Trash2 } from 'lucide-react-native'
import { C, red } from '../../theme/colors'
import { confirmAction } from '../../lib/dialogs'
import { T } from '../ui/Text'
import { tick } from './SpringPressable'

interface SwipeToDeleteProps {
  children: ReactNode
  /** May be async; resolving to false (e.g. the cloud refused) closes the row again. */
  onDelete: () => void | boolean | Promise<boolean | void>
  confirmTitle: string
  confirmMessage?: string
  enabled?: boolean
}

export function SwipeToDelete({ children, onDelete, confirmTitle, confirmMessage, enabled = true }: SwipeToDeleteProps) {
  const ref = useRef<SwipeableMethods>(null)

  const ask = async () => {
    const ok = await confirmAction({ title: confirmTitle, message: confirmMessage, confirmLabel: 'Delete', destructive: true })
    if (!ok) {
      ref.current?.close()
      return
    }
    const result = await onDelete()
    if (result === false) ref.current?.close()
    else tick('warning')
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      enabled={enabled}
      friction={1.7}
      rightThreshold={44}
      overshootRight={false}
      dragOffsetFromRightEdge={12}
      onSwipeableWillOpen={() => tick('light')}
      renderRightActions={progress => <DeleteAction progress={progress} onPress={ask} />}
    >
      {children}
    </ReanimatedSwipeable>
  )
}

function DeleteAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.75, 1], Extrapolation.CLAMP) }],
  }))
  return (
    <Animated.View style={[styles.action, style]}>
      <Pressable onPress={onPress} style={styles.button} accessibilityRole="button" accessibilityLabel="Delete">
        <Trash2 size={18} color={C.red500} strokeWidth={2.2} />
        <T variant="tinySemibold" color={C.red500}>Delete</T>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  action: { width: 88, paddingLeft: 8 },
  button: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: red(0.14),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
})
