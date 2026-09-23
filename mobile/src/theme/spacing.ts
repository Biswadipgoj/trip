// Spacing and radii on the web's Tailwind scale (4 px unit).

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const

/** rounded-lg 8 · rounded-xl 12 · rounded-2xl 16 · rounded-3xl 24 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const

/** Horizontal page padding (web: px-4). */
export const SCREEN_PADDING = 16
/** Height of the in-app top bar (web mobile header: h-14). */
export const TOP_BAR_HEIGHT = 56
/** Tab bar content height, excluding the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 64
