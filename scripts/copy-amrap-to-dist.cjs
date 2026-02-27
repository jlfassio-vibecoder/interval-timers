/**
 * Copies apps/amrap/dist into apps/all-timers/dist/amrap for merged Vercel deploy.
 * Run after building both all-timers and amrap so /amrap is served by the standalone app.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const amrapDist = path.join(repoRoot, 'apps', 'amrap', 'dist');
const targetDir = path.join(repoRoot, 'apps', 'all-timers', 'dist', 'amrap');

if (!fs.existsSync(amrapDist)) {
  console.error('apps/amrap/dist not found. Run: npm run build -w amrap');
  process.exit(1);
}
fs.cpSync(amrapDist, targetDir, { recursive: true });
console.log('Copied apps/amrap/dist -> apps/all-timers/dist/amrap');
