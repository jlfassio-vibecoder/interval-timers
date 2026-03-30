/**
 * Studio-scoped copy for roster invite + welcome flows (stored in studios.welcome_content JSONB).
 * Public subset is exposed to invitees via preview RPC; trainers edit via Mission Control API.
 */

export type StudioWelcomeLocaleKey = 'en' | 'es' | 'fr';

/** Per-locale overrides; omitted keys fall back to app defaults + welcome-landing-strings. */
export interface StudioWelcomeLocaleBlock {
  heroTitle?: string | null;
  heroSub?: string | null;
  clientStatusStrip?: string | null;
  friendStatusStrip?: string | null;
  successFriend?: string | null;
  successClient?: string | null;
  openAppCta?: string | null;
  /** Use `{name}` for trainer first name (welcome-back path). */
  trainerTeaserTemplate?: string | null;
}

export interface StudioWelcomeContentStored {
  /** Internal note for trainer (not shown on public landing). */
  emailSenderNote?: string | null;
  en?: StudioWelcomeLocaleBlock;
  es?: StudioWelcomeLocaleBlock;
  fr?: StudioWelcomeLocaleBlock;
}
