import path from 'path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const STANDALONE_PATHS = [
  'daily-warm-up',
  'tabata-timer',
  'japanese-walking',
  'aerobic-timer',
  'amrap',
  'lactate-threshold',
  'power-intervals',
  'gibala-method',
  'wingate',
  'timmons',
  'emom-timer',
  '10-20-30',
]

function standalonePathsPreviewPlugin(): Plugin {
  return {
    name: 'standalone-paths-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        const match = STANDALONE_PATHS.find(
          (p) => url === `/${p}` || url === `/${p}/`
        )
        if (match) {
          req.url =
            `/${match}/index.html` +
            (req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), standalonePathsPreviewPlugin()],
  base: '/',
  server: { port: 5180 },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
