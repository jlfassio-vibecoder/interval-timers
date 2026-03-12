import fs from 'node:fs'
import path from 'path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { PROTOCOL_TO_PATH } from './src/lib/protocolPaths'

/** Derived from canonical paths so preview rewrites stay in sync with vercel.json and copy script. */
const STANDALONE_PATHS = Object.values(PROTOCOL_TO_PATH)

function standalonePathsPreviewPlugin(): Plugin {
  return {
    name: 'standalone-paths-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        const match = STANDALONE_PATHS.find(
          (p) => url === `/${p}` || url === `/${p}/`
        )
        // Only rewrite when the standalone app was copied into dist (e.g. after build:deploy).
        // Otherwise preview would 404; skip rewrite so request is handled by static server.
        if (
          match &&
          fs.existsSync(path.join(__dirname, 'dist', match, 'index.html'))
        ) {
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
  server: {
    port: 5180,
    // In dev, proxy conflicts with landing's /src (both apps use it).
    // Use direct links instead: Account → LandingPage href; AMRAP → protocolPaths.getPathForProtocol.
    proxy: {},
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
