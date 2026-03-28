/**
 * Copy-only A/B variants for the welcome / roster invite hero (headline + subcopy).
 * Query `?welcome_ab=a|b` persists to sessionStorage; default `a`. No behavior split.
 */
export type WelcomeHeroVariantId = 'a' | 'b';

const STORAGE_KEY = 'welcome_ab_variant';

export function resolveWelcomeHeroVariant(): WelcomeHeroVariantId {
  if (typeof window === 'undefined') return 'a';
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('welcome_ab') || params.get('ab') || '').trim().toLowerCase();
    if (q === 'a' || q === 'b') {
      sessionStorage.setItem(STORAGE_KEY, q);
      return q;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
    if (stored === 'a' || stored === 'b') return stored;
  } catch {
    /* private mode */
  }
  return 'a';
}

export interface WelcomeHeroCopy {
  titleInvited: string;
  titleWelcomeBack: string;
  subMissingToken: string;
  subCalendarTeaser: string;
}

const VARIANTS: Record<WelcomeHeroVariantId, WelcomeHeroCopy> = {
  a: {
    titleInvited: "You're invited",
    titleWelcomeBack: 'Welcome',
    subMissingToken:
      'This link is missing an invitation code. Ask your host or trainer for a new invite.',
    subCalendarTeaser: "Here's what's on your calendar this week.",
  },
  b: {
    titleInvited: 'Join your coach on HIIT Workout Timer',
    titleWelcomeBack: 'Welcome back',
    subMissingToken:
      'We could not find an invite on this link. Ask your host or trainer to resend your invitation.',
    subCalendarTeaser: 'Your upcoming sessions for the next week are below.',
  },
};

export function getWelcomeHeroCopy(variant: WelcomeHeroVariantId): WelcomeHeroCopy {
  return VARIANTS[variant] ?? VARIANTS.a;
}
