/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P3: Trainer–client message board (program roster dyad; service-role writes).
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { isProgramClientOfTrainer } from '@/lib/supabase/admin/trainer-roster';

export const MAX_TRAINER_CLIENT_MESSAGE_BODY = 8000;
export const DEFAULT_TRAINER_CLIENT_MESSAGE_PAGE_SIZE = 50;
export const MAX_TRAINER_CLIENT_MESSAGE_PAGE_SIZE = 50;

export interface TrainerClientMessageRow {
  id: string;
  trainer_user_id: string;
  client_user_id: string;
  author_user_id: string;
  author_role: 'trainer' | 'client';
  body: string;
  created_at: string;
}

/** Offset cursor (base64url JSON). Offset pagination keeps MVP simple vs composite keyset on timestamptz. */
export function encodeTrainerClientMessagesCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url');
}

export function decodeTrainerClientMessagesCursor(
  s: string
): { ok: true; offset: number } | { ok: false } {
  try {
    const j = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { o?: unknown };
    if (typeof j.o !== 'number' || !Number.isFinite(j.o) || j.o < 0 || j.o > 1_000_000) {
      return { ok: false };
    }
    return { ok: true, offset: Math.floor(j.o) };
  } catch {
    return { ok: false };
  }
}

function clampPageSize(n: number | undefined): number {
  const x = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : DEFAULT_TRAINER_CLIENT_MESSAGE_PAGE_SIZE;
  return Math.min(Math.max(x, 1), MAX_TRAINER_CLIENT_MESSAGE_PAGE_SIZE);
}

export async function listTrainerClientMessages(
  trainerUserId: string,
  clientUserId: string,
  options?: { limit?: number; cursor?: string | null }
): Promise<
  | { ok: true; messages: TrainerClientMessageRow[]; nextCursor: string | null }
  | { ok: false; error: string }
> {
  const allowed = await isProgramClientOfTrainer(trainerUserId, clientUserId);
  if (!allowed) return { ok: false, error: 'Not allowed' };

  let offset = 0;
  if (options?.cursor) {
    const dec = decodeTrainerClientMessagesCursor(options.cursor.trim());
    if (!dec.ok) return { ok: false, error: 'Invalid cursor' };
    offset = dec.offset;
  }
  const pageSize = clampPageSize(options?.limit);
  const fetchEnd = offset + pageSize; // inclusive range → pageSize + 1 rows

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('trainer_client_messages')
    .select('id, trainer_user_id, client_user_id, author_user_id, author_role, body, created_at')
    .eq('trainer_user_id', trainerUserId)
    .eq('client_user_id', clientUserId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, fetchEnd);

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-messages] list', error);
    return { ok: false, error: 'Failed to load messages' };
  }

  const rows = (data ?? []) as TrainerClientMessageRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const chronological = [...page].reverse();
  const nextCursor = hasMore ? encodeTrainerClientMessagesCursor(offset + pageSize) : null;

  return { ok: true, messages: chronological, nextCursor };
}

export async function createTrainerClientMessage(params: {
  trainerUserId: string;
  clientUserId: string;
  authorUserId: string;
  body: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmed = params.body.trim();
  if (!trimmed) return { ok: false, error: 'Message body required' };
  if (trimmed.length > MAX_TRAINER_CLIENT_MESSAGE_BODY) {
    return { ok: false, error: `Message must be at most ${MAX_TRAINER_CLIENT_MESSAGE_BODY} characters` };
  }

  const allowed = await isProgramClientOfTrainer(params.trainerUserId, params.clientUserId);
  if (!allowed) return { ok: false, error: 'Not allowed' };

  let author_role: 'trainer' | 'client';
  if (params.authorUserId === params.trainerUserId) {
    author_role = 'trainer';
  } else if (params.authorUserId === params.clientUserId) {
    author_role = 'client';
  } else {
    return { ok: false, error: 'Invalid author' };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('trainer_client_messages')
    .insert({
      trainer_user_id: params.trainerUserId,
      client_user_id: params.clientUserId,
      author_user_id: params.authorUserId,
      author_role,
      body: trimmed,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    if (import.meta.env.DEV) console.warn('[trainer-client-messages] create', error);
    return { ok: false, error: 'Failed to send message' };
  }

  return { ok: true, id: data.id as string };
}
