import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'xianxia': {
          'dark': '#0a0e1a',
          'darker': '#060810',
          'accent': '#8b5cf6',
          'gold': '#fbbf24',
          'silver': '#d1d5db',
        },
        'realm': {
          'mortal': '#6b7280',
          'mortal-light': '#9ca3af',
          'qiCondensation': '#10b981',
          'qiCondensation-light': '#34d399',
          'foundation': '#3b82f6',
          'foundation-light': '#60a5fa',
          'coreFormation': '#8b5cf6',
          'coreFormation-light': '#a78bfa',
          'nascentSoul': '#f59e0b',
          'nascentSoul-light': '#fbbf24',
        },
        'element': {
          'kim': '#d4af37',      // Metal - Gold
          'moc': '#22c55e',      // Wood - Green
          'thuy': '#3b82f6',     // Water - Blue
          'hoa': '#ef4444',      // Fire - Red
          'tho': '#a16207',      // Earth - Brown
        }
      },
      animation: {
        'glow-pulse': 'progressGlow 2s ease-in-out infinite',
        'progress-pulse': 'progressPulse 1.5s ease-in-out infinite',
        'near-breakthrough': 'nearBreakthrough 1s ease-in-out infinite',
        'breakthrough-explosion': 'breakthroughExplosion 0.8s ease-out forwards',
        'breakthrough-ring': 'breakthroughRing 1.5s ease-out infinite',
        'lightning-flash': 'lightningFlash 0.5s ease-in-out',
        'realm-reveal': 'realmTextReveal 1s ease-out forwards',
        'stat-count': 'statCountUp 0.5s ease-out forwards',
        'qi-flow': 'qiFlow 3s linear infinite',
        'meridian-pulse': 'meridianPulse 2s ease-in-out infinite',
        'meridian-activate': 'meridianActivate 0.6s ease-out forwards',
        'particle-rise': 'particleRise 2s ease-out forwards',
        'particle-spin': 'particleSpin 3s linear infinite',
        'exp-gain': 'expGain 0.5s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        progressGlow: {
          '0%, 100%': { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor', opacity: '1' },
          '50%': { boxShadow: '0 0 15px currentColor, 0 0 25px currentColor, 0 0 35px currentColor', opacity: '0.9' },
        },
      },
    },
  },
  plugins: [],
}
export default config
