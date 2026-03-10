#!/usr/bin/env node

/**
 * Environment variable validation script
 * Loads .env then .env.local from project root (.env.local overrides .env).
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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

// Programs auth uses HIIT Workout Timer Supabase (same as AMRAP). Accept either var set.
const REQUIRED_ENV_VARS = [
  ['PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'],
  ['PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'],
];

const OPTIONAL_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'PUBLIC_GEMINI_API_KEY',
  'RUNWAYML_API_SECRET',
];

let errors = [];
let warnings = [];

// In CI, allow missing env vars (build/deploy jobs set their own env from secrets)
const isCI = process.env.CI === 'true';

// Validate required variables (each row is [preferred, fallback])
REQUIRED_ENV_VARS.forEach(([preferred, fallback]) => {
  const value = process.env[preferred] || process.env[fallback];
  if (!value || value === '' || value === 'PLACEHOLDER_API_KEY') {
    if (isCI) {
      warnings.push(`CI: ${preferred} or ${fallback} not set (validation skipped for CI)`);
    } else {
      errors.push(`Missing: ${preferred} or ${fallback} (HIIT Supabase)`);
    }
  }
});

// Validate Supabase URL format (must use .supabase.co, not .supabase.com)
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (supabaseUrl && supabaseUrl.includes('.supabase.com') && !supabaseUrl.includes('.supabase.co')) {
  errors.push(
    'PUBLIC_SUPABASE_URL uses wrong domain. Use https://<project-ref>.supabase.co (not .supabase.com)'
  );
}

// In CI, if all required vars are missing, pass with warning so PR checks don't block
if (isCI && errors.length === 0 && warnings.some((w) => w.startsWith('CI:'))) {
  console.log('✅ CI: Environment validation skipped (set env in workflow for build/deploy).\n');
  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`  ${w}`));
  }
  process.exit(0);
}

// Warn about optional variables
OPTIONAL_ENV_VARS.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    warnings.push(`Optional variable not set: ${varName}`);
  }
});

// Output results
if (errors.length > 0) {
  console.error('❌ Environment variable validation failed:\n');
  errors.forEach((error) => console.error(`  ${error}`));
  console.error('\nSet these variables in .env.local or your deployment environment.\n');
  process.exit(1);
}

console.log('✅ Environment variables validated\n');
if (warnings.length > 0) {
  warnings.forEach((warning) => console.warn(`  ${warning}`));
}
process.exit(0);
