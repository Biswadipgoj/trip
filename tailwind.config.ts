import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Light theme: "white" is remapped to the ink color so the existing
        // text-white/NN and bg-white/NN utilities render dark-on-light.
        // Use `pure-white` where actual white is required (e.g. on gradients).
        white: 'hsl(258, 25%, 24%)',
        'pure-white': '#ffffff',
        // Soft purple brand
        brand: {
          50:  'hsl(258, 100%, 97%)',
          100: 'hsl(258, 95%, 94%)',
          200: 'hsl(258, 90%, 89%)',
          300: 'hsl(258, 84%, 81%)',
          400: 'hsl(258, 75%, 66%)',
          500: 'hsl(258, 65%, 58%)',
          600: 'hsl(258, 58%, 50%)',
          700: 'hsl(258, 54%, 42%)',
          800: 'hsl(258, 50%, 35%)',
          900: 'hsl(258, 46%, 28%)',
        },
        // Mint green accent
        accent: {
          50:  'hsl(160, 70%, 96%)',
          400: 'hsl(160, 48%, 52%)',
          500: 'hsl(160, 52%, 42%)',
          600: 'hsl(160, 55%, 34%)',
        },
        emerald: {
          400: 'hsl(160, 55%, 40%)',
          500: 'hsl(160, 58%, 33%)',
        },
        // Warm beige surfaces
        surface: {
          0:   'hsl(40, 45%, 96%)',
          1:   'hsl(40, 42%, 93%)',
          2:   'hsl(40, 38%, 90%)',
          3:   'hsl(40, 32%, 86%)',
          4:   'hsl(40, 28%, 82%)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, hsl(258, 65%, 58%) 0%, hsl(160, 52%, 46%) 100%)',
        'gradient-dark':  'linear-gradient(135deg, hsl(40, 45%, 96%) 0%, hsl(258, 45%, 94%) 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.6) 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-brand': '0 8px 32px rgba(124, 92, 220, 0.28)',
        'glow-sm':    '0 4px 16px rgba(124, 92, 220, 0.18)',
        'glass':      '0 8px 32px rgba(93, 70, 160, 0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
        'card':       '0 4px 20px rgba(93, 70, 160, 0.07), 0 1px 3px rgba(93, 70, 160, 0.05)',
        'card-hover': '0 12px 36px rgba(93, 70, 160, 0.12), 0 2px 8px rgba(93, 70, 160, 0.06)',
        'elevated':   '0 20px 56px rgba(93, 70, 160, 0.16)',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'float':   'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124, 92, 220, 0.15)' },
          '50%':      { boxShadow: '0 0 40px rgba(124, 92, 220, 0.35)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
