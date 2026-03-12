import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const envDir = path.resolve(__dirname, '../..')

// https://vite.dev/config/
// Load env from monorepo root; inject SUPABASE_* or VITE_* into client (process.env is empty unless dotenv/shell)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '')
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || ''

  return {
  plugins: [react()],
  base: '/amrap/',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
  },
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
  envDir,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  }
})
