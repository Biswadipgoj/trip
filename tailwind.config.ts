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
        // Pastel Purple
        brand: {
          50:  'hsl(260, 60%, 98%)',
          100: 'hsl(260, 60%, 95%)',
          200: 'hsl(260, 60%, 90%)',
          300: 'hsl(260, 60%, 85%)',
          400: 'hsl(260, 60%, 80%)', // primary pastel purple
          500: 'hsl(260, 60%, 70%)',
          600: 'hsl(260, 60%, 60%)',
          700: 'hsl(260, 60%, 50%)',
          800: 'hsl(260, 60%, 40%)',
          900: 'hsl(260, 60%, 30%)',
        },
        // Mint Green
        accent: {
          50:  'hsl(158, 60%, 98%)',
          400: 'hsl(158, 60%, 85%)',
          500: 'hsl(158, 60%, 80%)', // mint green
          600: 'hsl(158, 60%, 70%)',
        },
        emerald: {
          400: 'hsl(158, 60%, 70%)',
          500: 'hsl(158, 60%, 60%)',
        },
        // Light Beige Base
        surface: {
          0:   'hsl(40, 30%, 96%)', // beige base
          1:   'hsl(40, 30%, 94%)',
          2:   'hsl(40, 30%, 92%)',
          3:   'hsl(40, 30%, 90%)',
          4:   'hsl(40, 30%, 88%)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, hsl(260, 60%, 80%) 0%, hsl(158, 60%, 80%) 100%)',
        'gradient-dark':  'linear-gradient(135deg, hsl(40, 30%, 96%) 0%, hsl(40, 30%, 92%) 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-brand': '0 0 40px rgba(180, 160, 229, 0.3)',
        'glow-sm':    '0 0 20px rgba(180, 160, 229, 0.15)',
        'glass':      '0 8px 32px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
        'card':       '0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0,0,0,0.02)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'elevated':   '0 20px 60px rgba(0, 0, 0, 0.1)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(180, 160, 229, 0.2)' },
          '50%':      { boxShadow: '0 0 40px rgba(180, 160, 229, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
