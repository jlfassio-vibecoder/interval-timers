/**
 * SEO meta (title, description) per protocol for dynamic document head.
 */

import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolLandingConfig } from '../components/interval-timers/intervalTimerLandingConfig';
import { getProtocolLabel } from '@interval-timers/timer-core';

const SITE_NAME = 'HIIT Workout Timer';

export interface ProtocolSeoMeta {
  title: string;
  description: string;
}

function buildMeta(protocol: IntervalTimerPage): ProtocolSeoMeta {
  const label = getProtocolLabel(protocol);
  const config = getProtocolLandingConfig(protocol);
  const title = config?.hero?.title ?? `${label} Timer`;
  const description =
    config?.hero?.subtitle ?? `Use the ${label} interval timer for scientifically validated workouts.`;
  return {
    title: `${title} | ${SITE_NAME}`,
    description,
  };
}

const CACHE: Partial<Record<IntervalTimerPage, ProtocolSeoMeta>> = {};

export function getProtocolSeoMeta(protocol: IntervalTimerPage): ProtocolSeoMeta {
  if (!CACHE[protocol]) CACHE[protocol] = buildMeta(protocol);
  return CACHE[protocol] as ProtocolSeoMeta;
}

export const LANDING_TITLE = `Interval Timers | ${SITE_NAME}`;
export const LANDING_DESCRIPTION =
  'Master every energy system with scientifically validated interval protocols: Tabata, Japanese Walking, Wingate, and more.';
