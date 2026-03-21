/**
 * Env-gated in-memory parse cache. Reduces AI cost for repeated identical pastes.
 * Enable via PARSE_PASTED_WORKOUT_CACHE=1.
 *
 * Key: hash of normalized rawText (trim + collapse whitespace).
 * TTL 10 min, max 500 entries, oldest-first eviction when full.
 */

import { createHash } from 'node:crypto';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

type CacheEntry = { workoutSet: WorkoutSetTemplate; expiresAt: number };

const cache = new Map<string, CacheEntry>();

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function hashKey(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

function prune(): void {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt <= now) cache.delete(k);
  }
}

function evictIfNeeded(): void {
  // Evict when at or over capacity so set() doesn't exceed MAX_ENTRIES
  if (cache.size < MAX_ENTRIES) return;
  const entries = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const toDelete = cache.size - MAX_ENTRIES + 1;
  for (let i = 0; i < toDelete && i < entries.length; i++) {
    cache.delete(entries[i][0]);
  }
}

export function isEnabled(): boolean {
  return import.meta.env.PARSE_PASTED_WORKOUT_CACHE === '1';
}

export function get(rawText: string): WorkoutSetTemplate | null {
  if (!isEnabled()) return null;
  const normalized = normalize(rawText);
  if (!normalized) return null;
  const key = hashKey(normalized);
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.workoutSet;
}

export function set(rawText: string, workoutSet: WorkoutSetTemplate): void {
  if (!isEnabled()) return;
  const normalized = normalize(rawText);
  if (!normalized) return;
  prune();
  evictIfNeeded();
  const key = hashKey(normalized);
  cache.set(key, { workoutSet, expiresAt: Date.now() + TTL_MS });
}
