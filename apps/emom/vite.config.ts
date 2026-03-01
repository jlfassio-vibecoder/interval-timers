import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/emom-timer/',
  server: { port: 5184 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
