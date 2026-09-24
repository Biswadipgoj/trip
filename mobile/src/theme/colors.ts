// Design tokens — a direct port of the web theme (src/app/globals.css and
// tailwind.config.ts): warm cream surfaces, vivid violet → fuchsia brand,
// mint accent, dark-violet ink. The web remaps Tailwind's `white` to ink, so a
// web `text-white/60` is `ink(0.6)` here and `bg-white/5` is `ink(0.05)`.

export const C = {
  // Surfaces (warm cream)
  surface0: '#FDF9F2',
  surface1: '#F9F3E7',
  surface2: '#F4EDDD',
  surface3: '#ECE3D0',
  surface4: '#E3DAC4',

  // Text
  ink: '#2A1F3D',
  white: '#FFFFFF',

  // Brand violet
  brand50: '#F5F0FF',
  brand100: '#ECE1FE',
  brand200: '#DCC9FD',
  brand300: '#C09FF9',
  brand400: '#9B68F3',
  brand500: '#7C3BED',
  brand600: '#6620DF',
  brand700: '#5720B6',
  brand800: '#4A2092',
  fuchsia: '#E935CB',

  // Mint accent + emerald
  accent50: '#E8FCF8',
  accent400: '#22C3A3',
  accent500: '#16A286',
  accent600: '#0F856D',
  emerald400: '#1DA578',
  emerald500: '#148A63',

  // Tailwind defaults the web uses as-is
  red400: '#F87171',
  red500: '#EF4444',
  red600: '#DC2626',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber700: '#B45309',
  blue400: '#60A5FA',
  blue500: '#3B82F6',
  sky500: '#0EA5E9',
  orange500: '#F97316',
  fuchsia500: '#D946EF',
  slate400: '#94A3B8',
} as const

/** Ink at an opacity — the web's `text-white/NN`, `bg-white/NN`, `border-white/NN`. */
export const ink = (alpha: number) => `rgba(42, 31, 61, ${alpha})`
/** The web's rgba(139, 78, 245, …) violet used for input borders, glows, tracks. */
export const violet = (alpha: number) => `rgba(139, 78, 245, ${alpha})`
/** Brand-500 / brand-600 / emerald / red / amber at an opacity (tinted chips, badges). */
export const brand500 = (alpha: number) => `rgba(124, 59, 237, ${alpha})`
export const brand600 = (alpha: number) => `rgba(102, 32, 223, ${alpha})`
export const emerald = (alpha: number) => `rgba(29, 165, 120, ${alpha})`
export const accent = (alpha: number) => `rgba(22, 162, 134, ${alpha})`
export const red = (alpha: number) => `rgba(239, 68, 68, ${alpha})`
export const amber = (alpha: number) => `rgba(245, 158, 11, ${alpha})`
export const whiteA = (alpha: number) => `rgba(255, 255, 255, ${alpha})`

type Stops = readonly [string, string, ...string[]]

/** Gradient stops, for expo-linear-gradient (135° = start {0,0} → end {1,1}). */
export const G = {
  brand: ['#7C3BED', '#E935CB'],
  /** text-gradient-brand: brand-500 → fuchsia (55%) → accent-400 */
  brandText: ['#7C3BED', '#E935CB', '#22C3A3'],
  indigoPurple: ['#453CEC', '#AC37E6'],
  orangePink: ['#F97924', '#F23681'],
  blueCyan: ['#1E71F6', '#07C2E4'],
  emeraldTeal: ['#1FAD6B', '#15ACAC'],
  violetFuchsia: ['#7C3BED', '#E935CB'],
  settle: ['#7C3BED', '#17AB8D'],
  budgetOk: ['#1FAD6B', '#15ACAC'],
  budgetWarn: ['#F9A410', '#F97924'],
  budgetOver: ['#F97924', '#F22C54'],
  glass: ['rgba(255,255,255,0.88)', 'rgba(247,242,255,0.78)', 'rgba(240,248,255,0.80)'],
  glassStrong: ['rgba(255,255,255,0.95)', 'rgba(248,244,255,0.90)', 'rgba(243,249,255,0.92)'],
  nameplate: ['#7A34F4', '#F73BB2', '#FF7029', '#238FFB'],
} as const satisfies Record<string, Stops>

export type GradientName = keyof typeof G

/** Brand footer — "Mastermind Behind The Code: Biswodip Goj", one gradient per word. */
export const FOOTER_WORDS: readonly (readonly [string, string])[] = [
  ['#813DF5', '#CC49F3'],
  ['#F73BB2', '#F5476A'],
  ['#FF7029', '#FFA51F'],
  ['#15C19F', '#0AAFEB'],
  ['#238FFB', '#813FF3'],
  ['#CA3DF5', '#F73BB2'],
]

/** Liquid backdrop blobs (web body::before / ::after), as [color, alpha, cx%, cy%, rx%, ry%]. */
export const BLOBS_A: readonly (readonly [string, number, number, number, number, number])[] = [
  ['#9F69FC', 0.62, 12, 18, 38, 34],
  ['#5DD3FD', 0.58, 88, 12, 34, 30],
  ['#FB6AC6', 0.56, 82, 86, 36, 32],
  ['#FF9966', 0.5, 14, 84, 34, 30],
  ['#E089FA', 0.46, 50, 52, 40, 36],
  ['#6065FB', 0.42, 38, 24, 28, 26],
  ['#FFCB70', 0.38, 64, 30, 30, 26],
]
export const BLOBS_B: readonly (readonly [string, number, number, number, number, number])[] = [
  ['#FC7DE7', 0.42, 30, 70, 30, 28],
  ['#73B8FC', 0.4, 72, 64, 28, 26],
  ['#FF8370', 0.38, 24, 36, 26, 24],
]

/** CSS box-shadows optimized for high performance 60fps rendering. */
export const shadow = {
  glass: '0px 4px 16px rgba(108, 62, 200, 0.10)',
  card: '0px 3px 12px rgba(108, 62, 200, 0.08)',
  cardHover: '0px 6px 18px rgba(108, 62, 200, 0.14)',
  strong: '0px 8px 24px rgba(108, 62, 200, 0.18)',
  elevated: '0px 10px 28px rgba(108, 62, 200, 0.18)',
  glowBrand: '0px 6px 20px rgba(139, 78, 245, 0.32)',
  glowSm: '0px 3px 12px rgba(139, 78, 245, 0.22)',
  btnBrand: '0px 4px 14px rgba(139, 78, 245, 0.35)',
  indigoPurple: '0px 6px 18px rgba(119, 53, 233, 0.32)',
  orangePink: '0px 6px 18px rgba(242, 44, 84, 0.32)',
  blueCyan: '0px 6px 18px rgba(13, 147, 242, 0.32)',
  emeraldTeal: '0px 6px 18px rgba(27, 167, 134, 0.32)',
  violetFuchsia: '0px 6px 18px rgba(191, 53, 233, 0.32)',
} as const
