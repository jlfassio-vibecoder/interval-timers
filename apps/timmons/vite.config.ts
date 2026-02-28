import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/timmons/',
  server: { port: 5183 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
