// Vibrant Light Theme Design System
export const Colors = {
  // Base backgrounds
  background: '#F8FAFC',       // Clean, bright pearl white/slate
  surface: '#FFFFFF',          // Pure crisp white card surface
  surfaceSubtle: '#F1F5F9',    // Light gray-blue for chips and inputs
  border: '#E2E8F0',           // Delicate border
  borderLight: '#EDF2F7',

  // Typography
  text: '#0F172A',             // Slate 900 - high contrast readability
  textSecondary: '#475569',    // Slate 600 - subheadings
  textMuted: '#94A3B8',        // Slate 400 - placeholders/hints

  // Vivid Accent Palette
  primary: '#6366F1',          // Electric Indigo
  primaryLight: '#818CF8',
  secondary: '#EC4899',        // Fuchsia / Pink
  accent: '#06B6D4',           // Cyan
  success: '#10B981',          // Emerald
  warning: '#F59E0B',          // Amber
  danger: '#EF4444',           // Coral Red

  // Pastel & Vivid Gradients [start, end]
  gradients: {
    sunset: ['#FF6B6B', '#FFA07A'] as [string, string],      // Coral -> Peach
    ocean: ['#4E65FF', '#92EFFD'] as [string, string],       // Deep Blue -> Cyan
    mint: ['#0575E6', '#00F260'] as [string, string],        // Aqua -> Neon Mint
    berry: ['#8A2387', '#E94057'] as [string, string],       // Violet -> Rose
    amber: ['#F7971E', '#FFD200'] as [string, string],       // Orange -> Honey Gold
    purple: ['#8B5CF6', '#EC4899'] as [string, string],      // Purple -> Pink
    emerald: ['#10B981', '#34D399'] as [string, string],     // Deep Emerald -> Mint
    pearl: ['#FFFFFF', '#F8FAFC'] as [string, string],
  },

  // Soft glowing colored shadows
  shadows: {
    sm: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    lg: {
      shadowColor: '#475569',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
    primaryGlow: {
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    sunsetGlow: {
      shadowColor: '#FF6B6B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
  },
}
