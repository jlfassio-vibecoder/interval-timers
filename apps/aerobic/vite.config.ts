import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/aerobic-timer/',
  server: { port: 5178 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
