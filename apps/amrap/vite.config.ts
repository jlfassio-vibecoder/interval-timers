import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Inject Supabase env from SUPABASE_* or VITE_* (Vercel often uses SUPABASE_URL)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default defineConfig({
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
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
