/**
 * Copies favicon.ico from src/assets/favicon to public/ for legacy browser support.
 * Run before build so /favicon.ico is available.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src', 'assets', 'favicon', 'favicon.ico');
const dest = join(root, 'public', 'favicon.ico');

if (!existsSync(src)) {
  console.warn('copy-favicon: src/assets/favicon/favicon.ico not found, skipping.');
  process.exit(0);
}

const publicDir = dirname(dest);
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

copyFileSync(src, dest);
