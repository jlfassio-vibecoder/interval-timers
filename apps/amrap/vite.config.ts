import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/amrap/',
  server: {
    port: 5177,
    proxy: {
      '/api/agora-token': {
        target: 'http://localhost:9517',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/agora-token/, '/token'),
      },
    },
  },
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
