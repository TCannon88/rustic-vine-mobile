/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette
        vine: {
          50:  '#FDF8F3',
          100: '#FAF0E6',
          200: '#F0D9C4',
          300: '#E0BB99',
          400: '#C99366',
          500: '#B07040',
          600: '#8A5430',
          700: '#6B3D22',
          800: '#4E2A16',
          900: '#33190D',
        },
        burgundy: {
          50:  '#FBF0F2',
          100: '#F5D6DC',
          200: '#EBACB9',
          300: '#D97892',
          400: '#C24D6D',
          500: '#A03055',
          600: '#7E1E41',
          700: '#6B2D3E',
          800: '#4A1A2B',
          900: '#2D0F1A',
        },
        sage: {
          50:  '#F4F7F2',
          100: '#E4EDE0',
          200: '#C5D9BD',
          300: '#9DBF95',
          400: '#729E6A',
          500: '#547D4B',
          600: '#3E6138',
          700: '#2F4A2A',
          800: '#20331C',
          900: '#121E10',
        },
        cream: '#FAF7F2',
        gold: '#C9A84C',
        'gold-light': '#E8CE89',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
        'live-dot': 'liveDot 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        liveDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
      },
      backgroundImage: {
        'vine-gradient': 'linear-gradient(135deg, #6B2D3E 0%, #4A1A2B 50%, #2D0F1A 100%)',
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #E8CE89 50%, #C9A84C 100%)',
        'cream-gradient': 'linear-gradient(180deg, #FAF7F2 0%, #F0E8D8 100%)',
      },
      boxShadow: {
        'warm': '0 4px 24px rgba(107, 45, 62, 0.15)',
        'warm-lg': '0 8px 40px rgba(107, 45, 62, 0.25)',
        'gold': '0 4px 16px rgba(201, 168, 76, 0.35)',
      },
    },
  },
  plugins: [],
}
