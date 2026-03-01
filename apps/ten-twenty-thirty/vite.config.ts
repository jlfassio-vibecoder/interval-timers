import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/10-20-30/',
  server: { port: 5185 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
