/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Braves brand tokens
        navy: {
          DEFAULT: '#13274F', // primary Braves navy
          950: '#0B1830',
          900: '#0F1E3D',
          800: '#13274F',
          700: '#1B3563',
          600: '#26467F',
        },
        brave: {
          red: '#CE1141',
          redDark: '#A30D34',
          cream: '#F4F1E8',
          sky: '#5B8DBE',
          gold: '#C9A24B',
        },
        level: {
          mlb: '#CE1141',
          aaa: '#5B8DBE',
          aa: '#C9A24B',
          highA: '#4E9A6B',
          a: '#8B6BAE',
          dsl: '#B0763C',
        },
      },
      fontFamily: {
        display: ['"Oswald"', '"Arial Narrow"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,24,48,0.06), 0 4px 12px rgba(11,24,48,0.08)',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
