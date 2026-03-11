/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    '../../packages/auth-ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Syncopate', 'sans-serif'],
        sans: ['Space Grotesk', 'sans-serif'],
      },
      fontWeight: {
        light: '400',
        medium: '600',
        black: '700',
      },
      colors: {
        'bg-dark': 'var(--bg-dark)',
        accent: 'var(--color-accent)',
        'orange-light': 'var(--color-orange-light)',
        orange: 'var(--color-orange)',
        'orange-medium': 'var(--color-orange-medium)',
        'orange-dark': 'var(--color-orange-dark)',
        'orange-darkest': 'var(--color-orange-darkest)',
        'text-primary': 'var(--text-primary)',
      },
    },
  },
  plugins: [],
}
