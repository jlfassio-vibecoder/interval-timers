import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Japanese Walking Timer',
        short_name: 'Japanese Walking',
        description:
          'Interval timer for Japanese walking (slow-fast walking) with optional warm-up and heart-rate guidance.',
        theme_color: '#0f172a',
        start_url: '/japanese-walking/',
        scope: '/japanese-walking/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  base: '/japanese-walking/',
  server: { port: 5176 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
