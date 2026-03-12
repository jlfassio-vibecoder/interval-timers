import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** In dev, respond to /api/warmup-config so useWarmupConfig doesn't 404. App uses static fallback when slots is empty. */
function warmupConfigFallbackPlugin() {
  return {
    name: 'warmup-config-fallback',
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req: { url: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s: string) => void }, next: () => void) => {
        if (req.url === '/api/warmup-config' || req.url?.endsWith('/api/warmup-config')) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ slots: [] }))
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [warmupConfigFallbackPlugin(), react()],
  base: '/daily-warm-up/',
  envDir: path.resolve(__dirname, '../..'),
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
    ),
  },
  server: { port: 5174 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
