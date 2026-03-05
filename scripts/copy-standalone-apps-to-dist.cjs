/**
 * Copies standalone app dists into apps/landing/dist for merged Vercel deploy.
 * Run after building landing and each standalone app so /, /daily-warm-up, /amrap, etc. are served correctly.
 * Clears each target dir before copy to avoid serving stale assets when a build removes/renames files.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const landingDist = path.join(repoRoot, 'apps', 'landing', 'dist');

const copies = [
  { src: 'daily-warmup', dest: 'daily-warm-up' },
  { src: 'tabata', dest: 'tabata-timer' },
  { src: 'japanese-walking', dest: 'japanese-walking' },
  { src: 'aerobic', dest: 'aerobic-timer' },
  { src: 'amrap', dest: 'amrap' },
  { src: 'lactate-threshold', dest: 'lactate-threshold' },
  { src: 'power-intervals', dest: 'power-intervals' },
  { src: 'gibala-method', dest: 'gibala-method' },
  { src: 'wingate', dest: 'wingate' },
  { src: 'timmons', dest: 'timmons' },
  { src: 'emom', dest: 'emom-timer' },
  { src: 'ten-twenty-thirty', dest: '10-20-30' },
  { src: 'bio-sync-sixty', dest: 'bio-sync-sixty' },
  { src: 'bio-sync-sixty/apps/master-clock', dest: 'bio-sync-sixty/master-clock', workspace: 'master-clock' },
];

for (const copy of copies) {
  const { src, dest, workspace } = { workspace: null, ...copy };
  const srcDir = path.join(repoRoot, 'apps', src, 'dist');
  const targetDir = path.join(landingDist, dest);
  const buildHint = workspace || src;
  if (!fs.existsSync(srcDir)) {
    console.error(`apps/${src}/dist not found. Run: npm run build -w ${buildHint}`);
    process.exit(1);
  }
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true });
  }
  fs.cpSync(srcDir, targetDir, { recursive: true });
  console.log(`Copied apps/${src}/dist -> apps/landing/dist/${dest}`);
}
