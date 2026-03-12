import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const envDir = path.resolve(__dirname, '../..')

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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '')
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || ''

  return {
    plugins: [warmupConfigFallbackPlugin(), react()],
    base: '/daily-warm-up/',
    envDir,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    server: { port: 5174 },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
