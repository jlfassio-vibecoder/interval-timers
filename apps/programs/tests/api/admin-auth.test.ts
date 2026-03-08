/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Integration-style API tests for admin routes.
 * Run against a running dev server (npm run dev on port 3006).
 * Skips if server is unreachable.
 */

import { beforeAll, describe, expect, it } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3006';
const ADMIN_API_ROUTES = ['/api/admin/users', '/api/admin/stats'] as const;
const ADMIN_PAGE_ROUTES = ['/admin/exercises/test-slug', '/admin/exercise-image-gen'] as const;
const UNAUTHORIZED_MESSAGE = 'Unauthorized. Admin access required.';

let serverOk = false;

async function isServerReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${BASE_URL}/`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return res.ok || res.status < 500;
  } catch (err) {
    if (err instanceof Error) {
      console.warn('[admin-auth.test] isServerReachable failed:', err.message);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

describe('admin API auth', () => {
  beforeAll(async () => {
    serverOk = await isServerReachable();
    if (!serverOk) {
      console.warn(
        '[admin-auth.test] Dev server not reachable at %s. Run "npm run dev" and re-run tests. Skipping API tests.',
        BASE_URL
      );
    }
  });

  for (const path of ADMIN_API_ROUTES) {
    describe(`GET ${path}`, () => {
      it('returns 401 when no Authorization or Cookie', async ({ skip }) => {
        skip(!serverOk);
        const res = await fetch(`${BASE_URL}${path}`, {
          method: 'GET',
          headers: {},
        });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body).toHaveProperty('error', UNAUTHORIZED_MESSAGE);
        expect(body).not.toHaveProperty('stack');
        expect(JSON.stringify(body)).not.toMatch(/UNAUTHENTICATED|UNAUTHORIZED/);
      });

      it('returns 401 when invalid token in Authorization Bearer', async ({ skip }) => {
        skip(!serverOk);
        const res = await fetch(`${BASE_URL}${path}`, {
          method: 'GET',
          headers: { Authorization: 'Bearer invalid-token' },
        });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body).toHaveProperty('error', UNAUTHORIZED_MESSAGE);
      }, 15000);

      it('returns 401 when invalid token in Cookie firebaseIdToken', async ({ skip }) => {
        skip(!serverOk);
        const res = await fetch(`${BASE_URL}${path}`, {
          method: 'GET',
          headers: { Cookie: 'firebaseIdToken=invalid-token' },
        });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body).toHaveProperty('error', UNAUTHORIZED_MESSAGE);
      });
    });
  }
});

describe('admin page auth', () => {
  beforeAll(async () => {
    serverOk = await isServerReachable();
    if (!serverOk) {
      console.warn(
        '[admin-auth.test] Dev server not reachable at %s. Skipping page auth tests.',
        BASE_URL
      );
    }
  });

  for (const path of ADMIN_PAGE_ROUTES) {
    describe(`GET ${path}`, () => {
      it('redirects to login when no auth', async ({ skip }) => {
        skip(!serverOk);
        const res = await fetch(`${BASE_URL}${path}`, {
          method: 'GET',
          redirect: 'manual',
        });
        expect(res.status).toBe(302);
        const location = res.headers.get('location') ?? '';
        expect(location).toMatch(/\/admin\/login|\/\?admin_required/);
      });
    });
  }
});
