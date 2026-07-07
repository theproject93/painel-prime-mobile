import type { Config } from 'tailwindcss';

export const painelPrimeTailwindPreset = {
  theme: {
    extend: {
      colors: {
        ink: {
          800: '#1E2430',
          900: '#151922',
          950: '#0F1115',
        },
        slate: {
          25: '#FCFCFD',
          50: '#F7F8FA',
          100: '#EEF1F5',
          200: '#E4E8EF',
          300: '#D6DCE6',
          500: '#8A93A6',
          700: '#4C5565',
          900: '#1B2130',
        },
        gold: {
          50: '#fcfbf4',
          100: '#f6ecd2',
          200: '#ecd9a2',
          300: '#dec479',
          400: '#d7b866',
          500: '#c9a54d',
          600: '#a98535',
          700: '#856d22',
          800: '#635119',
          900: '#453811',
          950: '#29210a',
        },
        royal: {
          50: '#f4f2ff',
          100: '#ece9ff',
          200: '#d8d1ff',
          300: '#b3a6ff',
          400: '#8b7dff',
          500: '#6b5bff',
          600: '#5a48f0',
          700: '#4b3dc3',
          800: '#4c1d95',
          900: '#34205f',
          950: '#23133f',
        },
        success: {
          50: '#eaf8f0',
          500: '#1f9d62',
        },
        warning: {
          50: '#fff6e5',
          500: '#d98e04',
        },
        error: {
          50: '#fdecec',
          500: '#d14343',
        },
        info: {
          50: '#eff6ff',
          500: '#2563eb',
        },
      },
      fontFamily: {
        sans: ['var(--font-painel-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-painel-display)', 'ui-serif', 'Georgia', 'serif'],
        playfair: ['var(--font-painel-display)', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        'gold-soft': '0 22px 48px -28px rgba(201, 165, 77, 0.42)',
        'royal-soft': '0 22px 48px -28px rgba(107, 91, 255, 0.34)',
        'panel-soft': '0 1px 2px rgba(15, 17, 21, 0.04), 0 18px 40px -28px rgba(15, 17, 21, 0.16)',
        'panel-md': '0 1px 2px rgba(15, 17, 21, 0.06), 0 28px 48px -30px rgba(15, 17, 21, 0.18)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(circle at top, rgba(201, 165, 77, 0.18), transparent 38%)',
      },
    },
  },
} satisfies Config;

export default painelPrimeTailwindPreset;
