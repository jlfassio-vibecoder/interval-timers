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
// Load monorepo root .env first (HIIT Workout Timer Supabase: VITE_SUPABASE_*), then app-level.
// Later files override earlier keys (dotenv default is first-wins; we want apps/app/.env to win over root).
loadEnv({ path: resolve(monorepoRoot, '.env') });
loadEnv({ path: resolve(monorepoRoot, '.env.local'), override: true });
loadEnv({ path: resolve(root, '.env'), override: true });
loadEnv({ path: resolve(root, '.env.local'), override: true });
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
        // @vite-pwa/astro defaults navigateFallback to "/" for SSR; "/" is not in precache (no HTML in
        // globPatterns), which throws non-precached-url in Workbox. SSR navigations must hit the network.
        navigateFallback: null,
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
    // Inject Supabase env from any name (SUPABASE_*, VITE_*, PUBLIC_*) so client and SSR get them.
    // Vite only exposes VITE_* by default; Vercel uses SUPABASE_*. Define all variants so every code path sees values.
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || ''
      ),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(
        process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.PUBLIC_SUPABASE_ANON_KEY ||
          ''
      ),
      'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify(
        process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
      ),
      'import.meta.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        process.env.PUBLIC_SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          ''
      ),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.PUBLIC_SUPABASE_ANON_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          ''
      ),
      // Custom domain for AMRAP (e.g. amrapwithfriends.com); used by amrap-urls.ts and app-registry.ts
      'import.meta.env.PUBLIC_AMRAP_BASE_URL': JSON.stringify(
        (process.env.PUBLIC_AMRAP_BASE_URL || '').trim()
      ),
      'import.meta.env.VITE_AGORA_APP_ID': JSON.stringify(
        (process.env.VITE_AGORA_APP_ID || '').trim()
      )
    },
    server: {
      // Dev: proxy /amrap and Agora token routes (npm run dev:amrap:video, dev:trainer:live)
      proxy: {
        '/amrap': {
          target: 'http://localhost:5177',
          changeOrigin: true,
          ws: true // required so Vite HMR WebSocket works when opening http://localhost:3006/amrap/
        },
        '/api/agora-token': {
          target: 'http://localhost:9517',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/agora-token/, '/token')
        },
        // Dev-only: same standalone token server as AMRAP. It does not run trainer_live_verify_token_targets;
        // production uses the Astro route. Do not treat dev tokens as a substitute for prod auth checks.
        '/api/trainer-live/agora-token': {
          target: 'http://localhost:9517',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/trainer-live\/agora-token/, '/token')
        }
      }
    },
    resolve: {
      alias: {
        '@': src
      },
      dedupe: ['react', 'react-dom', 'scheduler']
    },
    optimizeDeps: {
      include: ['node-domexception', 'react', 'react-dom', 'scheduler', 'sonner'],
      esbuildOptions: {
        mainFields: ['module', 'main']
      }
    },
    ssr: {
      // Only bundle these small packages into the SSR graph. Do not set noExternal: true for
      // everything — bundling google-auth-library breaks JWT signing for Vertex AI at runtime.
      noExternal: ['piccolore', 'clsx', 'es-module-lexer', 'devalue'],
      // Dev only: keep React external so Node requires it at runtime (avoids "module is not defined" when CJS is inlined)
      ...(!isProduction && { external: ['react', 'react-dom', 'scheduler'] })
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase') || id.includes('firebaseService')) {
              return 'firebase';
            }
            // Don't split React into vendor; keep with entry to avoid "useState of null" / jsxDEV errors
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
              return undefined;
            }
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      },
      // Consolidated `vendor` manualChunk is ~1.6MB (React kept in-app per comment above; recharts, etc.).
      chunkSizeWarningLimit: 1700,
      commonjsOptions: {
        // Transform CommonJS modules to ES modules
        transformMixedEsModules: true
      }
    }
  }
});
