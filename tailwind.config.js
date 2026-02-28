/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        'cream-dark': '#F0EBE3',
        indigo: {
          DEFAULT: '#3F3A8C',
          light: '#5550A8',
          dark: '#2D2966',
          faint: '#EEEDFA',
        },
        vermillion: {
          DEFAULT: '#C73E1D',
          light: '#E05A3A',
          faint: '#FDF0ED',
        },
        bamboo: {
          DEFAULT: '#5A7247',
          light: '#7A9466',
          faint: '#EFF4EC',
        },
        sumi: {
          DEFAULT: '#2C2C2C',
          light: '#5A5A5A',
          muted: '#8A8A8A',
        },
        category: {
          transport: '#3B82F6',
          food: '#F59E0B',
          activity: '#3F3A8C',
          stay: '#059669',
          'free-time': '#8B5CF6',
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'card-drag': '0 12px 28px rgba(63,58,140,0.15), 0 4px 8px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
