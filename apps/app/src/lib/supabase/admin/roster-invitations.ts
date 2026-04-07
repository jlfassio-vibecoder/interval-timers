/**
 * Roster invitations: hosts invite friends, trainers invite clients (program enrollment).
 * Tokens are hashed at rest; accept requires an authenticated session matching invitee email/phone.
 */

import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseServer, hasServiceRoleKey } from '@/lib/supabase/server';
import { fetchTrainerRoster, isHostBuddy } from '@/lib/supabase/admin/trainer-roster';
import {
  mergeWelcomeContentLayers,
  parseStudioWelcomeContent,
  welcomeContentForPublicInvitePreview,
} from '@/lib/studio-welcome-content-schema';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RosterInvitePreview, RosterInviteStudioPreview } from '@/types/roster-invite-preview';
import type { Database } from '@/types/supabase';

export type { RosterInvitePreview, RosterInviteStudioPreview };

export const HOST_BUDDY_CAP = 5;
export const ROSTER_INVITE_EXPIRY_DAYS = 14;

export type RosterInviteChannel = 'email' | 'phone';

export interface PendingInvitationDto {
  id: string;
  kind: 'friend' | 'client';
  channel: RosterInviteChannel;
  inviteeEmail: string | null;
  inviteePhoneE164: string | null;
  programIds: string[];
  createdAt: string;
  expiresAt: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Unique / conflict on insert — PostgREST may surface 23505, 409, or message text. */
function isUniqueOrConflictInsertError(
  err: {
    code?: string;
    message?: string;
    status?: number;
    statusCode?: number;
  } | null
): boolean {
  if (!err) return false;
  if (err.code === '23505') return true;
  const m = (err.message ?? '').toLowerCase();
  if (m.includes('duplicate key') || m.includes('unique constraint')) return true;
  if (err.status === 409 || err.statusCode === 409) return true;
  return false;
}

export function generateRosterInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hub origin for invite links and Supabase Auth `redirectTo`.
 * Prefer a request-derived hint only when it matches {@link resolvePublicAppUrlFromRequest} rules
 * (same host/protocol as PUBLIC_APP_URL, or localhost in dev); otherwise env/default base is used.
 */
function getPublicAppBase(publicAppBaseHint?: string | null): string {
  const hint = publicAppBaseHint?.trim() ?? '';
  if (hint && /^https?:\/\//i.test(hint)) {
    try {
      const u = new URL(hint);
      if (u.hostname) return `${u.protocol}//${u.host}`.replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }
  const raw =
    (typeof process !== 'undefined' && process.env.PUBLIC_APP_URL?.trim()) ||
    (import.meta.env.PUBLIC_APP_URL as string | undefined)?.trim() ||
    'https://app.aiworkoutgenerator.com';
  return String(raw).replace(/\/$/, '');
}

function configuredPublicAppOrigin(): string {
  return getPublicAppBase(null);
}

/** Same host + protocol + port as PUBLIC_APP_URL (or default); blocks header spoofing of invite links. */
function originMatchesConfigured(candidate: string, configured: string): boolean {
  try {
    const a = new URL(candidate);
    const b = new URL(configured);
    return (
      a.protocol === b.protocol &&
      a.hostname.toLowerCase() === b.hostname.toLowerCase() &&
      a.port === b.port
    );
  } catch {
    return false;
  }
}

/**
 * Dev-only: real browser origin for localhost so invite links work when PUBLIC_APP_URL points at production.
 * Not used for forwarded headers (those must still match configured origin in production).
 */
function tryLocalDevRequestOrigin(request: Request): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    const u = new URL(request.url);
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return `${u.protocol}//${u.host}`.replace(/\/$/, '');
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Hub origin for invite links and Auth redirectTo. Untrusted Host/Origin headers are ignored unless they
 * match PUBLIC_APP_URL; falls back to configured base. See tryLocalDevRequestOrigin for local dev.
 */
export function resolvePublicAppUrlFromRequest(request: Request): string {
  const configured = configuredPublicAppOrigin();
  const localDev = tryLocalDevRequestOrigin(request);
  if (localDev) return localDev;

  const acceptIfAllowed = (candidate: string | null | undefined): string | null => {
    const c = candidate?.trim();
    if (!c) return null;
    return originMatchesConfigured(c, configured) ? c.replace(/\/$/, '') : null;
  };

  const xfHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const xfProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (xfHost) {
    const proto = xfProto && /^https?$/i.test(xfProto) ? xfProto.toLowerCase() : 'https';
    const fromXf = acceptIfAllowed(`${proto}://${xfHost}`);
    if (fromXf) return fromXf;
  }
  const originHdr = request.headers.get('origin')?.trim();
  if (originHdr && /^https?:\/\//i.test(originHdr)) {
    try {
      const u = new URL(originHdr);
      if (u.host) {
        const fromOrigin = acceptIfAllowed(`${u.protocol}//${u.host}`);
        if (fromOrigin) return fromOrigin;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const u = new URL(request.url);
    if (u.host) {
      const fromUrl = acceptIfAllowed(`${u.protocol}//${u.host}`);
      if (fromUrl) return fromUrl;
    }
  } catch {
    /* fall through */
  }
  return configured;
}

/**
 * Invite landing URL. When inviter has a studio slug, use vanity path `/s/{slug}/i/{token}`.
 */
export function buildRosterInviteAcceptUrl(
  rawToken: string,
  studioSlug?: string | null,
  publicAppBaseHint?: string | null,
  extraQuery?: Record<string, string> | null
): string {
  const base = getPublicAppBase(publicAppBaseHint);
  const slug = typeof studioSlug === 'string' ? studioSlug.trim() : '';
  let path: string;
  if (slug) {
    path = `${base}/s/${encodeURIComponent(slug)}/i/${encodeURIComponent(rawToken)}`;
  } else {
    path = `${base}/welcome?invite=${encodeURIComponent(rawToken)}`;
  }
  if (!extraQuery || Object.keys(extraQuery).length === 0) {
    return path;
  }
  try {
    const u = new URL(path);
    for (const [k, v] of Object.entries(extraQuery)) {
      if (v) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    const q = new URLSearchParams(extraQuery as Record<string, string>).toString();
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}${q}`;
  }
}

/** Resolve studio vanity slug for invite URLs (trainer profiles only). */
export async function getStudioSlugForInviter(inviterId: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data: prof, error: pErr } = await supabase
    .from('profiles')
    .select('studio_id')
    .eq('id', inviterId)
    .maybeSingle();
  if (pErr || !prof?.studio_id) return null;
  const { data: studio, error: sErr } = await supabase
    .from('studios')
    .select('slug')
    .eq('id', prof.studio_id as string)
    .maybeSingle();
  if (sErr || !studio?.slug) return null;
  const s = String(studio.slug).trim();
  return s || null;
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Minimal E.164 check; invitee must sign up with the same normalized phone. */
export function normalizeInvitePhoneE164(phone: string): string | null {
  const t = phone.trim();
  if (!/^\+[1-9]\d{6,14}$/.test(t)) return null;
  return t;
}

async function countHostBuddySlotsReserved(hostId: string): Promise<number> {
  const supabase = getSupabaseServer();
  const [{ count: buddyCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('host_friend_connections')
      .select('*', { count: 'exact', head: true })
      .eq('host_id', hostId),
    supabase
      .from('roster_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', hostId)
      .eq('kind', 'friend')
      .eq('status', 'pending'),
  ]);
  return (buddyCount ?? 0) + (pendingCount ?? 0);
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc('find_auth_user_id_by_email', {
    p_email: normalizeInviteEmail(email),
  });
  if (error) {
    if (import.meta.env.DEV) console.warn('[roster-invitations] find_auth_user_id_by_email', error);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

async function findUserIdByPhone(phoneE164: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc('find_auth_user_id_by_phone', {
    p_phone: phoneE164,
  });
  if (error) {
    if (import.meta.env.DEV) console.warn('[roster-invitations] find_auth_user_id_by_phone', error);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

export interface CreateRosterInviteInput {
  inviterId: string;
  inviterRole: string;
  channel: RosterInviteChannel;
  email?: string;
  phoneE164?: string;
  programIds?: string[];
  /** From API request origin; ensures inviteUrl / Auth redirect match the live hub host */
  publicAppBaseHint?: string | null;
}

export interface CreateRosterInviteResult {
  ok: true;
  invitationId: string;
  inviteUrl: string;
  rawToken: string;
}

export type CreateRosterInviteError =
  | { ok: false; code: 'VALIDATION'; message: string }
  | { ok: false; code: 'CAP'; message: string }
  | { ok: false; code: 'ALREADY_ROSTER'; message: string }
  | { ok: false; code: 'DB'; message: string };

export async function createRosterInvite(
  input: CreateRosterInviteInput
): Promise<CreateRosterInviteResult | CreateRosterInviteError> {
  const { inviterId, inviterRole, channel } = input;
  const isTrainerSide =
    inviterRole === 'trainer' || inviterRole === 'admin' || inviterRole === 'super_admin';

  let inviteeEmail: string | null = null;
  let inviteePhoneE164: string | null = null;
  if (channel === 'email') {
    if (!input.email?.trim()) {
      return { ok: false, code: 'VALIDATION', message: 'Email is required' };
    }
    inviteeEmail = normalizeInviteEmail(input.email);
  } else {
    const p = input.phoneE164 ? normalizeInvitePhoneE164(input.phoneE164) : null;
    if (!p) {
      return {
        ok: false,
        code: 'VALIDATION',
        message:
          'Phone must be E.164 (e.g. +15551234567). SMS is not sent automatically; share the invite link.',
      };
    }
    inviteePhoneE164 = p;
  }

  let kind: 'friend' | 'client';
  let dbInviterRole: 'host' | 'trainer';
  let programIds: string[] = [];

  if (inviterRole === 'host') {
    kind = 'friend';
    dbInviterRole = 'host';
    if (input.programIds?.length) {
      return { ok: false, code: 'VALIDATION', message: 'Friend invites cannot include programs' };
    }
    const cap = await countHostBuddySlotsReserved(inviterId);
    if (cap >= HOST_BUDDY_CAP) {
      return {
        ok: false,
        code: 'CAP',
        message: `You can have at most ${HOST_BUDDY_CAP} buddies (including pending invites).`,
      };
    }
  } else if (isTrainerSide) {
    kind = 'client';
    dbInviterRole = 'trainer';
    programIds = input.programIds ?? [];
    if (programIds.length === 0) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Select at least one program for client invites',
      };
    }
    const supabase = getSupabaseServer();
    const { data: programs, error: progErr } = await supabase
      .from('programs')
      .select('id')
      .eq('trainer_id', inviterId)
      .in('id', programIds);
    if (progErr) {
      return { ok: false, code: 'DB', message: 'Failed to validate programs' };
    }
    if (!programs || programs.length !== programIds.length) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid or foreign program selection' };
    }
    // Project only workouts JSON (not full week content) to cut payload and DB→app transfer on invite validation.
    const { data: weekRows, error: weeksErr } = await supabase
      .from('program_weeks')
      .select('program_id, workouts:content->workouts')
      .in('program_id', programIds);
    if (weeksErr) {
      return { ok: false, code: 'DB', message: 'Failed to validate program schedules' };
    }
    const withWorkouts = new Set<string>();
    for (const row of weekRows ?? []) {
      const pid = row.program_id as string;
      const workouts = row.workouts as unknown[] | null | undefined;
      if (Array.isArray(workouts) && workouts.length > 0) {
        withWorkouts.add(pid);
      }
    }
    const missingSchedule = programIds.filter((id) => !withWorkouts.has(id));
    if (missingSchedule.length > 0) {
      return {
        ok: false,
        code: 'VALIDATION',
        message:
          'Each selected program must have at least one week with workouts. Open the program in the builder and finish building (run Build phase for each phase) before assigning it to a client.',
      };
    }
  } else {
    return { ok: false, code: 'VALIDATION', message: 'Unsupported inviter role for invites' };
  }

  const existingUserId =
    channel === 'email' && inviteeEmail
      ? await findUserIdByEmail(inviteeEmail)
      : inviteePhoneE164
        ? await findUserIdByPhone(inviteePhoneE164)
        : null;

  if (existingUserId) {
    if (kind === 'friend') {
      if (existingUserId === inviterId) {
        return { ok: false, code: 'ALREADY_ROSTER', message: 'You cannot invite yourself' };
      }
      if (await isHostBuddy(inviterId, existingUserId)) {
        return {
          ok: false,
          code: 'ALREADY_ROSTER',
          message: 'This user is already on your roster',
        };
      }
    } else {
      const roster = await fetchTrainerRoster(inviterId);
      if (roster.some((r) => r.id === existingUserId)) {
        const enrolled = roster.find((r) => r.id === existingUserId);
        const already = programIds.every((pid) => enrolled?.programIds.includes(pid));
        if (already) {
          return {
            ok: false,
            code: 'ALREADY_ROSTER',
            message: 'This user is already enrolled in the selected programs',
          };
        }
      }
    }
  }

  const rawToken = generateRosterInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ROSTER_INVITE_EXPIRY_DAYS);

  const supabase = getSupabaseServer();
  const { data: inserted, error: insErr } = await supabase
    .from('roster_invitations')
    .insert({
      inviter_id: inviterId,
      inviter_role: dbInviterRole,
      kind,
      invitee_email: inviteeEmail,
      invitee_phone_e164: inviteePhoneE164,
      program_ids: programIds,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    })
    .select('id')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'A pending invite already exists for this email or phone',
      };
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[roster-invitations] insert', insErr);
    }
    return { ok: false, code: 'DB', message: 'Failed to create invitation' };
  }

  const studioSlug = await getStudioSlugForInviter(inviterId);
  return {
    ok: true,
    invitationId: inserted.id,
    inviteUrl: buildRosterInviteAcceptUrl(rawToken, studioSlug, input.publicAppBaseHint),
    rawToken,
  };
}

export async function listPendingInvitations(inviterId: string): Promise<PendingInvitationDto[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('roster_invitations')
    .select(
      'id, kind, invitee_email, invitee_phone_e164, program_ids, created_at, expires_at, status'
    )
    .eq('inviter_id', inviterId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.warn('[roster-invitations] listPending', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as 'friend' | 'client',
    channel: row.invitee_email ? 'email' : 'phone',
    inviteeEmail: row.invitee_email,
    inviteePhoneE164: row.invitee_phone_e164,
    programIds: Array.isArray(row.program_ids) ? row.program_ids : [],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export type RevokeRosterInvitationResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' | 'DB'; message: string };

/**
 * Mark a pending invitation revoked. Only the inviter may cancel.
 */
export async function revokeRosterInvitation(
  inviterId: string,
  invitationId: string
): Promise<RevokeRosterInvitationResult> {
  const supabase = getSupabaseServer();
  const { data: row, error: selErr } = await supabase
    .from('roster_invitations')
    .select('id, inviter_id, status')
    .eq('id', invitationId)
    .maybeSingle();

  if (selErr || !row) {
    return { ok: false, code: 'NOT_FOUND', message: 'Invitation not found' };
  }
  if (row.inviter_id !== inviterId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Invitation not found' };
  }
  if (row.status !== 'pending') {
    return { ok: false, code: 'CONFLICT', message: 'Only pending invitations can be cancelled' };
  }

  const { data: updated, error: updErr } = await supabase
    .from('roster_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('inviter_id', inviterId)
    .eq('status', 'pending')
    .select('id');

  if (updErr) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[roster-invitations] revoke', updErr);
    }
    return { ok: false, code: 'DB', message: 'Failed to cancel invitation' };
  }
  if (!updated?.length) {
    return { ok: false, code: 'CONFLICT', message: 'Only pending invitations can be cancelled' };
  }
  return { ok: true };
}

export type ResendRosterInvitationResult =
  | {
      ok: true;
      invitationId: string;
      inviteUrl: string;
      rawToken: string;
      inviteeEmail: string | null;
    }
  | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' | 'DB'; message: string };

/**
 * Rotate token and extend expiry for a pending invite. Old links stop working.
 */
export async function resendRosterInvitation(
  inviterId: string,
  invitationId: string,
  publicAppBaseHint?: string | null
): Promise<ResendRosterInvitationResult> {
  const supabase = getSupabaseServer();
  const { data: row, error: selErr } = await supabase
    .from('roster_invitations')
    .select('id, inviter_id, status, invitee_email')
    .eq('id', invitationId)
    .maybeSingle();

  if (selErr || !row) {
    return { ok: false, code: 'NOT_FOUND', message: 'Invitation not found' };
  }
  if (row.inviter_id !== inviterId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Invitation not found' };
  }
  if (row.status !== 'pending') {
    return { ok: false, code: 'CONFLICT', message: 'Only pending invitations can be resent' };
  }

  const rawToken = generateRosterInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ROSTER_INVITE_EXPIRY_DAYS);

  const { data: updated, error: updErr } = await supabase
    .from('roster_invitations')
    .update({
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .eq('id', invitationId)
    .eq('inviter_id', inviterId)
    .eq('status', 'pending')
    .select('id');

  if (updErr) {
    if (updErr.code === '23505') {
      return { ok: false, code: 'DB', message: 'Could not rotate invite token; try again' };
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[roster-invitations] resend', updErr);
    }
    return { ok: false, code: 'DB', message: 'Failed to resend invitation' };
  }
  if (!updated?.length) {
    return { ok: false, code: 'CONFLICT', message: 'Only pending invitations can be resent' };
  }

  const studioSlug = await getStudioSlugForInviter(inviterId);
  return {
    ok: true,
    invitationId: row.id,
    inviteUrl: buildRosterInviteAcceptUrl(rawToken, studioSlug, publicAppBaseHint),
    rawToken,
    inviteeEmail: row.invitee_email,
  };
}

export type AcceptRosterInviteResult =
  | { ok: true; kind: 'friend' | 'client'; assignedProgramIds?: string[] }
  | { ok: false; code: 'NOT_FOUND' | 'EXPIRED' | 'MISMATCH' | 'DB' | 'CONFLICT'; message: string };

function sessionMatchesInviteeContact(
  inv: { invitee_email: string | null; invitee_phone_e164: string | null },
  sessionEmails: string[],
  sessionPhone: string | null | undefined
): boolean {
  const targetEmail = inv.invitee_email;
  const emailMatch =
    !!targetEmail &&
    sessionEmails.some(
      (e) => e.trim() !== '' && normalizeInviteEmail(e) === normalizeInviteEmail(targetEmail)
    );
  const phoneMatch =
    inv.invitee_phone_e164 &&
    sessionPhone &&
    normalizeInvitePhoneE164(sessionPhone) === inv.invitee_phone_e164;
  return !!(emailMatch || phoneMatch);
}

/**
 * `roster_invitations.accepted_user_id` and `host_friend_connections` reference `public.profiles`.
 * If signup did not create a profile (missing auth trigger), finalize PATCH returns PostgREST 409 (FK violation).
 *
 * Requires service role: anon `getSupabaseServer()` has no JWT, so RLS on `profiles` blocks SELECT/INSERT
 * for the invitee and would falsely fail acceptance (or no-op select + failed insert).
 */
async function ensureInviteeProfileRow(
  userId: string,
  userClient?: SupabaseClient<Database>
): Promise<AcceptRosterInviteResult | null> {
  const canUseServiceRole = hasServiceRoleKey();
  const supabase = getSupabaseServer() as unknown as SupabaseClient<Database>;
  const profileClient = (canUseServiceRole ? supabase : userClient) as
    | SupabaseClient<Database>
    | undefined;
  if (!profileClient) {
    // Without service role and without a user JWT client, we cannot verify/create profiles under RLS.
    return { ok: false, code: 'DB', message: 'Server configuration error (missing service role)' };
  }

  const { data: existing, error: selErr } = await profileClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (selErr) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[roster-invitations] ensureInviteeProfileRow select', selErr);
    }
    // If service role is missing, this is likely an RLS denial. Let the invite accept proceed to
    // the FK-safe path below only when we have a user JWT client.
    if (!canUseServiceRole) {
      return { ok: false, code: 'DB', message: 'Sign-in session could not verify your profile' };
    }
    return { ok: false, code: 'DB', message: 'Failed to verify profile' };
  }
  if (existing) return null;

  let fullName: string | null = null;
  if (canUseServiceRole) {
    const { data: adminData, error: adminErr } = await supabase.auth.admin.getUserById(userId);
    if (
      adminErr &&
      (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true')
    ) {
      console.warn('[roster-invitations] ensureInviteeProfileRow getUserById', adminErr);
    }
    if (!adminErr && adminData?.user) {
      const meta = adminData.user.user_metadata as Record<string, unknown> | undefined;
      if (meta && typeof meta.full_name === 'string') fullName = meta.full_name;
      else if (meta && typeof meta.name === 'string') fullName = meta.name;
    }
  }

  type ProfilesInsert = Database['public']['Tables']['profiles']['Insert'];
  type ProfilesInsertError = { code?: string; message?: string } | null;
  type ProfilesClient = {
    from: (table: 'profiles') => {
      insert: (values: ProfilesInsert) => Promise<{ error: ProfilesInsertError }>;
    };
  };

  const { error: insErr } = await (profileClient as unknown as ProfilesClient)
    .from('profiles')
    .insert({
      id: userId,
      full_name: fullName ?? undefined,
      role: 'client',
    });
  if (!insErr) return null;
  if (insErr.code === '23505') return null;
  if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
    console.error('[roster-invitations] ensureInviteeProfileRow insert', insErr);
  }
  return { ok: false, code: 'DB', message: 'Failed to create profile for invitee' };
}

/** Shared finalize after invitee identity is verified (token path or session-email path). */
async function finalizeRosterInvitationAfterInviteeVerified(
  inv: {
    id: string;
    inviter_id: string;
    kind: string;
    program_ids: unknown;
  },
  sessionUserId: string,
  userClient?: SupabaseClient<Database>
): Promise<AcceptRosterInviteResult> {
  const pre = await ensureInviteeProfileRow(sessionUserId, userClient);
  if (pre) return pre;

  const supabase = getSupabaseServer();

  if (inv.kind === 'friend') {
    const { error: insErr } = await supabase.from('host_friend_connections').upsert(
      {
        host_id: inv.inviter_id,
        buddy_user_id: sessionUserId,
        invitation_id: inv.id,
      },
      { onConflict: 'host_id,buddy_user_id', ignoreDuplicates: true }
    );
    if (insErr && !isUniqueOrConflictInsertError(insErr)) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[roster-invitations] host_friend_connections', insErr);
      }
      return { ok: false, code: 'DB', message: 'Failed to accept invitation' };
    }
  } else {
    const programIds = Array.isArray(inv.program_ids) ? inv.program_ids : [];
    for (const programId of programIds) {
      const { error: upErr } = await supabase.from('user_programs').upsert(
        {
          user_id: sessionUserId,
          program_id: programId,
          status: 'active',
          source: 'trainer_assigned',
        },
        { onConflict: 'user_id,program_id', ignoreDuplicates: true }
      );
      if (upErr && !isUniqueOrConflictInsertError(upErr)) {
        if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
          console.error('[roster-invitations] user_programs', upErr);
        }
        return { ok: false, code: 'DB', message: 'Failed to enroll in program' };
      }
    }
  }

  const { data: updatedRows, error: updErr } = await supabase
    .from('roster_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_user_id: sessionUserId,
    })
    .eq('id', inv.id)
    .eq('status', 'pending')
    .select('id');

  if (updErr) {
    return { ok: false, code: 'DB', message: 'Failed to finalize invitation' };
  }

  if (updatedRows?.length) {
    const kind = inv.kind as 'friend' | 'client';
    if (kind === 'client') {
      const assignedProgramIds = Array.isArray(inv.program_ids)
        ? (inv.program_ids as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      return { ok: true, kind: 'client', assignedProgramIds };
    }
    return { ok: true, kind: 'friend' };
  }

  const { data: finalized } = await supabase
    .from('roster_invitations')
    .select('status, accepted_user_id, kind, program_ids')
    .eq('id', inv.id)
    .maybeSingle();

  if (finalized?.status === 'accepted' && finalized.accepted_user_id === sessionUserId) {
    const fk = finalized.kind as 'friend' | 'client';
    if (fk === 'client') {
      const assignedProgramIds = Array.isArray(finalized.program_ids)
        ? (finalized.program_ids as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      return { ok: true, kind: 'client', assignedProgramIds };
    }
    return { ok: true, kind: 'friend' };
  }

  return { ok: false, code: 'DB', message: 'Failed to finalize invitation' };
}

/**
 * When the user is signed in but the invite token was lost (OAuth/magic-link redirects),
 * complete any non-expired pending invitations whose invitee email/phone matches the session.
 */
export async function acceptPendingRosterInvitesForSession(
  sessionUserId: string,
  sessionEmails: string[],
  sessionPhone: string | null | undefined,
  userClient?: SupabaseClient<Database>
): Promise<{ acceptedCount: number; assignedProgramIds: string[] }> {
  const supabase = getSupabaseServer();
  const nowIso = new Date().toISOString();
  const normEmails = [
    ...new Set(sessionEmails.map((e) => normalizeInviteEmail(e)).filter((e) => e.length > 0)),
  ];
  const normPhone = sessionPhone ? normalizeInvitePhoneE164(sessionPhone) : null;

  type InvCandidate = {
    id: string;
    inviter_id: string;
    kind: string;
    program_ids: unknown;
    invitee_email: string | null;
    invitee_phone_e164: string | null;
    created_at: string;
  };

  const byId = new Map<string, InvCandidate>();

  if (normEmails.length > 0) {
    const { data, error } = await supabase
      .from('roster_invitations')
      .select('id, inviter_id, kind, program_ids, invitee_email, invitee_phone_e164, created_at')
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .in('invitee_email', normEmails);
    if (error && (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true')) {
      console.warn('[roster-invitations] acceptPending by email', error);
    }
    for (const row of data ?? []) {
      byId.set(row.id, row as InvCandidate);
    }
  }

  if (normPhone) {
    const { data, error } = await supabase
      .from('roster_invitations')
      .select('id, inviter_id, kind, program_ids, invitee_email, invitee_phone_e164, created_at')
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .eq('invitee_phone_e164', normPhone);
    if (error && (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true')) {
      console.warn('[roster-invitations] acceptPending by phone', error);
    }
    for (const row of data ?? []) {
      byId.set(row.id, row as InvCandidate);
    }
  }

  const candidates = [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let acceptedCount = 0;
  const mergedAssignedIds: string[] = [];
  for (const inv of candidates) {
    if (!sessionMatchesInviteeContact(inv, sessionEmails, sessionPhone)) continue;
    if (inv.kind === 'friend' && sessionUserId === inv.inviter_id) continue;
    const res = await finalizeRosterInvitationAfterInviteeVerified(
      {
        id: inv.id,
        inviter_id: inv.inviter_id,
        kind: inv.kind,
        program_ids: inv.program_ids,
      },
      sessionUserId,
      userClient
    );
    if (res.ok) {
      acceptedCount += 1;
      if (res.kind === 'client' && res.assignedProgramIds?.length) {
        for (const pid of res.assignedProgramIds) {
          if (!mergedAssignedIds.includes(pid)) mergedAssignedIds.push(pid);
        }
      }
    }
  }

  return { acceptedCount, assignedProgramIds: mergedAssignedIds };
}

/**
 * Accept an invite. Caller must be authenticated; email or phone must match the invitation.
 * Pass every email variant you trust (JWT, user_metadata, profiles) — some providers omit `user.email`.
 */
export async function acceptRosterInvite(
  rawToken: string,
  sessionUserId: string,
  sessionEmails: string[],
  sessionPhone: string | null | undefined,
  userClient?: SupabaseClient<Database>
): Promise<AcceptRosterInviteResult> {
  const tokenHash = hashToken(rawToken.trim());
  const supabase = getSupabaseServer();

  const { data: inv, error: selErr } = await supabase
    .from('roster_invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('status', 'pending')
    .maybeSingle();

  if (selErr) {
    return { ok: false, code: 'NOT_FOUND', message: 'Invalid or unknown invitation' };
  }

  if (!inv) {
    const { data: past } = await supabase
      .from('roster_invitations')
      .select('kind, status, accepted_user_id')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (past?.status === 'accepted' && past.accepted_user_id === sessionUserId) {
      return { ok: true, kind: past.kind as 'friend' | 'client' };
    }
    return { ok: false, code: 'NOT_FOUND', message: 'Invalid or unknown invitation' };
  }

  if (new Date(inv.expires_at).getTime() < Date.now()) {
    await supabase.from('roster_invitations').update({ status: 'expired' }).eq('id', inv.id);
    return { ok: false, code: 'EXPIRED', message: 'This invitation has expired' };
  }

  if (!sessionMatchesInviteeContact(inv, sessionEmails, sessionPhone)) {
    return {
      ok: false,
      code: 'MISMATCH',
      message: 'Sign in with the invited email or phone to accept',
    };
  }

  if (inv.kind === 'friend' && sessionUserId === inv.inviter_id) {
    return { ok: false, code: 'MISMATCH', message: 'You cannot accept your own invitation' };
  }

  return finalizeRosterInvitationAfterInviteeVerified(
    {
      id: inv.id,
      inviter_id: inv.inviter_id,
      kind: inv.kind as string,
      program_ids: inv.program_ids,
    },
    sessionUserId,
    userClient
  );
}

/**
 * Studio wins for visual brand when a studio row exists; welcome copy merges studio then trainer layers.
 */
export function buildEffectiveInviteStudioPreviewFromRow(
  row: Record<string, unknown>
): RosterInviteStudioPreview | null {
  const studioSlug = typeof row.studio_slug === 'string' ? row.studio_slug.trim() : '';
  const studioName =
    typeof row.studio_display_name === 'string' ? row.studio_display_name.trim() : '';
  const trainerSlug = typeof row.trainer_slug === 'string' ? row.trainer_slug.trim() : '';
  const trainerName =
    typeof row.trainer_display_name === 'string' ? row.trainer_display_name.trim() : '';

  const studioWelcome = parseStudioWelcomeContent(row.studio_welcome_content);
  const trainerWelcome = parseStudioWelcomeContent(row.trainer_welcome_content);
  const mergedWelcome = mergeWelcomeContentLayers(studioWelcome, trainerWelcome);
  const publicMergedWelcome = welcomeContentForPublicInvitePreview(mergedWelcome);

  if (studioSlug && studioName) {
    return {
      slug: studioSlug,
      displayName: studioName,
      logoUrl: typeof row.studio_logo_url === 'string' ? row.studio_logo_url.trim() || null : null,
      primaryColor:
        typeof row.studio_primary_color === 'string'
          ? row.studio_primary_color.trim() || null
          : null,
      tagline:
        typeof row.studio_welcome_tagline === 'string'
          ? row.studio_welcome_tagline.trim() || null
          : null,
      welcomeContent: publicMergedWelcome,
    };
  }

  if (trainerSlug && trainerName) {
    const tw = parseStudioWelcomeContent(row.trainer_welcome_content);
    return {
      slug: trainerSlug,
      displayName: trainerName,
      logoUrl:
        typeof row.trainer_logo_url === 'string' ? row.trainer_logo_url.trim() || null : null,
      primaryColor:
        typeof row.trainer_primary_color === 'string'
          ? row.trainer_primary_color.trim() || null
          : null,
      tagline:
        typeof row.trainer_welcome_tagline === 'string'
          ? row.trainer_welcome_tagline.trim() || null
          : null,
      welcomeContent: welcomeContentForPublicInvitePreview(tw),
    };
  }

  return null;
}

/** Inviter label for public invite landing when `full_name` is empty (email-only signups, etc.). */
function resolveInviterDisplayName(row: {
  full_name: string | null | undefined;
  username: string | null | undefined;
  email: string | null | undefined;
}): string | null {
  const n = row.full_name?.trim();
  if (n) return n;
  const u = row.username?.trim();
  if (u) return u;
  const e = row.email?.trim();
  if (e) {
    const local = e.split('@')[0]?.trim() ?? '';
    if (local) {
      const t = local
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (t) return t;
    }
  }
  return null;
}

function mapRosterInvitePreviewRow(row: Record<string, unknown>): RosterInvitePreview | null {
  const kindRaw = row.kind;
  // Unknown kind → friend so invitee contact is never prefilled (PR review: safer than defaulting to client).
  const kind: 'friend' | 'client' = kindRaw === 'client' ? 'client' : 'friend';

  const contactForPrefill = kind === 'client';

  const rpcLabel =
    typeof row.inviter_display_label === 'string' ? row.inviter_display_label.trim() || null : null;
  const inviterDisplayName =
    rpcLabel ??
    resolveInviterDisplayName({
      full_name: typeof row.full_name === 'string' ? row.full_name : null,
      username: typeof row.username === 'string' ? row.username : null,
      // RPC omits raw email; service-role fallback still selects profiles.email.
      email: typeof row.email === 'string' ? row.email : null,
    });

  const inviterAvatarUrl =
    typeof row.avatar_url === 'string' && row.avatar_url.trim() ? row.avatar_url.trim() : null;

  const studio = buildEffectiveInviteStudioPreviewFromRow(row);

  const ie = row.invitee_email;
  const ip = row.invitee_phone_e164;

  return {
    inviterDisplayName,
    inviterAvatarUrl,
    kind,
    studio,
    inviteeEmail: contactForPrefill ? (typeof ie === 'string' ? ie.trim() || null : null) : null,
    inviteePhoneE164: contactForPrefill
      ? typeof ip === 'string'
        ? ip.trim() || null
        : null
      : null,
  };
}

/**
 * Resolve inviter display info for a pending, unexpired invite. Unauthenticated; caller must not log raw tokens.
 *
 * Prefer DB RPC `get_roster_invite_preview_core`: anon API routes cannot read other users' profiles or
 * studios under RLS without the service role; the RPC runs as SECURITY DEFINER with scope limited to
 * a valid pending invite token hash.
 */
export async function getRosterInvitePreview(
  rawToken: string
): Promise<RosterInvitePreview | null> {
  const trimmed = rawToken.trim();
  if (!looksLikeRosterInviteToken(trimmed)) return null;

  const tokenHash = hashToken(trimmed);
  const supabase = getSupabaseServer();

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_roster_invite_preview_core', {
    p_token_hash: tokenHash,
  });

  if (!rpcError && rpcData != null && typeof rpcData === 'object' && !Array.isArray(rpcData)) {
    return mapRosterInvitePreviewRow(rpcData as Record<string, unknown>);
  }

  const nowIso = new Date().toISOString();

  const { data: inv, error } = await supabase
    .from('roster_invitations')
    .select('inviter_id, kind, invitee_email, invitee_phone_e164')
    .eq('token_hash', tokenHash)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (error || !inv) return null;

  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name, username, email, avatar_url, studio_id')
    .eq('id', inv.inviter_id)
    .maybeSingle();

  const { data: tr } = await supabase
    .from('trainers')
    .select(
      'slug, display_name, logo_url, primary_color, welcome_tagline, welcome_content, studio_id'
    )
    .eq('user_id', inv.inviter_id)
    .maybeSingle();

  const kind = inv.kind === 'friend' || inv.kind === 'client' ? inv.kind : 'client';

  const sid =
    (tr?.studio_id as string | null | undefined) ?? (prof?.studio_id as string | null | undefined);
  let st: {
    slug: unknown;
    display_name: unknown;
    logo_url?: string | null;
    primary_color?: string | null;
    welcome_tagline?: string | null;
    welcome_content?: unknown;
  } | null = null;
  if (sid) {
    const { data: studioRow } = await supabase
      .from('studios')
      .select('slug, display_name, logo_url, primary_color, welcome_tagline, welcome_content')
      .eq('id', sid)
      .maybeSingle();
    st = studioRow ?? null;
  }

  const previewRow: Record<string, unknown> = {
    studio_slug: st?.slug,
    studio_display_name: st?.display_name,
    studio_logo_url: st?.logo_url,
    studio_primary_color: st?.primary_color,
    studio_welcome_tagline: st?.welcome_tagline,
    studio_welcome_content: st?.welcome_content,
    trainer_slug: tr?.slug,
    trainer_display_name: tr?.display_name,
    trainer_logo_url: tr?.logo_url,
    trainer_primary_color: tr?.primary_color,
    trainer_welcome_tagline: tr?.welcome_tagline,
    trainer_welcome_content: tr?.welcome_content,
  };
  const studio = buildEffectiveInviteStudioPreviewFromRow(previewRow);

  const contactForPrefill = kind === 'client';

  return {
    inviterDisplayName: resolveInviterDisplayName({
      full_name: prof?.full_name ?? null,
      username: prof?.username ?? null,
      email: prof?.email ?? null,
    }),
    inviterAvatarUrl: prof?.avatar_url?.trim() || null,
    kind,
    studio,
    inviteeEmail: contactForPrefill ? inv.invitee_email?.trim() || null : null,
    inviteePhoneE164: contactForPrefill ? inv.invitee_phone_e164?.trim() || null : null,
  };
}

/** Validate raw token format before hashing (optional hardening). */
export function looksLikeRosterInviteToken(token: string): boolean {
  const t = token.trim();
  return t.length >= 32 && t.length <= 200;
}
