// Type system — Inter for body text, Space Grotesk for headings and money,
// exactly like the web (--font-inter / --font-space-grotesk). Custom fonts
// carry their weight in the family name: never combine them with fontWeight
// (Android would synthesize a second, blurry bold).
import type { TextStyle } from 'react-native'

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  displaySemibold: 'SpaceGrotesk_600SemiBold',
  display: 'SpaceGrotesk_700Bold',
  mono: 'monospace',
} as const

// Tailwind sizes the web uses: text-[10px], xs 12/16, sm 14/20, base 16/24,
// lg 18/28, xl 20/28, 2xl 24/32, 3xl 30/36, 5xl 48.
export const TYPE = {
  hero: { fontFamily: F.display, fontSize: 42, lineHeight: 46, letterSpacing: -1.2 },
  display: { fontFamily: F.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontFamily: F.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  h2: { fontFamily: F.bold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: F.semibold, fontSize: 16, lineHeight: 22 },
  lead: { fontFamily: F.regular, fontSize: 17, lineHeight: 26 },
  title: { fontFamily: F.semibold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: F.regular, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: F.medium, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: F.regular, fontSize: 12, lineHeight: 16 },
  smallMedium: { fontFamily: F.medium, fontSize: 12, lineHeight: 16 },
  smallSemibold: { fontFamily: F.semibold, fontSize: 12, lineHeight: 16 },
  tiny: { fontFamily: F.medium, fontSize: 10, lineHeight: 14 },
  tinySemibold: { fontFamily: F.semibold, fontSize: 10, lineHeight: 14 },
  label: { fontFamily: F.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
  money: { fontFamily: F.display, fontSize: 24, lineHeight: 30 },
  moneyLg: { fontFamily: F.display, fontSize: 28, lineHeight: 34 },
  moneySm: { fontFamily: F.display, fontSize: 18, lineHeight: 24 },
  mono: { fontFamily: F.mono, fontSize: 13, lineHeight: 18 },
} satisfies Record<string, TextStyle>

export type TypeVariant = keyof typeof TYPE
