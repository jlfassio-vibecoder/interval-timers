import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/wingate/',
  server: { port: 5182 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
