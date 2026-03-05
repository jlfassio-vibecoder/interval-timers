/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        sync: {
          base: '#F5F2EB',
          dark: '#1C1C1C',
          blue: '#2B4C59',
          orange: '#E06C3E',
          accent: '#A6B08F',
          surface: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'width-pulse': 'width-pulse 2s infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'width-pulse': {
          '0%, 100%': { width: '50%' },
          '50%': { width: '80%' },
        },
      },
    },
  },
  plugins: [],
};
