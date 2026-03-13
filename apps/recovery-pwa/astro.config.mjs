import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  base: '/recovery/',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    AstroPWA({
      manifest: {
        name: 'AMRAP Recovery Sync',
        short_name: 'Recovery',
        theme_color: '#0d0500',
        background_color: '#0d0500',
        display: 'standalone',
        start_url: '/recovery/',
        icons: [
          { src: 'favicon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5188 },
});
