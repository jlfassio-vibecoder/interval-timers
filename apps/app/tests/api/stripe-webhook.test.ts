/**
 * POST /api/stripe/webhook — requires dev server and matching Stripe env.
 *
 * Run (from repo root), with the same secrets the server was started with:
 *   STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... npx vitest run tests/api/stripe-webhook.test.ts -w app
 *
 * Or start the app with those vars, then run vitest in a shell that loads the same .env.
 */

import Stripe from 'stripe';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3006';

function loadAppEnv(): void {
  const appRoot = resolve(__dirname, '../..');
  const repoRoot = resolve(appRoot, '../..');
  // Must match astro.config.mjs: later files override earlier (apps/app/.env wins over repo root).
  loadDotenv({ path: resolve(repoRoot, '.env') });
  loadDotenv({ path: resolve(repoRoot, '.env.local'), override: true });
  loadDotenv({ path: resolve(appRoot, '.env'), override: true });
  loadDotenv({ path: resolve(appRoot, '.env.local'), override: true });
}

function webhookSecret(): string | undefined {
  const a = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const b = process.env.STRIPE_SIGNING_SECRET?.trim();
  return a || b || undefined;
}

let serverOk = false;
let hasStripeEnv = false;

describe('POST /api/stripe/webhook', () => {
  beforeAll(async () => {
    loadAppEnv();
    const whsec = webhookSecret();
    const sk = process.env.STRIPE_SECRET_KEY?.trim();
    hasStripeEnv = Boolean(whsec && sk);
    if (!hasStripeEnv) {
      console.warn(
        '[stripe-webhook.test] Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (or STRIPE_SIGNING_SECRET) to run HTTP tests.'
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${BASE_URL}/`, { method: 'HEAD', signal: controller.signal });
      serverOk = res.ok || res.status < 500;
    } catch {
      serverOk = false;
    } finally {
      clearTimeout(timeoutId);
    }
    if (!serverOk) {
      console.warn(
        `[stripe-webhook.test] Dev server not reachable at ${BASE_URL}. Run "npm run dev" in apps/app and re-run.`
      );
    }
  });

  it('returns 200 and { received: true } for a valid signed payload', async ({ skip }) => {
    skip(!serverOk || !hasStripeEnv);
    const whsec = webhookSecret()!;
    const payload = JSON.stringify({
      id: 'evt_http_test',
      object: 'event',
      type: 'payment_intent.succeeded',
      api_version: '2026-03-25.dahlia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      data: { object: { id: 'pi_test', object: 'payment_intent' } },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: whsec });

    const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': header,
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { received?: boolean };
    expect(body).toEqual({ received: true });
  });

  it('returns 400 when stripe-signature is missing', async ({ skip }) => {
    skip(!serverOk || !hasStripeEnv);
    const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature does not match body', async ({ skip }) => {
    skip(!serverOk || !hasStripeEnv);
    const whsec = webhookSecret()!;
    const payload = JSON.stringify({
      id: 'evt_bad_sig',
      object: 'event',
      type: 'ping',
      data: { object: {} },
      created: 1,
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: whsec });
    const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': header,
      },
      body: payload.replace('ping', 'pong'),
    });
    expect(res.status).toBe(400);
  });
});
