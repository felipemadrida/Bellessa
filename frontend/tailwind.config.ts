import type { Config } from 'tailwindcss'

/**
 * Sistema de diseño "Quiet Luxury" — Bellessa
 *
 * Dos capas de tokens:
 *  1. Brand tokens (alabaster, blush, champagne, taupe, licorice): la paleta
 *     literal de la marca. Se usan en superficies nuevas y en la librería ui.tsx.
 *  2. Semantic tokens (cream, ink, muted, line, rose, sage, gold, sand): roles
 *     de interfaz que ya consumen todas las páginas. Mapean a la paleta de marca
 *     con contraste AA verificado, de modo que toda la app queda coherente sin
 *     depender de valores hex sueltos y sin romper ninguna pantalla existente.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Brand tokens -------------------------------------------------
        alabaster: '#F9F6F0',
        porcelain: '#FBF7F1', // superficie elevada sobre alabaster
        surface: '#FFFFFF',
        bisque: '#F1E7DA', // superficie secundaria cálida
        blush: {
          DEFAULT: '#E8C5C8',
          light: '#F7EBEC',
          soft: '#F7EBEC',
          deep: '#9C5566', // 4.99:1 sobre alabaster — texto AA
        },
        champagne: {
          DEFAULT: '#D4AF37',
          hover: '#B89628',
          soft: '#FBF3DF',
          deep: '#7A5A18', // 5.75:1 sobre champagne-soft
        },
        // Neutros cálidos (croma 8–16, tinte rojizo-cálido ~h47–78).
        // Antes: taupe #8B7A74 (C=7.9, contraste 3.79 — fallaba AA).
        taupe: '#8A6A5E', // 4.52:1 sobre alabaster — rosewood taupe
        mocha: '#4E3A33', // 9.85:1 — neutro profundo para heróicos/footers
        silver: {
          DEFAULT: '#D9CBBA', // plata champán cálida (antes gris frío #C9C6C2)
          soft: '#EFE6DA',
          deep: '#9C8877', // 3.14:1 sobre alabaster — UI/bordes
        },
        licorice: '#1E1E1E',
        border: '#EADFD2', // hairline cálido (antes #E6DED4, casi gris)

        // ---- Semantic tokens (roles de UI) ---------------------------------
        cream: '#F9F6F0', // superficie base = alabaster
        ink: '#1E1E1E', // texto principal = licorice
        muted: '#6F5A50', // texto secundario — 5.98:1 sobre alabaster
        line: '#EADFD2', // hairlines = border
        sand: '#F3E9DD', // chips, inputs, hovers suaves
        champ: '#F3E9DD', // alias de sand para chips de tags

        rose: {
          DEFAULT: '#9C5566', // acento accesible: 5.38:1 con blanco
          soft: '#F7EBEC',
          light: '#F7EBEC',
          deep: '#7E3F4E', // hover / texto fuerte — 7.7:1 sobre blanco
        },
        sage: {
          DEFAULT: '#4A6B5D', // eucalipto apagado — 5.84:1 con blanco
          soft: '#EFF3F0',
          deep: '#395247',
        },
        gold: {
          DEFAULT: '#A8842C', // oro legible sobre alabaster (3.2:1, iconos/UI)
          soft: '#FBF3DF',
          deep: '#7A5A18',
        },

        // ---- Estados ------------------------------------------------------
        status: {
          confirmed: { bg: '#EFF3F0', text: '#3B6E4C' },
          pending: { bg: '#FBF3DF', text: '#8A6418' },
          cancelled: { bg: '#FBECEC', text: '#A8383B' },
          completed: { bg: '#F3E9DD', text: '#6F5A50' },
          noShow: { bg: '#F7EBEC', text: '#7E3F4E' },
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '18px',
        pill: '9999px',
      },
      boxShadow: {
        boutique:
          '0 10px 30px -5px rgba(139, 122, 116, 0.10), 0 4px 12px -2px rgba(30, 30, 30, 0.04)',
        gold: '0 4px 20px -2px rgba(212, 175, 55, 0.25)',
        soft: '0 8px 24px -12px rgba(30, 30, 30, 0.10)',
        lift: '0 18px 40px -18px rgba(30, 30, 30, 0.18)',
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
