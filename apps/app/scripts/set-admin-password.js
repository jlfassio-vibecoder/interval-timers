#!/usr/bin/env node

/**
 * Set password for a Supabase Auth user via Admin API (e.g. admin recovery).
 * Usage: node scripts/set-admin-password.js <email-or-user-id> "YourNewPassword"
 * Requires .env.local with SUPABASE_URL (or PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 * Prompts for confirmation before updating.
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s) {
  return typeof s === 'string' && UUID_REGEX.test(s.trim());
}

function question(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local'));

const identifier = process.argv[2];
const newPassword = process.argv[3];
if (!identifier || !newPassword) {
  console.error('Usage: node scripts/set-admin-password.js <email-or-user-id> "YourNewPassword"');
  console.error('  User ID can be found in Supabase Dashboard > Authentication > Users.');
  process.exit(1);
}

const url =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL/PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

const base = url.replace(/\/$/, '');

let userId;
let userEmail = null;

if (isUuid(identifier)) {
  userId = identifier.trim();
} else {
  // Treat as email: resolve via list users (Admin API does not support server-side email filter)
  const listRes = await fetch(`${base}/auth/v1/admin/users?per_page=1000`, {
    headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
  });
  if (!listRes.ok) {
    console.error('Failed to list users:', listRes.status, await listRes.text());
    process.exit(1);
  }
  const listData = await listRes.json();
  const users = listData.users || [];
  const user = users.find((u) => (u.email || '').toLowerCase() === identifier.trim().toLowerCase());
  if (!user) {
    console.error('User not found for email. Use Supabase Dashboard > Authentication > Users to find the user ID and pass that instead.');
    process.exit(1);
  }
  userId = user.id;
  userEmail = user.email || identifier;
}

const displayUser = userEmail || userId;
console.log('Project:', url);
console.log('User:', displayUser);
console.log('You are about to set a new password for this user. Type "yes" to confirm.');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await question(rl, 'Confirm (yes/no): ');
rl.close();
if (answer.trim().toLowerCase() !== 'yes') {
  console.log('Aborted.');
  process.exit(0);
}

const res = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  },
  body: JSON.stringify({ password: newPassword }),
});

if (!res.ok) {
  const body = await res.text();
  console.error('Failed to update password:', res.status, body);
  process.exit(1);
}
console.log('Password updated for', displayUser, '. You can log in with the new password.');
