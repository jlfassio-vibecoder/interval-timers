import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import AstroPWA from '@vite-pwa/astro';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

const root = fileURLToPath(new URL('.', import.meta.url));
const monorepoRoot = resolve(root, '../..');
/** Resolve `@/` imports inside `apps/amrap/src` when that code is bundled into this app (workspace `amrap` package). */
const amrapWorkspaceSrc = resolve(monorepoRoot, 'apps/amrap/src');
/**
 * Single `@/` resolver: Mission Control (`apps/app/src`) first, then workspace AMRAP (`apps/amrap/src`).
 * Replaces Vite `alias: { '@': src }` so AMRAP packages can share the same `@/` prefix without colliding.
 */
function resolveMonorepoAtPath(id, appSrc) {
  if (!id.startsWith('@/')) return null;
  const rel = id.slice(2);
  const appBase = join(appSrc, rel);
  if (existsSync(appBase + '.tsx')) return appBase + '.tsx';
  if (existsSync(appBase + '.ts')) return appBase + '.ts';
  if (existsSync(appBase) && statSync(appBase).isDirectory()) {
    if (existsSync(join(appBase, 'index.tsx'))) return join(appBase, 'index.tsx');
    if (existsSync(join(appBase, 'index.ts'))) return join(appBase, 'index.ts');
  }

  const amrapBase = join(amrapWorkspaceSrc, rel);
  if (existsSync(amrapBase + '.tsx')) return amrapBase + '.tsx';
  if (existsSync(amrapBase + '.ts')) return amrapBase + '.ts';
  if (existsSync(amrapBase + '.jsx')) return amrapBase + '.jsx';
  if (existsSync(amrapBase + '.js')) return amrapBase + '.js';
  return null;
}

function monorepoAtPathPlugin(appSrc) {
  return {
    name: 'monorepo-at-path',
    enforce: 'pre',
    resolveId(id) {
      return resolveMonorepoAtPath(id, appSrc);
    },
  };
}

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
const analyzeBundle = process.env.ANALYZE === '1' || process.env.ANALYZE === 'true';

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
    plugins: [
      monorepoAtPathPlugin(src),
      ...(analyzeBundle
        ? [
            visualizer({
              filename: resolve(root, 'dist/client/bundle-stats.html'),
              gzipSize: true,
              brotliSize: true,
              template: 'treemap',
              open: false,
            }),
          ]
        : []),
    ],
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
      // Marketing / merged-landing origin when app deploy omits /amrap; getAmrapAppBase appends /amrap
      'import.meta.env.PUBLIC_MARKETING_SITE_URL': JSON.stringify(
        (process.env.PUBLIC_MARKETING_SITE_URL || '').trim()
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
        }
        // `/api/trainer-live/agora-token` is NOT proxied — it must hit Astro `src/pages/api/trainer-live/agora-token.ts`
        // (Supabase `trainer_live_verify_token_targets`). Proxying to the AMRAP token server breaks Trainer Live.
      }
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'scheduler']
    },
    optimizeDeps: {
      include: [
        'node-domexception',
        'react',
        'react-dom',
        'scheduler',
        'sonner',
        // AppWrapper → training-log charts; large graph. Pre-bundle so dev does not serve stale
        // /@fs/…/.vite/deps/recharts.js?v=… (504 Outdated Optimize Dep) after lockfile or dep bumps.
        'recharts'
      ],
      esbuildOptions: {
        mainFields: ['module', 'main']
      }
    },
    ssr: {
      // Only bundle these small packages into the SSR graph. Do not set noExternal: true for
      // everything — bundling google-auth-library breaks JWT signing for Vertex AI at runtime.
      noExternal: [
        'piccolore',
        'clsx',
        'es-module-lexer',
        'devalue',
        'amrap',
        'emom',
        '@interval-timers/amrap-workout-picker'
      ],
      // Dev only: keep React external so Node requires it at runtime (avoids "module is not defined" when CJS is inlined)
      ...(!isProduction && { external: ['react', 'react-dom', 'scheduler'] })
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Keep React in the app graph — splitting it caused "useState of null" / jsxDEV errors.
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return undefined;
            }
            if (!id.includes('node_modules')) return undefined;

            // Isolate only deps that are huge and rarely change together with the rest of the app.
            // Finer splits (Supabase vs markdown vs Lucide) caused Rollup circular-chunk warnings and extra requests without a clean graph.
            if (id.includes('agora-')) return 'vendor-agora';
            if (id.includes('recharts')) return 'vendor-recharts';
            return 'vendor-misc';
          },
        },
      },
      chunkSizeWarningLimit: 1700,
      // Skip per-chunk gzip/brotli sizing in the build log — saves noticeable CPU on large client graphs.
      reportCompressedSize: false,
      commonjsOptions: {
        // Transform CommonJS modules to ES modules
        transformMixedEsModules: true
      }
    }
  }
});
