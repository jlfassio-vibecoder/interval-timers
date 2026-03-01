/**
 * Copies standalone app dists into apps/all-timers/dist for merged Vercel deploy.
 * Run after building all-timers and each standalone app so /amrap, /lactate-threshold, etc. are served by standalone apps.
 * Clears each target dir before copy to avoid serving stale assets when a build removes/renames files.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const allTimersDist = path.join(repoRoot, 'apps', 'all-timers', 'dist');

const copies = [
  { src: 'amrap', dest: 'amrap' },
  { src: 'lactate-threshold', dest: 'lactate-threshold' },
  { src: 'power-intervals', dest: 'power-intervals' },
  { src: 'gibala-method', dest: 'gibala-method' },
  { src: 'wingate', dest: 'wingate' },
  { src: 'timmons', dest: 'timmons' },
  { src: 'emom', dest: 'emom-timer' },
  { src: 'ten-twenty-thirty', dest: '10-20-30' },
];

for (const { src, dest } of copies) {
  const srcDir = path.join(repoRoot, 'apps', src, 'dist');
  const targetDir = path.join(allTimersDist, dest);
  if (!fs.existsSync(srcDir)) {
    console.error(`apps/${src}/dist not found. Run: npm run build -w ${src}`);
    process.exit(1);
  }
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true });
  }
  fs.cpSync(srcDir, targetDir, { recursive: true });
  console.log(`Copied apps/${src}/dist -> apps/all-timers/dist/${dest}`);
}
