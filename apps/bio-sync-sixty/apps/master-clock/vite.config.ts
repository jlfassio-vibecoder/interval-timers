import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Monorepo: alias must point at the CSS entry file (not the package dir) so loadStylesheet readFile() does not hit EISDIR
const tailwindV4Dir = path.resolve(__dirname, '../../../../node_modules/@tailwindcss/vite/node_modules/tailwindcss');
const tailwindV4Entry = path.join(tailwindV4Dir, 'index.css');

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/bio-sync60/master-clock/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        tailwindcss: tailwindV4Entry,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
