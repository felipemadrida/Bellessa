import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF7F2',
        sand: '#F2E9DE',
        ink: '#251D1B',
        muted: '#7B6C63',
        line: '#E9DDD0',
        rose: {
          DEFAULT: '#C2415A',
          deep: '#8E2C41',
          soft: '#F7E5E8',
        },
        sage: {
          DEFAULT: '#3E5C50',
          soft: '#E7EFEA',
        },
        gold: {
          DEFAULT: '#D9A441',
          soft: '#F8EED9',
        },
        terra: '#D97757',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(37,29,27,.04), 0 12px 32px -18px rgba(37,29,27,.28)',
        lift: '0 2px 6px rgba(37,29,27,.06), 0 22px 50px -24px rgba(37,29,27,.35)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,.61,.36,1) both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,.61,.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
