/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="night"]'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        sunk: token('sunk'),
        card: token('card'),
        ink: token('ink'),
        ink2: token('ink-2'),
        muted: token('muted'),
        rule: token('rule'),
        accent: token('accent'),
        moss: token('moss'),
        ochre: token('ochre'),
        blueprint: token('blueprint'),
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans Variable"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        kicker: '0.18em',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        stamp: {
          '0%': { opacity: '0', transform: 'rotate(-7deg) scale(1.7)' },
          '60%': { opacity: '1', transform: 'rotate(-7deg) scale(0.94)' },
          '100%': { opacity: '1', transform: 'rotate(-7deg) scale(1)' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        press: {
          '0%, 100%': { transform: 'scaleX(0.12)' },
          '50%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        rise: 'rise 700ms cubic-bezier(.2,.7,.2,1) both',
        stamp: 'stamp 650ms cubic-bezier(.2,.7,.2,1) 700ms both',
        ticker: 'ticker 60s linear infinite',
        press: 'press 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
