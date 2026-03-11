#!/usr/bin/env node
/**
 * Scaffold a new timer app from apps/.template-timer/
 * Usage: node scripts/generate-timer-app.cjs [--name=WORKSPACE] [--path=URL_PATH] [--merged|--no-merged]
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(REPO_ROOT, 'apps', '.template-timer');
const WORKSPACE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// URL path: segments of [a-z0-9][a-z0-9-]* separated by / (e.g. foo-bar, 10-20-30, bio-sync-sixty/master-clock)
const URL_PATH_REGEX = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;

function prompt(question, defaultVal = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const def = defaultVal ? ` (${defaultVal})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${def}: `, (answer) => {
      rl.close();
      const trimmed = typeof answer === 'string' ? answer.trim() : '';
      resolve(trimmed || defaultVal);
    });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { name: null, path: null, merged: null };
  for (const a of args) {
    if (a.startsWith('--name=')) out.name = a.slice(7).trim();
    else if (a.startsWith('--path=')) out.path = a.slice(7).trim();
    else if (a === '--merged') out.merged = true;
    else if (a === '--no-merged') out.merged = false;
  }
  return out;
}

function normalizeAndValidateUrlPath(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  let s = raw.trim().replace(/^\/+|\/+$/g, '');
  if (s === '') return null;
  if (/\.\.|[\\'"\0-\x1f]/.test(s)) {
    console.error(
      'URL path must not contain .., backslashes, quotes, or control characters.'
    );
    process.exit(1);
  }
  if (!URL_PATH_REGEX.test(s)) {
    console.error(
      'URL path must be lowercase letters, numbers, hyphens only (e.g. foo-bar or foo/bar).'
    );
    process.exit(1);
  }
  return s;
}

function toTitle(workspace) {
  return workspace
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    + ' Timer';
}

function findNextPort() {
  const appsDir = path.join(REPO_ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return 5190;
  const dirs = fs.readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const ports = [];
  for (const name of dirs) {
    const vitePath = path.join(appsDir, name, 'vite.config.ts');
    if (fs.existsSync(vitePath)) {
      const content = fs.readFileSync(vitePath, 'utf8');
      const m = content.match(/server:\s*\{\s*port:\s*(\d+)/);
      if (m) ports.push(parseInt(m[1], 10));
    }
  }
  const maxPort = ports.length ? Math.max(...ports) : 5189;
  return Math.max(maxPort + 1, 5190);
}

function copyRecursive(src, dest, exclude = ['node_modules']) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (exclude.includes(entry.name)) continue;
      copyRecursive(path.join(src, entry.name), path.join(dest, entry.name), exclude);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [key, val] of Object.entries(replacements)) {
    content = content.split(key).join(String(val));
  }
  fs.writeFileSync(filePath, content);
}

function patchRootPackageJson(workspace) {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const devKey = `dev:${workspace}`;
  const buildKey = `build:${workspace}`;
  if (pkg.scripts[devKey]) return;
  const ordered = {};
  for (const k of Object.keys(pkg.scripts)) {
    if (k === 'env:pull') {
      ordered[devKey] = `npm run dev -w ${workspace}`;
      ordered[buildKey] = `npm run build -w ${workspace}`;
    }
    ordered[k] = pkg.scripts[k];
  }
  if (!(devKey in ordered)) {
    ordered[devKey] = `npm run dev -w ${workspace}`;
    ordered[buildKey] = `npm run build -w ${workspace}`;
  }
  pkg.scripts = ordered;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function patchBuildDeploy(workspace) {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const script = pkg.scripts['build:deploy'];
  if (!script || script.includes(`--filter=${workspace}`)) return;
  const insert = ` --filter=${workspace}`;
  const before = ' && node scripts/copy-standalone-apps-to-dist.cjs';
  pkg.scripts['build:deploy'] = script.replace(before, insert + before);
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function patchCopyScript(workspace, urlPath) {
  const copyPath = path.join(REPO_ROOT, 'scripts', 'copy-standalone-apps-to-dist.cjs');
  let content = fs.readFileSync(copyPath, 'utf8');
  const entry = `  { src: '${workspace}', dest: '${urlPath}' },\n  `;
  const search = `  { src: 'bio-sync-sixty', dest: 'bio-sync-sixty' },`;
  if (content.includes(`src: '${workspace}'`)) return;
  content = content.replace(search, entry + search);
  fs.writeFileSync(copyPath, content);
}

function patchVercelJson(urlPath) {
  const vercelPath = path.join(REPO_ROOT, 'vercel.json');
  const cfg = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const rewrites = cfg.rewrites || [];
  const pathPrefix = `/${urlPath}`;
  const newRewrites = [
    { source: pathPrefix, destination: `${pathPrefix}/index.html` },
    { source: `${pathPrefix}/`, destination: `${pathPrefix}/index.html` },
    { source: `${pathPrefix}/(.*)`, destination: `${pathPrefix}/$1` },
  ];
  const catchAll = rewrites.findIndex((r) => r.source === '/:path*');
  const insertAt = catchAll >= 0 ? catchAll : rewrites.length;
  const existing = rewrites.some((r) => r.source === pathPrefix);
  if (existing) return;
  cfg.rewrites = [...rewrites.slice(0, insertAt), ...newRewrites, ...rewrites.slice(insertAt)];
  fs.writeFileSync(vercelPath, JSON.stringify(cfg, null, 2));
}

async function main() {
  let { name, path: urlPath, merged } = parseArgs();

  if (!name) {
    name = await prompt('Workspace name (e.g. murph)');
    if (!name) {
      console.error('Workspace name is required.');
      process.exit(1);
    }
  }

  if (!WORKSPACE_REGEX.test(name)) {
    console.error('Workspace name must be lowercase letters, numbers, and hyphens only.');
    process.exit(1);
  }

  if (urlPath === null || urlPath === '') urlPath = name;
  urlPath = normalizeAndValidateUrlPath(urlPath) ?? name;
  if (merged === null) {
    const m = await prompt('Include in merged deploy?', 'yes');
    merged = !m || m.toLowerCase().startsWith('y');
  }

  const targetDir = path.join(REPO_ROOT, 'apps', name);
  if (fs.existsSync(targetDir)) {
    console.error(`apps/${name}/ already exists.`);
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(`Template not found at ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  const title = toTitle(name);
  const basePath = `/${urlPath}/`;
  const port = findNextPort();

  console.log(`Creating apps/${name}/ ...`);
  copyRecursive(TEMPLATE_DIR, targetDir);

  const replacements = {
    '{{WORKSPACE_NAME}}': name,
    '{{BASE_PATH}}': basePath,
    '{{TITLE}}': title,
    '{{PORT}}': port,
  };

  replaceInFile(path.join(targetDir, 'package.json'), { '{{WORKSPACE_NAME}}': name });
  replaceInFile(path.join(targetDir, 'vite.config.ts'), replacements);
  replaceInFile(path.join(targetDir, 'index.html'), { '{{TITLE}}': title });

  patchRootPackageJson(name);

  if (merged) {
    patchBuildDeploy(name);
    patchCopyScript(name, urlPath);
    patchVercelJson(urlPath);
  }

  console.log(`
Created apps/${name}/

Next steps:
  1. Run: npm install
  2. Implement your timer in apps/${name}/src/components/interval-timers/
  3.${merged ? ` (Merged) Timer will be at /${urlPath} after npm run build:deploy` : ' Create Vercel project with Root Directory apps/' + name}
  4. Optional: add to landing grid (protocolPaths, IntervalTimerPage) if new protocol
  5. Set env vars in Vercel if the app needs Supabase
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
