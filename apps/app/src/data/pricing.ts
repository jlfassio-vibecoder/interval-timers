/**
 * HIIT Ecosystem pricing (value-based scaling) for the Programs landing page.
 * Stripe payment links: set PUBLIC_STRIPE_PAYMENT_LINK_* env vars (new names preferred;
 * legacy *_PREMIUM / *_PRO / *_ELITE / *_COACH* fall back for existing deployments).
 *
 * purchased_index (profiles): 0=Athlete, 1=Host, 2=Pro, 3=Studio; 4=Coach Pro (legacy); 5=Studio Pro.
 */

/** Maps public `PricingPlan.id` to `profiles.purchased_index` (HIIT Ecosystem 0–3). */
export function purchasedIndexForPlanId(planId: string): number | null {
  const map: Record<string, number> = {
    athlete: 0,
    host: 1,
    pro: 2,
    studio: 3,
  };
  return map[planId] ?? null;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  period: 'month' | 'year';
  description: string;
  features: string[];
  popular?: boolean;
  ctaText: string;
  ctaVariant: 'primary' | 'secondary';
  ctaLink?: string;
}

const APP_BASE = (
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.PUBLIC_APP_URL) ||
  'https://app.aiworkoutgenerator.com'
).replace(/\/$/, '');
const FALLBACK_LOGIN_URL = `${APP_BASE}/login`;
/** Fallback checkout URL when new Athlete link env is unset (legacy Premium link). */
const DEFAULT_ATHLETE_PAYMENT_LINK = 'https://buy.stripe.com/dRm6oHcW3gW19RZ6qlgnK00';

function firstStripeLink(...envKeys: string[]): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
    for (const key of envKeys) {
      const v = env[key];
      if (typeof v === 'string' && v.trim() !== '') return v;
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_LOGIN_URL;
}

function getAthleteLink(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> })
    .env;
  const athlete = env?.PUBLIC_STRIPE_PAYMENT_LINK_ATHLETE;
  if (typeof athlete === 'string' && athlete.trim() !== '') return athlete;
  const legacyPremium = env?.PUBLIC_STRIPE_PAYMENT_LINK_PREMIUM;
  if (typeof legacyPremium === 'string' && legacyPremium.trim() !== '') return legacyPremium;
  return env?.PROD ? DEFAULT_ATHLETE_PAYMENT_LINK : FALLBACK_LOGIN_URL;
}

function getHostLink(): string {
  return firstStripeLink('PUBLIC_STRIPE_PAYMENT_LINK_HOST', 'PUBLIC_STRIPE_PAYMENT_LINK_PRO');
}

function getProTrainerLink(): string {
  return firstStripeLink(
    'PUBLIC_STRIPE_PAYMENT_LINK_PRO_TRAINER',
    'PUBLIC_STRIPE_PAYMENT_LINK_ELITE'
  );
}

function getStudioLink(): string {
  return firstStripeLink(
    'PUBLIC_STRIPE_PAYMENT_LINK_STUDIO',
    'PUBLIC_STRIPE_PAYMENT_LINK_COACH_PRO',
    'PUBLIC_STRIPE_PAYMENT_LINK_COACH'
  );
}

export const pricingPlans: PricingPlan[] = [
  {
    id: 'athlete',
    name: 'Athlete',
    price: 9.99,
    period: 'month',
    description:
      'Solo performer — AI readiness, GPS logs, and Brain-driven training. 7-day calibration trial before first charge.',
    features: [
      'AI-generated “Ready-to-Train” logic (readiness-informed workouts)',
      'Daily routine, HR, and map log context for your sessions',
      'Monthly AI generation credits (capped; upgrade for unlimited)',
      '7-day calibration period to learn your baseline',
    ],
    ctaText: 'Start calibration',
    ctaVariant: 'secondary',
    ctaLink: getAthleteLink(),
  },
  {
    id: 'host',
    name: 'Host',
    price: 24.99,
    period: 'month',
    description:
      'Social leader — private leaderboard and network effect. Invite up to 5 Buddies at no extra cost.',
    popular: true,
    features: [
      'Everything in Athlete',
      'Host a private leaderboard for your crew',
      'Invite up to 5 Buddies free (family-plan style)',
      'Community retention hooks — your group stays in one ecosystem',
    ],
    ctaText: 'Become a Host',
    ctaVariant: 'primary',
    ctaLink: getHostLink(),
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49.99,
    period: 'month',
    description:
      'Independent trainer — client management, not just self-tracking. Base includes 30 client slots; scales with your roster.',
    features: [
      'Base $49.99/mo includes up to 30 paid client slots',
      '+$1.00 per active client per month beyond 30 (value-based scaling)',
      '360° view: confirm clients logged housework, walking, and training signals',
      'Unlimited AI workout generation for your practice (no per-gen anxiety)',
    ],
    ctaText: 'Go Pro',
    ctaVariant: 'secondary',
    ctaLink: getProTrainerLink(),
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 199.99,
    period: 'month',
    description:
      'Boutique gym / multi-coach — admin dashboard, engagement analytics, and scale beyond a single trainer.',
    features: [
      'From $199.99/mo for the first location (multi-location add-ons as you scale)',
      'Unlimited trainers under one license (per agreement)',
      'Admin dashboard + member engagement analytics',
      'Position HIIT as your gym OS — timer users stay longer (retention story)',
    ],
    ctaText: 'Talk Studio',
    ctaVariant: 'secondary',
    ctaLink: getStudioLink(),
  },
];
