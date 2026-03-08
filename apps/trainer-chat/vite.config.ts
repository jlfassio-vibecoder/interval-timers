import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/trainer-chat/',
  server: {
    port: 5180,
    proxy: {
      '/api/agora-token': {
        target: 'http://localhost:9517',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/agora-token/, '/token'),
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
