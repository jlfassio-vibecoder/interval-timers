/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'bg-dark': 'var(--bg-dark)',
        accent: 'var(--color-accent)',
        'orange-light': 'var(--color-orange-light)',
        orange: 'var(--orange)',
        'orange-medium': 'var(--orange-medium)',
        'orange-dark': 'var(--orange-dark)',
        'orange-darkest': 'var(--orange-darkest)',
        'text-primary': 'var(--text-primary)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        heartPulse: {
          from: { transform: 'scale(0.95)', opacity: '0.6' },
          to: { transform: 'scale(1.1)', opacity: '1' },
        },
        rotation: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.4s ease forwards',
        heartPulse: 'heartPulse 1s infinite alternate',
        rotation: 'rotation 1s linear infinite',
      },
    },
  },
  plugins: [],
};
