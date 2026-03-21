/**
 * In-memory sliding-window rate limit for API routes.
 * Keyed by client IP (x-forwarded-for first, cf-connecting-ip fallback).
 *
 * Limitation: per server instance; under multi-region/serverless cold starts
 * limits are best-effort. Phase 2: swap with Vercel KV / Upstash for shared store.
 */

type WindowEntry = { key: string; timestamps: number[] };

const windows = new Map<string, WindowEntry>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  return 'unknown';
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const PARSE_CONFIG: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 };
const HANDOFF_CONFIG: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 };

const RATE_LIMIT_ERROR = 'Too many requests. Try again shortly.';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  error?: string;
}

/**
 * Check sliding-window rate limit. Call before processing.
 * Returns { allowed: false, retryAfter } when over limit.
 */
export function checkRateLimit(
  routeKey: 'parse' | 'handoff',
  request: Request
): RateLimitResult {
  const ip = getClientIp(request);
  const config = routeKey === 'parse' ? PARSE_CONFIG : HANDOFF_CONFIG;
  const key = `${routeKey}:${ip}`;

  const now = Date.now();
  const cutoff = now - config.windowMs;

  let entry = windows.get(key);
  if (!entry) {
    entry = { key, timestamps: [] };
    windows.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = Math.min(...entry.timestamps);
    const retryAfter = Math.ceil((oldestInWindow + config.windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter), error: RATE_LIMIT_ERROR };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}
