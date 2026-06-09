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
        brand: {
          50:  'hsl(240, 100%, 97%)',
          100: 'hsl(240, 96%, 93%)',
          200: 'hsl(240, 94%, 87%)',
          300: 'hsl(240, 90%, 78%)',
          400: 'hsl(240, 85%, 67%)',
          500: 'hsl(240, 78%, 58%)',
          600: 'hsl(240, 72%, 50%)',
          700: 'hsl(240, 68%, 42%)',
          800: 'hsl(240, 64%, 35%)',
          900: 'hsl(240, 60%, 28%)',
        },
        accent: {
          50:  'hsl(280, 100%, 97%)',
          400: 'hsl(280, 85%, 65%)',
          500: 'hsl(280, 78%, 55%)',
          600: 'hsl(280, 72%, 47%)',
        },
        emerald: {
          400: 'hsl(158, 64%, 52%)',
          500: 'hsl(158, 58%, 44%)',
        },
        surface: {
          0:   'hsl(222, 47%, 4%)',
          1:   'hsl(222, 40%, 7%)',
          2:   'hsl(222, 36%, 10%)',
          3:   'hsl(222, 32%, 14%)',
          4:   'hsl(222, 28%, 18%)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, hsl(240, 78%, 58%) 0%, hsl(280, 78%, 55%) 100%)',
        'gradient-dark':  'linear-gradient(135deg, hsl(222, 47%, 4%) 0%, hsl(240, 40%, 8%) 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-brand': '0 0 40px rgba(100, 90, 230, 0.3)',
        'glow-sm':    '0 0 20px rgba(100, 90, 230, 0.15)',
        'glass':      '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'card':       '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0,0,0,0.2)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0,0,0,0.3)',
        'elevated':   '0 20px 60px rgba(0, 0, 0, 0.5)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(100, 90, 230, 0.2)' },
          '50%':      { boxShadow: '0 0 40px rgba(100, 90, 230, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
