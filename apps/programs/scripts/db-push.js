#!/usr/bin/env node

/**
 * Run supabase db push with env from .env.local (including SUPABASE_DB_PASSWORD).
 * Usage: npm run db:push
 * Requires: supabase CLI installed (npm i -g supabase or npx supabase)
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local'));

const r = spawnSync('supabase', ['db', 'push'], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});
process.exit(r.status ?? 1);
