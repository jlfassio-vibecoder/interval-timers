/**
 * Stripe webhook: verify signature, idempotent processing, monetization funnel event on checkout complete.
 * Local: `stripe listen --forward-to http://localhost:3006/api/stripe/webhook` and set STRIPE_WEBHOOK_SECRET.
 *
 * Secrets: use `process.env` only (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` or `STRIPE_SIGNING_SECRET`).
 * Do not add these to `vite.define` / `import.meta.env` — that risks bundling into client code if ever imported from a shared module.
 */

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSupabaseServer, hasServiceRoleKey } from '@/lib/supabase/server';

export const prerender = false;

/** Loose UUID match for Supabase auth user ids (hex + version/variant nibble rules relaxed). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLikelyUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/** Checkout Session → Supabase auth user for analytics (optional). Set client_reference_id or metadata.supabase_user_id. */
function parseUserIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const ref = session.client_reference_id;
  if (ref && isLikelyUuid(ref)) return ref.trim();
  const meta = session.metadata ?? {};
  const fromMeta = meta.supabase_user_id ?? meta.user_id;
  if (typeof fromMeta === 'string' && isLikelyUuid(fromMeta)) return fromMeta.trim();
  return null;
}

function stripeSecretKey(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const v = process.env.STRIPE_SECRET_KEY?.trim();
  return v || undefined;
}

function stripeWebhookSigningSecret(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const w = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const s = process.env.STRIPE_SIGNING_SECRET?.trim();
  return w || s || undefined;
}

async function recordCheckoutCompleted(event: Stripe.Event): Promise<void> {
  if (!hasServiceRoleKey()) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for Stripe webhook (RLS on idempotency + analytics_events inserts)'
    );
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const supabase = getSupabaseServer();

  const { error: idemError } = await supabase
    .from('stripe_processed_webhook_events')
    .insert({ stripe_event_id: event.id });

  if (idemError) {
    const code = (idemError as { code?: string }).code;
    const msg = idemError.message ?? '';
    if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
      return;
    }
    throw idemError;
  }

  const userId = parseUserIdFromCheckoutSession(session);
  const customerId =
    typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
  const meta = session.metadata ?? {};
  const planId = typeof meta.plan_id === 'string' ? meta.plan_id : undefined;

  const properties: Record<string, unknown> = {
    stripe_event_id: event.id,
    checkout_session_id: session.id,
    customer_id: customerId,
    payment_status: session.payment_status ?? null,
    amount_total: session.amount_total ?? null,
    currency: session.currency ?? null,
    mode: session.mode ?? null,
  };
  if (planId) properties.plan_id = planId;

  const { error: insertError } = await supabase.from('analytics_events').insert({
    event_name: 'monetization_checkout_completed',
    user_id: userId,
    session_id: null,
    properties,
    app_id: 'stripe_webhook',
  });

  if (insertError) {
    await supabase.from('stripe_processed_webhook_events').delete().eq('stripe_event_id', event.id);
    throw insertError;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const secretKey = stripeSecretKey();
  const webhookSecret = stripeWebhookSigningSecret();

  if (!secretKey?.trim() || !webhookSecret?.trim()) {
    return new Response(JSON.stringify({ error: 'Stripe webhook not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secretKey, { typescript: true });
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[stripe webhook] signature verification failed', err);
    }
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
    console.warn('[stripe webhook]', event.type, event.id);
  }

  if (event.type === 'checkout.session.completed') {
    try {
      await recordCheckoutCompleted(event);
    } catch (err) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[stripe webhook] checkout.session.completed handler failed', err);
      }
      return new Response(JSON.stringify({ error: 'Webhook handler failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
