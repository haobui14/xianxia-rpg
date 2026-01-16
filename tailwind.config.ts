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
        }
      }
    },
  },
  plugins: [],
}
export default config
