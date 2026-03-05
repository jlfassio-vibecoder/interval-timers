import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Monorepo: alias must point at the CSS entry file (not the package dir) so loadStylesheet readFile() does not hit EISDIR
const tailwindV4Dir = path.resolve(__dirname, '../../../../node_modules/@tailwindcss/vite/node_modules/tailwindcss');
const tailwindV4Entry = path.join(tailwindV4Dir, 'index.css');
// Nested workspace has no local node_modules; deps are hoisted to root so alias date-fns-tz for resolution
const rootNodeModules = path.resolve(__dirname, '../../../../node_modules');

export default defineConfig(() => {
  return {
    base: '/bio-sync60/master-clock/',
    plugins: [react(), tailwindcss()],
    // Do not inject API keys into client bundle; call any secret-requiring APIs via a server proxy.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        tailwindcss: tailwindV4Entry,
        'date-fns-tz': path.join(rootNodeModules, 'date-fns-tz'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
