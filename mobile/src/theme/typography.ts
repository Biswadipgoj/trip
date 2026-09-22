import { TextStyle } from 'react-native'

export const Typography: Record<string, TextStyle> = {
  h1: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '700',
  },
  h4: {
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
  },
  small: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  currency: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
}
