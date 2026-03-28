/**
 * Verifies Stripe webhook signing helpers behave as expected (no dev server).
 */

import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';

describe('Stripe webhook signature (SDK)', () => {
  it('constructEvent accepts payload signed with generateTestHeaderString', () => {
    const payload = JSON.stringify({
      id: 'evt_test_signature',
      object: 'event',
      type: 'customer.created',
      api_version: '2026-03-25.dahlia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      data: { object: { id: 'cus_x', object: 'customer' } },
    });
    const secret = 'whsec_unit_test_only';
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const stripe = new Stripe('sk_test_unit_only', { typescript: true });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.id).toBe('evt_test_signature');
    expect(event.type).toBe('customer.created');
  });

  it('constructEvent rejects tampered payload', () => {
    const payload = JSON.stringify({
      id: 'evt_tamper',
      object: 'event',
      type: 'ping',
      data: { object: {} },
      created: 1,
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
    });
    const secret = 'whsec_tamper_test';
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const tampered = payload.replace('ping', 'pong');
    const stripe = new Stripe('sk_test_unit_only', { typescript: true });
    expect(() => stripe.webhooks.constructEvent(tampered, header, secret)).toThrow();
  });
});
