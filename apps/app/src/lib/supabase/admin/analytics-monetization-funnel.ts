/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Monetization funnel (Phase P2): RPC get_monetization_funnel_stats.
 */

import { getSupabaseServer } from '../server';

export interface MonetizationFunnelStep {
  eventName: string;
  label: string;
  totalEvents: number;
  distinctUsers: number;
  distinctSessions: number;
}

export interface MonetizationConversionBlock {
  eligible: number;
  converted: number;
  rate: number;
}

export interface MonetizationFunnelStats {
  from: string;
  to: string;
  days: number;
  steps: MonetizationFunnelStep[];
  userConversions: {
    pricingToCheckout: MonetizationConversionBlock;
    checkoutToCompleted: MonetizationConversionBlock;
  };
  sessionConversions: {
    pricingToCheckout: MonetizationConversionBlock;
  };
  medianSecondsUser: {
    pricingToCheckout: number | null;
    checkoutToCompleted: number | null;
  };
  conversionNotes: string;
}

function parseConversion(raw: unknown): MonetizationConversionBlock {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    eligible: Number(o.eligible ?? 0),
    converted: Number(o.converted ?? 0),
    rate: Number(o.rate ?? 0),
  };
}

export async function getMonetizationFunnelStats(days: number): Promise<MonetizationFunnelStats> {
  const supabase = getSupabaseServer();

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_monetization_funnel_stats', {
    p_days: days,
  });

  if (rpcError) throw rpcError;

  const raw = (rpcData ?? {}) as Record<string, unknown>;

  const stepsRaw = raw.steps;
  const steps: MonetizationFunnelStep[] = Array.isArray(stepsRaw)
    ? (stepsRaw as Array<Record<string, unknown>>).map((row) => ({
        eventName: String(row.eventName ?? ''),
        label: String(row.label ?? ''),
        totalEvents: Number(row.totalEvents ?? 0),
        distinctUsers: Number(row.distinctUsers ?? 0),
        distinctSessions: Number(row.distinctSessions ?? 0),
      }))
    : [];

  const uc = (raw.userConversions ?? {}) as Record<string, unknown>;
  const sc = (raw.sessionConversions ?? {}) as Record<string, unknown>;
  const med = (raw.medianSecondsUser ?? {}) as Record<string, unknown>;

  return {
    from: String(raw.from ?? ''),
    to: String(raw.to ?? ''),
    days: Number(raw.days ?? days),
    steps,
    userConversions: {
      pricingToCheckout: parseConversion(uc.pricingToCheckout),
      checkoutToCompleted: parseConversion(uc.checkoutToCompleted),
    },
    sessionConversions: {
      pricingToCheckout: parseConversion(sc.pricingToCheckout),
    },
    medianSecondsUser: {
      pricingToCheckout:
        med.pricingToCheckout === null || med.pricingToCheckout === undefined
          ? null
          : Number(med.pricingToCheckout),
      checkoutToCompleted:
        med.checkoutToCompleted === null || med.checkoutToCompleted === undefined
          ? null
          : Number(med.checkoutToCompleted),
    },
    conversionNotes: String(
      raw.conversionNotes ?? 'User rates require user_id on events; anonymous steps use session_id.'
    ),
  };
}
