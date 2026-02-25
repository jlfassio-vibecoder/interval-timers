/**
 * Single source of truth for protocol-specific landing content.
 * Used by IntervalTimerLandingContent for config-driven hero/sections/CTA.
 * Protocols with hasCustomContent use their own component (TabataInterval, JapaneseWalking).
 */
import type { IntervalTimerPage } from './intervalTimerProtocols';
import { getProtocolLabel } from './intervalTimerProtocols';

export interface HeroConfig {
  title: string;
  subtitle: string;
  /** Word in title to wrap in gold (e.g. "4-Minute"). If absent, whole title or first word can be styled. */
  highlightWord?: string;
  primaryCtaLabel: string;
  /** If set, primary CTA scrolls to this id; else CTA navigates (use primaryCtaNavigateTo). */
  primaryCtaScrollTargetId?: string;
  /** Protocol to navigate to when primary CTA is "try" (e.g. tabata). */
  primaryCtaNavigateTo?: IntervalTimerPage;
  secondaryCtaLabel?: string;
  secondaryCtaNavigateTo?: IntervalTimerPage;
}

export interface SectionConfig {
  badge: string;
  heading: string;
  body: string;
  type?: 'text' | 'stats';
}

export interface ProtocolLandingConfig {
  hero: HeroConfig;
  sections: SectionConfig[];
  /** True = render custom component (TabataInterval / MindfulWalking) instead of config content. */
  hasCustomContent?: boolean;
}

function comingSoonHero(label: string): HeroConfig {
  return {
    title: `${label} Timer`,
    subtitle: 'This timer is coming soon. Try Tabata or Japanese Walking in the meantime.',
    highlightWord: label,
    primaryCtaLabel: 'Try Tabata',
    primaryCtaNavigateTo: 'tabata',
    secondaryCtaLabel: 'Try Japanese Walking',
    secondaryCtaNavigateTo: 'mindful',
  };
}

/** Config for all 11 protocols. hasCustomContent protocols use their existing page component; others use this config. */
export const PROTOCOL_LANDING_CONFIG: Partial<Record<IntervalTimerPage, ProtocolLandingConfig>> = {
  warmup: {
    hero: {
      title: 'Daily Warm-Up',
      subtitle: 'Joint mobility and activation. A simple 15-minute routine.',
      highlightWord: 'Warm-Up',
      primaryCtaLabel: 'Start Daily Warm-Up',
      primaryCtaScrollTargetId: 'simulator',
    },
    sections: [],
    hasCustomContent: true,
  },
  tabata: {
    hero: {
      title: 'The Original 4-Minute Miracle',
      subtitle: 'Tabata Protocol (20s Work / 10s Rest). Discovered by Dr. Izumi Tabata in 1996.',
      highlightWord: '4-Minute',
      primaryCtaLabel: 'Start Tabata',
      primaryCtaScrollTargetId: 'simulator',
    },
    sections: [],
    hasCustomContent: true,
  },
  mindful: {
    hero: {
      title: 'The Synthesis of Power & Peace',
      subtitle: 'Japanese Walking protocol. Use Mindful Walking breath during recovery phases.',
      highlightWord: 'Power',
      primaryCtaLabel: 'Experience Protocol',
      primaryCtaScrollTargetId: 'simulator',
    },
    sections: [],
    hasCustomContent: true,
  },
  aerobic: {
    hero: comingSoonHero(getProtocolLabel('aerobic')),
    sections: [],
    hasCustomContent: true,
  },
  lactate: {
    hero: comingSoonHero(getProtocolLabel('lactate')),
    sections: [],
    hasCustomContent: true,
  },
  phosphagen: {
    hero: comingSoonHero(getProtocolLabel('phosphagen')),
    sections: [],
    hasCustomContent: true,
  },
  gibala: {
    hero: comingSoonHero(getProtocolLabel('gibala')),
    sections: [],
    hasCustomContent: true,
  },
  wingate: {
    hero: comingSoonHero(getProtocolLabel('wingate')),
    sections: [],
    hasCustomContent: true,
  },
  timmons: {
    hero: comingSoonHero(getProtocolLabel('timmons')),
    sections: [],
    hasCustomContent: true,
  },
  emom: {
    hero: comingSoonHero(getProtocolLabel('emom')),
    sections: [],
    hasCustomContent: true,
  },
  amrap: {
    hero: comingSoonHero(getProtocolLabel('amrap')),
    sections: [],
    hasCustomContent: true,
  },
  '10-20-30': {
    hero: comingSoonHero(getProtocolLabel('10-20-30')),
    sections: [],
    hasCustomContent: true,
  },
};

export function getProtocolLandingConfig(
  protocol: IntervalTimerPage
): ProtocolLandingConfig | null {
  return PROTOCOL_LANDING_CONFIG[protocol] ?? null;
}

export function hasCustomLandingContent(protocol: IntervalTimerPage): boolean {
  return PROTOCOL_LANDING_CONFIG[protocol]?.hasCustomContent === true;
}
