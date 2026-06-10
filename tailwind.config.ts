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
        white: 'hsl(262, 32%, 18%)',
        'pure-white': '#ffffff',
        // Vivid violet brand
        brand: {
          50:  'hsl(262, 100%, 97%)',
          100: 'hsl(262, 96%, 94%)',
          200: 'hsl(262, 92%, 89%)',
          300: 'hsl(262, 88%, 80%)',
          400: 'hsl(262, 85%, 68%)',
          500: 'hsl(262, 83%, 58%)',
          600: 'hsl(262, 75%, 50%)',
          700: 'hsl(262, 70%, 42%)',
          800: 'hsl(262, 64%, 35%)',
          900: 'hsl(262, 58%, 28%)',
        },
        // Vivid mint/teal accent
        accent: {
          50:  'hsl(168, 80%, 95%)',
          400: 'hsl(168, 70%, 45%)',
          500: 'hsl(168, 76%, 36%)',
          600: 'hsl(168, 80%, 29%)',
        },
        emerald: {
          400: 'hsl(160, 70%, 38%)',
          500: 'hsl(160, 75%, 31%)',
        },
        // Warm cream surfaces
        surface: {
          0:   'hsl(42, 70%, 97%)',
          1:   'hsl(42, 60%, 94%)',
          2:   'hsl(42, 50%, 91%)',
          3:   'hsl(42, 42%, 87%)',
          4:   'hsl(42, 36%, 83%)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, hsl(262, 83%, 58%) 0%, hsl(310, 80%, 56%) 100%)',
        'gradient-dark':  'linear-gradient(135deg, hsl(42, 70%, 97%) 0%, hsl(262, 60%, 95%) 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.7) 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-brand': '0 10px 36px rgba(139, 78, 245, 0.38)',
        'glow-sm':    '0 4px 18px rgba(139, 78, 245, 0.24)',
        'glass':      '0 8px 32px rgba(108, 62, 200, 0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
        'card':       '0 4px 22px rgba(108, 62, 200, 0.09), 0 1px 3px rgba(108, 62, 200, 0.06)',
        'card-hover': '0 14px 40px rgba(108, 62, 200, 0.16), 0 3px 10px rgba(108, 62, 200, 0.08)',
        'elevated':   '0 20px 60px rgba(108, 62, 200, 0.2)',
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
