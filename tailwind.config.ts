import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // ── DMC Brand × Apple HIG light mode ─────────────────────────────────
        dmc: {
          // Brand accent (DMC blue — kept as identity)
          primary:        '#3b5bdb',
          'primary-dark': '#2f4ac4',
          'primary-light':'#4c6ef5',

          // Apple system colors (light mode)
          success: '#34c759',   // Apple green
          danger:  '#ff3b30',   // Apple red
          warning: '#ff9500',   // Apple orange
          info:    '#007aff',   // Apple blue

          // Surfaces — Apple light mode
          'bg-dark':   '#f5f5f7',   // Page background (Apple systemGroupedBackground)
          'bg-card':   '#ffffff',   // Card surface (white)
          'bg-card-2': '#f2f2f7',   // Second elevation (Apple systemGray6)
          'bg-input':  '#f2f2f7',   // Input fill
          'bg-overlay':'rgba(0,0,0,0.45)',

          // Borders — Apple light mode separator
          border:        '#d2d2d7',
          'border-light':'#e5e5ea',

          // Typography — Apple light mode label hierarchy
          'text-primary':   '#1d1d1f',  // Apple primary label
          'text-secondary': '#6e6e73',  // Apple secondary label
          'text-muted':     '#aeaeb2',  // Apple tertiary label
          'text-link':      '#3b5bdb',  // DMC blue link
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backdropBlur: {
        xs: '4px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.99)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'fade-in':         'fade-in 0.15s ease-out',
        'scale-in':        'scale-in 0.15s ease-out',
        'slide-up':        'slide-up 0.2s ease-out',
        'slide-in-right':  'slide-in-right 0.2s ease-out',
      },
      boxShadow: {
        'apple-sm':  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'apple-md':  '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        'apple-lg':  '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
        'apple-glow':'0 0 20px rgba(59,91,219,0.20)',
      },
    },
  },
  plugins: [],
}

export default config
