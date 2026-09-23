// Entrance + expand animations (web FadeIn / AnimatePresence height reveals).
//  • FadeIn — fade + 25 px slide on mount, with the web's easing. Stagger
//    delays are capped so long lists don't keep animating for seconds.
//  • Collapsible — mounts its content with a fade/slide and unmounts with a
//    fade; wrap the parent in <Animated.View layout={SMOOTH_LAYOUT}> to glide
//    the surrounding layout.
import { useEffect, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  Easing, FadeIn as FadeInAnim, FadeInDown, FadeInLeft, FadeInRight, FadeInUp, FadeOut,
  LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated'

/** cubic-bezier(0.21, 0.47, 0.32, 0.98) — the web's entrance curve. */
export const EASE_OUT = Easing.bezier(0.21, 0.47, 0.32, 0.98)
/** Layout transition for cards whose content expands/collapses. */
export const SMOOTH_LAYOUT = LinearTransition.duration(260).easing(Easing.out(Easing.cubic))

const MAX_DELAY = 480

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

interface FadeInProps {
  children: ReactNode
  /** Delay in ms (web uses seconds: 0.1 → 100). */
  delay?: number
  duration?: number
  direction?: Direction
  style?: StyleProp<ViewStyle>
}

export function FadeIn({ children, delay = 0, duration = 480, direction = 'up', style }: FadeInProps) {
  const reduced = useReducedMotion()
  if (reduced) return <Animated.View style={style}>{children}</Animated.View>
  // Reanimated names the side the element starts on: FadeInDown rises from below.
  const base =
    direction === 'up' ? FadeInDown
      : direction === 'down' ? FadeInUp
        : direction === 'left' ? FadeInRight
          : direction === 'right' ? FadeInLeft
            : FadeInAnim
  const entering = base.delay(Math.min(delay, MAX_DELAY)).duration(duration).easing(EASE_OUT)
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  )
}

interface RiseOptions {
  delay?: number
  /** Start this many px lower. */
  distance?: number
  /** Start at this scale. */
  fromScale?: number
  duration?: number
  /** Spring instead of the ease-out timing curve. */
  spring?: { stiffness: number; damping: number }
}

/** Mount animation driven by shared values (fade + rise + scale). Unlike a
 *  Keyframe layout animation it never changes positioning, so it behaves the
 *  same on Android and in the web preview. */
export function useRiseIn({ delay = 0, distance = 24, fromScale = 1, duration = 500, spring }: RiseOptions = {}) {
  const reduced = useReducedMotion()
  const p = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) return
    const to = spring ? withSpring(1, spring) : withTiming(1, { duration, easing: EASE_OUT })
    p.value = withDelay(Math.min(delay, MAX_DELAY), to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value),
    transform: [{ translateY: (1 - p.value) * distance }, { scale: fromScale + (1 - fromScale) * p.value }],
  }))
}

/** Stagger helper: delay for the i-th list item. */
export const stagger = (i: number, base = 0, step = 60) => Math.min(base + i * step, MAX_DELAY)

interface CollapsibleProps {
  open: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

export function Collapsible({ open, children, style }: CollapsibleProps) {
  if (!open) return null
  return <CollapsibleBody style={style}>{children}</CollapsibleBody>
}

function CollapsibleBody({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  // Drops in from 8 px above while fading in; stays in normal layout flow.
  const rise = useRiseIn({ distance: -8, duration: 240 })
  return (
    <Animated.View exiting={reduced ? undefined : FadeOut.duration(140)} style={[style, rise]}>
      {children}
    </Animated.View>
  )
}
