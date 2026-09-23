// Modal surfaces:
//  • Sheet   — bottom sheet with a spring slide, drag-down-to-dismiss and a
//              tap-to-close backdrop (sync status, pickers).
//  • Overlay — centred card over a frosted lavender veil (the brand
//              nameplate, the "trip closed" celebration).
// Both keep the Modal mounted until their exit animation has finished.
import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomOut, useAnimatedStyle, useReducedMotion,
  useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { useRiseIn } from '../animated/FadeInView'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { C, G, ink, shadow } from '../../theme/colors'
import { LinearGradient } from 'expo-linear-gradient'
import { T } from './Text'

const EXIT_MS = 230

/** Overlay card entrance: rise 36 px while scaling up from 0.82 on the web's
 *  spring (stiffness 240, damping 22). */
function PopCard({ children, exiting }: { children: ReactNode; exiting?: ZoomOut }) {
  const pop = useRiseIn({ distance: 36, fromScale: 0.82, spring: { stiffness: 240, damping: 22 } })
  return (
    <Animated.View exiting={exiting} style={pop}>
      {children}
    </Animated.View>
  )
}

/** Keeps a modal mounted through its exit animation. */
function useModalPresence(visible: boolean) {
  const [mounted, setMounted] = useState(visible)
  const [shown, setShown] = useState(visible)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      setShown(true)
      return
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [visible])
  return { mounted, shown }
}

interface SheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { mounted, shown } = useModalPresence(visible)
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const reduced = useReducedMotion()
  const dragY = useSharedValue(0)

  useEffect(() => {
    if (visible) dragY.value = 0
  }, [visible, dragY])

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate(e => {
      dragY.value = Math.max(0, e.translationY)
    })
    .onEnd(e => {
      if (e.translationY > 110 || e.velocityY > 900) {
        dragY.value = withTiming(height, { duration: 200 }, () => scheduleOnRN(onClose))
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 260 })
      }
    })

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }))

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        {shown && (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(EXIT_MS)} style={styles.backdrop}>
            <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
        )}
        {shown && (
          <Animated.View
            entering={reduced ? FadeIn : SlideInDown.springify().damping(19).stiffness(170)}
            exiting={reduced ? FadeOut : SlideOutDown.duration(EXIT_MS)}
            style={[styles.sheetWrap, { maxHeight: height * 0.88 }]}
          >
            <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }, dragStyle]}>
              <LinearGradient colors={G.glassStrong} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <GestureDetector gesture={pan}>
                <View style={styles.header}>
                  <View style={styles.handle} />
                  {title ? (
                    <View style={styles.titleRow}>
                      <T variant="h3" style={styles.title}>{title}</T>
                      <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
                        <X size={16} color={ink(0.6)} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </GestureDetector>
              {children}
            </Animated.View>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  )
}

interface OverlayProps {
  visible: boolean
  onClose: () => void
  children: ReactNode
  /** Tap anywhere (including the card) closes it. */
  tapToClose?: boolean
}

export function Overlay({ visible, onClose, children, tapToClose = false }: OverlayProps) {
  const { mounted, shown } = useModalPresence(visible)
  const reduced = useReducedMotion()
  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {shown && (
        <Animated.View entering={FadeIn.duration(320)} exiting={FadeOut.duration(EXIT_MS)} style={[styles.fill, styles.veil]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
      )}
      {shown && (
        <View pointerEvents="box-none" style={styles.centerWrap}>
          <PopCard exiting={reduced ? undefined : ZoomOut.duration(EXIT_MS)}>
            {tapToClose ? <Pressable onPress={onClose}>{children}</Pressable> : children}
          </PopCard>
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(28, 18, 48, 0.42)' },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'web' ? 'rgba(248, 243, 255, 0.8)' : 'rgba(248, 243, 255, 0.9)',
  },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: C.surface0,
    boxShadow: shadow.elevated,
    paddingHorizontal: 20,
  },
  header: { paddingTop: 10, paddingBottom: 6 },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: ink(0.18), marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { flex: 1 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: ink(0.07), alignItems: 'center', justifyContent: 'center' },
  centerWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
})
