/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Feature ↔ analytics event mapping for admin engagement (Phase P4) and future Growth Engine Feature ROI.
 * Keep `eventNames` aligned with `FUNNEL_EVENTS` in packages/analytics plus documented server-only events.
 */

import { FUNNEL_EVENTS } from '@interval-timers/analytics';

/** Inserted only by Stripe webhook; not in client FUNNEL_EVENTS. */
export const MONETIZATION_CHECKOUT_COMPLETED = 'monetization_checkout_completed' as const;

export interface FeatureActivityDefinition {
  id: string;
  name: string;
  /** Short product surface description for admin UI */
  surface: string;
  readonly eventNames: readonly string[];
}

/**
 * Each funnel event appears in exactly one feature. Order is display order in Analytics.
 */
export const FEATURE_ACTIVITY_CATALOG: readonly FeatureActivityDefinition[] = [
  {
    id: 'timer',
    name: 'Timer',
    surface: 'Standalone timer apps (complete, save, stats)',
    eventNames: ['timer_session_complete', 'timer_save_click', 'timer_view_stats_click'],
  },
  {
    id: 'activity_hub',
    name: 'Universal Activity Hub',
    surface: 'Parse, launch, handoff, hub actions',
    eventNames: [
      'hub_timer_launch_1',
      'hub_timer_launch_2',
      'hub_parse_success',
      'hub_parse_fail',
      'hub_action_click',
      'hub_handoff_post_ok',
      'hub_handoff_post_fail',
    ],
  },
  {
    id: 'account',
    name: 'Account',
    surface: 'Signup, login, land handoff, session prefill',
    eventNames: [
      'account_land_handoff',
      'account_signup_start',
      'account_signup_complete',
      'account_login_complete',
      'account_session_prefill_success',
      'account_session_prefill_fail',
    ],
  },
  {
    id: 'profile',
    name: 'Profile & training log',
    surface: 'Profile edits, training log alignment',
    eventNames: ['profile_field_updated', 'profile_completed', 'training_log_alignment_viewed'],
  },
  {
    id: 'guest_amrap',
    name: 'Guest & AMRAP',
    surface: 'Save prompts, AMRAP guest claim',
    eventNames: [
      'guest_save_prompt_shown',
      'guest_save_prompt_signup',
      'guest_amrap_claim_succeeded',
      'guest_amrap_claim_failed',
    ],
  },
  {
    id: 'minimal_onboarding',
    name: 'Minimal onboarding',
    surface: '/account/onboarding/minimal',
    eventNames: [
      'minimal_onboarding_viewed',
      'minimal_onboarding_baseline_saved',
      'minimal_onboarding_goals_saved',
      'minimal_onboarding_complete',
    ],
  },
  {
    id: 'monetization',
    name: 'Monetization',
    surface: 'Pricing funnel + Stripe checkout completed (server)',
    eventNames: [
      'monetization_pricing_viewed',
      'monetization_checkout_started',
      MONETIZATION_CHECKOUT_COMPLETED,
    ],
  },
] as const;

/** Distinct event names covered by the catalog (for capped trend queries). */
export function allCatalogEventNames(): string[] {
  const set = new Set<string>();
  for (const f of FEATURE_ACTIVITY_CATALOG) {
    for (const e of f.eventNames) set.add(e);
  }
  return [...set];
}

/**
 * Events used for “power user” buckets: core activation signals without noisy high-volume noise.
 */
export const POWER_USER_EVENT_NAMES: readonly string[] = [
  'timer_session_complete',
  'timer_save_click',
  'hub_timer_launch_1',
  'hub_timer_launch_2',
  'hub_parse_success',
  'account_land_handoff',
  'account_session_prefill_success',
];

/** Map event_name → feature id for trend aggregation. */
export function eventNameToFeatureId(): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of FEATURE_ACTIVITY_CATALOG) {
    for (const e of f.eventNames) m.set(e, f.id);
  }
  return m;
}

/** Sanity: every FUNNEL_EVENTS name appears in the catalog. */
function assertFunnelEventsCovered(): void {
  const covered = new Set(allCatalogEventNames());
  for (const e of FUNNEL_EVENTS) {
    if (!covered.has(e)) {
      if (import.meta.env.DEV) {
        console.warn('[feature-activity-catalog] FUNNEL_EVENTS not in catalog:', e);
      }
    }
  }
}

assertFunnelEventsCovered();

/** Known `analytics_events.app_id` values for 7d volume breakdown (not exhaustive). */
export const KNOWN_ANALYTICS_APP_IDS = [
  'app',
  'universal_activity_hub',
  'amrap',
  'tabata',
  'daily-warmup',
  'stripe_webhook',
] as const;
