/**
 * Copies standalone app dists into apps/all-timers/dist for merged Vercel deploy.
 * Run after building all-timers and each standalone app so /amrap, /lactate-threshold, etc. are served by standalone apps.
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
];

for (const { src, dest } of copies) {
  const srcDir = path.join(repoRoot, 'apps', src, 'dist');
  const targetDir = path.join(allTimersDist, dest);
  if (!fs.existsSync(srcDir)) {
    console.error(`apps/${src}/dist not found. Run: npm run build -w ${src}`);
    process.exit(1);
  }
  fs.cpSync(srcDir, targetDir, { recursive: true });
  console.log(`Copied apps/${src}/dist -> apps/all-timers/dist/${dest}`);
}
