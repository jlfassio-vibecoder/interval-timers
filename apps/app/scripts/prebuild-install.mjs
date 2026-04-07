/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Avoid a second full `npm install` on Vercel/CI: the platform Install step already ran,
 * and optionalDependencies (e.g. @rollup/rollup-linux-x64-gnu) resolve for Linux builders.
 *
 * The previous prebuild always ran `npm install --force` before `astro build`, which roughly
 * doubled install work and burned build minutes.
 */
import { spawnSync } from 'node:child_process';

function runNpm(args) {
  return spawnSync('npm', args, { stdio: 'inherit' });
}

if (process.env.VERCEL === '1' || process.env.CI === 'true') {
  process.exit(0);
}

const quickArgs = [
  'install',
  '--no-audit',
  '--no-fund',
  '--include=optional',
  '--force',
  '@rollup/rollup-linux-x64-gnu',
];
let r = runNpm(quickArgs);
if (r.status === 0) {
  process.exit(0);
}

r = runNpm(['install', '--no-audit', '--no-fund', '--include=optional', '--force']);
process.exit(r.status ?? 1);
