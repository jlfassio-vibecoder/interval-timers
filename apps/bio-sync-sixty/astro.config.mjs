import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  base: '/bio-sync60/',
  server: { port: 5186 },
  integrations: [
    react(),
    tailwind(),
  ],
});
