/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/timer-ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // WorkoutExplorer card header backgrounds (dynamic classes)
    'border-green-700/40',
    'bg-green-900/50',
    'border-amber-700/40',
    'bg-amber-900/50',
    'border-red-700/40',
    'bg-red-900/50',
    'border-orange-700/40',
    'bg-orange-900/50',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Syncopate', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
