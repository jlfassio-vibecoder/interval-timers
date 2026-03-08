#!/usr/bin/env node

/**
 * Security scan script to check for hardcoded secrets and sensitive data
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Patterns to check for hardcoded secrets
const SECRET_PATTERNS = [
  {
    name: 'Firebase API Key',
    pattern: /AIzaSy[A-Za-z0-9_-]{35}/,
    message: 'Hardcoded Firebase API key found',
  },
  {
    name: 'reCAPTCHA Site Key',
    pattern: /6L[a-zA-Z0-9_-]{38}/,
    message: 'Hardcoded reCAPTCHA site key found',
  },
  {
    name: 'Debug Token',
    pattern: /[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/i,
    message: 'Potential debug token found (UUID format)',
    excludeFiles: ['package-lock.json', 'node_modules'],
  },
  {
    name: 'Hardcoded API Key Pattern',
    pattern: /(api[_-]?key|apikey)\s*[:=]\s*["'][^"']{20,}["']/i,
    message: 'Potential hardcoded API key pattern',
  },
];

// Files/directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.astro',
  '.git',
  'package-lock.json',
  'ref-files',
  '.husky',
  'docs',
];

// Extensions to check
const CHECK_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.astro', '.mjs', '.cjs'];

let errors = [];

function shouldIgnore(filePath) {
  const relativePath = relative(projectRoot, filePath);
  return IGNORE_PATTERNS.some(pattern => relativePath.includes(pattern));
}

function scanFile(filePath) {
  if (shouldIgnore(filePath)) return;

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    SECRET_PATTERNS.forEach(({ name, pattern, message, excludeFiles }) => {
      if (excludeFiles) {
        const fileName = basename(filePath);
        if (excludeFiles.includes(fileName)) return;
      }

      lines.forEach((line, index) => {
        const match = pattern.exec(line);
        if (match) {
          // Skip if it's an environment variable reference
          if (line.includes('import.meta.env') || line.includes('process.env')) {
            return;
          }
          // Skip if it's in a comment
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            return;
          }

          errors.push({
            file: relative(projectRoot, filePath),
            line: index + 1,
            pattern: name,
            message,
            snippet: line.trim().substring(0, 100),
          });
        }
      });
    });
  } catch {
    // Skip files that can't be read (binary, etc.)
  }
}

function scanDirectory(dir) {
  try {
    const entries = readdirSync(dir);

    entries.forEach(entry => {
      const fullPath = join(dir, entry);
      
      if (shouldIgnore(fullPath)) return;

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (CHECK_EXTENSIONS.includes(ext)) {
          scanFile(fullPath);
        }
      }
    });
  } catch {
    // Skip directories that can't be read
  }
}

// Run scan
console.log('🔒 Scanning for hardcoded secrets...\n');
scanDirectory(join(projectRoot, 'src'));

// Also check root level config files
['astro.config.mjs', 'package.json', 'firebase.json'].forEach(file => {
  const filePath = join(projectRoot, file);
  try {
    if (statSync(filePath).isFile()) {
      scanFile(filePath);
    }
  } catch {
    // File doesn't exist, skip
  }
});

if (errors.length > 0) {
  console.error('❌ Security issues found:\n');
  errors.forEach(({ file, line, pattern, message, snippet }) => {
    console.error(`  ${file}:${line}`);
    console.error(`  Pattern: ${pattern}`);
    console.error(`  ${message}`);
    console.error(`  Snippet: ${snippet}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ No hardcoded secrets found\n');
  process.exit(0);
}
