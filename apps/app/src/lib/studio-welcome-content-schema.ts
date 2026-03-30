/**
 * Pure validation/normalization for studios.welcome_content (safe for client + server).
 */

import type {
  StudioWelcomeContentStored,
  StudioWelcomeLocaleBlock,
  StudioWelcomeLocaleKey,
} from '@/types/studio-welcome-content';

export const STUDIO_WELCOME_LIMITS = {
  heroTitle: 200,
  heroSub: 500,
  statusStrip: 500,
  success: 500,
  openAppCta: 120,
  trainerTeaser: 300,
  emailSenderNote: 2000,
} as const;

function trimOrNull(s: unknown, max: number): string | null {
  if (s == null) return null;
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

const LOCALE_FIELDS: (keyof StudioWelcomeLocaleBlock)[] = [
  'heroTitle',
  'heroSub',
  'clientStatusStrip',
  'friendStatusStrip',
  'successFriend',
  'successClient',
  'openAppCta',
  'trainerTeaserTemplate',
];

const FIELD_LIMIT: Record<keyof StudioWelcomeLocaleBlock, number> = {
  heroTitle: STUDIO_WELCOME_LIMITS.heroTitle,
  heroSub: STUDIO_WELCOME_LIMITS.heroSub,
  clientStatusStrip: STUDIO_WELCOME_LIMITS.statusStrip,
  friendStatusStrip: STUDIO_WELCOME_LIMITS.statusStrip,
  successFriend: STUDIO_WELCOME_LIMITS.success,
  successClient: STUDIO_WELCOME_LIMITS.success,
  openAppCta: STUDIO_WELCOME_LIMITS.openAppCta,
  trainerTeaserTemplate: STUDIO_WELCOME_LIMITS.trainerTeaser,
};

function parseLocaleBlock(raw: unknown): StudioWelcomeLocaleBlock | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const block: StudioWelcomeLocaleBlock = {};
  for (const k of LOCALE_FIELDS) {
    const v = trimOrNull(o[k as string], FIELD_LIMIT[k]);
    if (v != null) block[k] = v;
  }
  return Object.keys(block).length ? block : undefined;
}

function mergeLocaleBlockFromPatch(
  base: StudioWelcomeLocaleBlock | undefined,
  patchRaw: unknown
): StudioWelcomeLocaleBlock | undefined {
  if (!patchRaw || typeof patchRaw !== 'object' || Array.isArray(patchRaw)) {
    return base;
  }
  const p = patchRaw as Record<string, unknown>;
  const hasAnyPatchKey = LOCALE_FIELDS.some((k) => k in p);
  if (!hasAnyPatchKey) {
    return base;
  }
  const out: StudioWelcomeLocaleBlock = { ...(base ?? {}) };
  for (const k of LOCALE_FIELDS) {
    if (!(k in p)) continue;
    const val = p[k as string];
    if (val === null || val === '') {
      delete out[k];
      continue;
    }
    if (typeof val === 'string') {
      const t = trimOrNull(val, FIELD_LIMIT[k]);
      if (t == null) delete out[k];
      else out[k] = t;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Normalize unknown JSON from DB or API into a safe stored shape (drops junk keys).
 */
export function parseStudioWelcomeContent(raw: unknown): StudioWelcomeContentStored {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const out: StudioWelcomeContentStored = {};
  const note = trimOrNull(o.emailSenderNote, STUDIO_WELCOME_LIMITS.emailSenderNote);
  if (note != null) out.emailSenderNote = note;
  const en = parseLocaleBlock(o.en);
  const es = parseLocaleBlock(o.es);
  const fr = parseLocaleBlock(o.fr);
  if (en) out.en = en;
  if (es) out.es = es;
  if (fr) out.fr = fr;
  return out;
}

const LOCALE_KEYS: StudioWelcomeLocaleKey[] = ['en', 'es', 'fr'];

/**
 * Deep-merge PATCH body onto existing stored content (empty string clears a field).
 */
export function mergeStudioWelcomeContentPatch(
  existing: StudioWelcomeContentStored,
  patch: unknown
): StudioWelcomeContentStored {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return parseStudioWelcomeContent(existing);
  }
  const p = patch as Record<string, unknown>;
  const merged: StudioWelcomeContentStored = { ...existing };
  if ('emailSenderNote' in p) {
    const v = trimOrNull(p.emailSenderNote, STUDIO_WELCOME_LIMITS.emailSenderNote);
    if (v == null) delete merged.emailSenderNote;
    else merged.emailSenderNote = v;
  }
  for (const key of LOCALE_KEYS) {
    if (!(key in p)) continue;
    const next = mergeLocaleBlockFromPatch(existing[key], p[key]);
    if (next) merged[key] = next;
    else delete merged[key];
  }
  return parseStudioWelcomeContent(merged);
}

function mergeTwoLocaleBlocks(
  base: StudioWelcomeLocaleBlock | undefined,
  overlay: StudioWelcomeLocaleBlock | undefined
): StudioWelcomeLocaleBlock | undefined {
  if (!overlay || !Object.keys(overlay).length) return base;
  if (!base || !Object.keys(base).length) return overlay;
  const out: StudioWelcomeLocaleBlock = { ...base };
  for (const k of LOCALE_FIELDS) {
    const v = overlay[k];
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Studio-first copy with trainer layer overriding non-empty fields per locale (invite + welcome-back).
 */
export function mergeWelcomeContentLayers(
  studio: StudioWelcomeContentStored | null | undefined,
  trainer: StudioWelcomeContentStored | null | undefined
): StudioWelcomeContentStored {
  const s = studio && Object.keys(studio).length ? parseStudioWelcomeContent(studio) : {};
  const t = trainer && Object.keys(trainer).length ? parseStudioWelcomeContent(trainer) : {};
  const merged: StudioWelcomeContentStored = {};
  const noteT = t.emailSenderNote?.trim();
  const noteS = s.emailSenderNote?.trim();
  if (noteT) merged.emailSenderNote = noteT;
  else if (noteS) merged.emailSenderNote = noteS;
  for (const key of LOCALE_KEYS) {
    const block = mergeTwoLocaleBlocks(s[key], t[key]);
    if (block) merged[key] = block;
  }
  return parseStudioWelcomeContent(merged);
}

/**
 * Strips `emailSenderNote` before returning welcome JSON to unauthenticated invite preview.
 * That field is trainer-internal only (see StudioWelcomeContentStored).
 */
export function welcomeContentForPublicInvitePreview(
  stored: StudioWelcomeContentStored | null | undefined
): StudioWelcomeContentStored | null {
  if (!stored || typeof stored !== 'object') return null;
  const cleaned = parseStudioWelcomeContent(stored);
  delete cleaned.emailSenderNote;
  return Object.keys(cleaned).length ? cleaned : null;
}

export function getStudioWelcomeContentLimits(): typeof STUDIO_WELCOME_LIMITS {
  return STUDIO_WELCOME_LIMITS;
}
