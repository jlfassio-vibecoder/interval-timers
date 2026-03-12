import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import AstroPWA from '@vite-pwa/astro';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const root = fileURLToPath(new URL('.', import.meta.url));
const monorepoRoot = resolve(root, '../..');
// Load monorepo root .env first (HIIT Workout Timer Supabase: VITE_SUPABASE_*), then app-level (override)
loadEnv({ path: resolve(monorepoRoot, '.env') });
loadEnv({ path: resolve(monorepoRoot, '.env.local') });
loadEnv({ path: resolve(root, '.env') });
loadEnv({ path: resolve(root, '.env.local') });
const src = resolve(root, './src');

// Use Vercel adapter on Vercel (fixes 404 NOT_FOUND); Node adapter elsewhere (e.g. local preview, other hosts)
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production' || process.env.CI === 'true';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || undefined,
  output: 'server',
  devToolbar: { enabled: false },
  adapter: isVercel ? vercel() : node({ mode: 'standalone' }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false, // We have custom base styles
    }),
    AstroPWA({
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/interval-timers\/?(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'interval-timers-html',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/sounds\/.+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'interval-timer-sounds',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: Number(process.env.PORT) || 3006,
    host: true
  },
  vite: {
    // Inject Supabase env from any name (SUPABASE_*, VITE_*, PUBLIC_*) so client bundle gets them.
    // Vite only exposes VITE_* by default; Vercel often uses SUPABASE_URL. This ensures both work.
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || ''
      ),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(
        process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.PUBLIC_SUPABASE_ANON_KEY ||
          ''
      )
    },
    server: {
      // Dev: proxy /amrap and /api/agora-token (npm run dev:amrap:video)
      proxy: {
        '/amrap': {
          target: 'http://localhost:5177',
          changeOrigin: true
        },
        '/api/agora-token': {
          target: 'http://localhost:9517',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/agora-token/, '/token')
        }
      }
    },
    resolve: {
      alias: {
        '@': src
      }
    },
    ssr: {
      // Bundle ALL dependencies in production to avoid runtime ERR_MODULE_NOT_FOUND errors
      // This is necessary because Firebase App Hosting may not have all transitive dependencies
      // at runtime. We exclude native modules that can't be bundled.
      noExternal: isProduction ? true : ['piccolore', 'clsx', 'es-module-lexer', 'devalue']
    },
    optimizeDeps: {
      include: ['node-domexception'],
      esbuildOptions: {
        // Handle CommonJS modules that don't have default exports
        mainFields: ['module', 'main']
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase') || id.includes('firebaseService')) {
              return 'firebase';
            }
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      },
      chunkSizeWarningLimit: 500, // Encourage smaller chunks; Firebase and vendor are split separately
      commonjsOptions: {
        // Transform CommonJS modules to ES modules
        transformMixedEsModules: true
      }
    }
  }
});
