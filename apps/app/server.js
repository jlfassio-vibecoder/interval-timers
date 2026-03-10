// CRITICAL: Set up __dirname polyfill FIRST before any other imports
// This ensures __dirname is available for Firebase Admin SDK bundled code
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import express from 'express';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Make __dirname available globally for Firebase Admin SDK
// This must be set before any Firebase Admin SDK code is loaded
if (typeof globalThis.__dirname === 'undefined') {
  globalThis.__dirname = __dirname;
}

// Firebase App Hosting sets PORT (8080). Use 8080 in production when unset; 3002 for local dev.
const PORT =
  Number(process.env.PORT) ||
  (process.env.NODE_ENV === 'production' ? 8080 : 3002);
const HOST = process.env.HOST || '0.0.0.0';

// Prevent Astro entry from auto-starting; only server.js starts the server (avoids EADDRINUSE on 8080)
process.env.ASTRO_NODE_AUTOSTART = 'disabled';

// Check if dist/server/entry.mjs exists (SSR build)
const serverEntryPath = join(__dirname, 'dist', 'server', 'entry.mjs');

if (!existsSync(serverEntryPath)) {
  console.error(`Error: Server entry not found at ${serverEntryPath}`);
  console.error('Please run "npm run build" before starting the server.');
  process.exit(1);
}

// Import the Astro SSR entry point
const entryModule = await import('./dist/server/entry.mjs');
const handler = entryModule.handler;

if (!handler) {
  console.error('Error: handler not found in entry.mjs');
  process.exit(1);
}

// Create Express app with Gzip compression for text-based resources (HTML, JS, CSS)
const app = express();
app.use(
  compression({
    threshold: 0,
    filter: (req) => {
      const url = (req.url || '').split('?')[0];
      if (/\.(woff2?|ttf|eot|otf|png|jpe?g|gif|webp|ico|mp4|webm|mp3|wav|pdf)$/i.test(url)) {
        return false;
      }
      return true;
    },
  })
);
app.use((req, res, next) => {
  Promise.resolve(handler(req, res)).catch(next);
});
// Centralized error handler to surface/log SSR errors
app.use((err, req, res, next) => {
  console.error('Unhandled error in SSR handler:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).send('Internal Server Error');
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Astro SSR server running on http://${HOST}:${PORT} (with Gzip compression)`);
});
server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Server may already be running.`);
  } else {
    console.error('Error starting server:', error);
    process.exit(1);
  }
});
