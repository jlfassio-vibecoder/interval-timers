/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P4: Weekly activity Kanban — boards + cards; program-roster gate (same as P3 messages).
 */

import {
  isScheduledDateInWeek as isScheduledDateInWeekPure,
  isLocalMondayDateOnly,
  isValidDateOnly,
  mondayOfWeekContainingLocal,
} from '@/lib/performance-lab/weekly-board-dates';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isProgramClientOfTrainer } from '@/lib/supabase/admin/trainer-roster';

export {
  isValidDateOnly,
  mondayOfWeekContainingLocal,
} from '@/lib/performance-lab/weekly-board-dates';

export type WeeklyCardStatus = 'planned' | 'done' | 'skipped';

export interface WeeklyActivityCardRow {
  id: string;
  boardId: string;
  scheduledDate: string;
  title: string;
  activityType: string;
  durationMinutes: number | null;
  notes: string | null;
  status: WeeklyCardStatus;
  sourceAssignmentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyActivityBoardPayload {
  boardId: string;
  weekStartDate: string;
  cards: WeeklyActivityCardRow[];
}

export type GetWeeklyBoardResult =
  | { ok: true; payload: WeeklyActivityBoardPayload }
  | {
      ok: false;
      reason: 'invalid_date' | 'not_in_program_roster' | 'database_error';
      message?: string;
      code?: string;
    };

function isScheduledDateInWeek(scheduledDate: string, weekStartMonday: string): boolean {
  return isScheduledDateInWeekPure(scheduledDate, weekStartMonday);
}

async function assertProgramClient(trainerUserId: string, clientUserId: string): Promise<boolean> {
  return isProgramClientOfTrainer(trainerUserId, clientUserId);
}

export async function getWeeklyBoardForTrainer(
  trainerUserId: string,
  clientUserId: string,
  weekStartDate: string
): Promise<GetWeeklyBoardResult> {
  if (!isLocalMondayDateOnly(weekStartDate)) {
    return { ok: false, reason: 'invalid_date' };
  }
  const allowed = await assertProgramClient(trainerUserId, clientUserId);
  if (!allowed) {
    return { ok: false, reason: 'not_in_program_roster' };
  }

  const supabase = getSupabaseServer();
  // Use .limit(1) instead of .maybeSingle(): PostgREST + maybeSingle() errors (PGRST116) when
  // more than one row is returned; duplicates should not happen but must not break the Lab UI.
  const { data: boardRows, error: bErr } = await supabase
    .from('client_weekly_activity_boards')
    .select('id, week_start_date')
    .eq('trainer_user_id', trainerUserId)
    .eq('client_user_id', clientUserId)
    .eq('week_start_date', weekStartDate.trim())
    .limit(1);

  if (bErr) {
    if (import.meta.env.DEV) console.warn('[weekly-board] fetch board', bErr);
    return {
      ok: false,
      reason: 'database_error',
      message: bErr.message,
      code:
        typeof (bErr as { code?: string }).code === 'string'
          ? (bErr as { code: string }).code
          : undefined,
    };
  }

  const board = boardRows?.[0];
  if (!board) {
    return {
      ok: true,
      payload: { boardId: '', weekStartDate: weekStartDate.trim(), cards: [] },
    };
  }

  const boardId = (board as { id: string }).id;
  const { data: cards, error: cErr } = await supabase
    .from('client_weekly_activity_cards')
    .select(
      'id, board_id, scheduled_date, title, activity_type, duration_minutes, notes, status, source_assignment_id, sort_order, created_at, updated_at'
    )
    .eq('board_id', boardId)
    .order('scheduled_date', { ascending: true })
    .order('sort_order', { ascending: true });

  if (cErr) {
    if (import.meta.env.DEV) console.warn('[weekly-board] fetch cards', cErr);
    return {
      ok: true,
      payload: { boardId, weekStartDate: weekStartDate.trim(), cards: [] },
    };
  }

  const rows = (cards ?? []) as Record<string, unknown>[];
  return {
    ok: true,
    payload: {
      boardId,
      weekStartDate: weekStartDate.trim(),
      cards: rows.map(mapCardRow),
    },
  };
}

function mapCardRow(row: Record<string, unknown>): WeeklyActivityCardRow {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    scheduledDate: String(row.scheduled_date),
    title: typeof row.title === 'string' ? row.title : '',
    activityType: typeof row.activity_type === 'string' ? row.activity_type : 'activity',
    durationMinutes:
      typeof row.duration_minutes === 'number' && Number.isFinite(row.duration_minutes)
        ? row.duration_minutes
        : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    status: (row.status as WeeklyCardStatus) || 'planned',
    sourceAssignmentId:
      typeof row.source_assignment_id === 'string' ? row.source_assignment_id : null,
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

async function ensureBoard(
  supabase: ReturnType<typeof getSupabaseServer>,
  trainerUserId: string,
  clientUserId: string,
  weekStartDate: string
): Promise<{ ok: true; boardId: string } | { ok: false; error: string }> {
  const ws = weekStartDate.trim();
  if (!isLocalMondayDateOnly(ws)) {
    return { ok: false, error: 'weekStartDate must be a Monday (YYYY-MM-DD)' };
  }
  const { data: existingRows, error: findErr } = await supabase
    .from('client_weekly_activity_boards')
    .select('id')
    .eq('trainer_user_id', trainerUserId)
    .eq('client_user_id', clientUserId)
    .eq('week_start_date', ws)
    .limit(1);

  if (findErr) {
    if (import.meta.env.DEV) console.warn('[weekly-board] ensureBoard find', findErr);
    return { ok: false, error: 'Failed to load board' };
  }

  const existing = existingRows?.[0];
  if (existing?.id) return { ok: true, boardId: existing.id as string };

  const { data: inserted, error } = await supabase
    .from('client_weekly_activity_boards')
    .insert({
      trainer_user_id: trainerUserId,
      client_user_id: clientUserId,
      week_start_date: ws,
    })
    .select('id')
    .single();

  if (error || !inserted?.id) {
    if (import.meta.env.DEV) console.warn('[weekly-board] insert board', error);
    return { ok: false, error: 'Failed to create board' };
  }
  return { ok: true, boardId: inserted.id as string };
}

export async function createWeeklyActivityCard(params: {
  trainerUserId: string;
  clientUserId: string;
  weekStartDate: string;
  scheduledDate: string;
  title: string;
  activityType?: string;
  durationMinutes?: number | null;
  notes?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const {
    trainerUserId,
    clientUserId,
    weekStartDate,
    scheduledDate,
    title,
    activityType = 'activity',
    durationMinutes,
    notes,
  } = params;

  if (!isValidDateOnly(weekStartDate) || !isValidDateOnly(scheduledDate)) {
    return { ok: false, error: 'Invalid date' };
  }
  if (!isLocalMondayDateOnly(weekStartDate.trim())) {
    return { ok: false, error: 'weekStartDate must be a Monday (YYYY-MM-DD)' };
  }
  if (!isScheduledDateInWeek(scheduledDate, weekStartDate.trim())) {
    return { ok: false, error: 'scheduledDate must fall in the board week' };
  }
  const t = title.trim();
  if (!t) return { ok: false, error: 'Title required' };
  if (t.length > 500) return { ok: false, error: 'Title too long' };

  const allowed = await assertProgramClient(trainerUserId, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your program roster' };

  const supabase = getSupabaseServer();
  const board = await ensureBoard(supabase, trainerUserId, clientUserId, weekStartDate.trim());
  if (!board.ok) return board;

  const { data: maxRow } = await supabase
    .from('client_weekly_activity_cards')
    .select('sort_order')
    .eq('board_id', board.boardId)
    .eq('scheduled_date', scheduledDate)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder =
    maxRow && typeof (maxRow as { sort_order?: number }).sort_order === 'number'
      ? (maxRow as { sort_order: number }).sort_order + 1
      : 0;

  const { data: ins, error } = await supabase
    .from('client_weekly_activity_cards')
    .insert({
      board_id: board.boardId,
      scheduled_date: scheduledDate,
      title: t,
      activity_type: activityType.trim() || 'activity',
      duration_minutes:
        durationMinutes != null && Number.isFinite(durationMinutes)
          ? Math.max(0, Math.floor(durationMinutes))
          : null,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      status: 'planned',
      sort_order: nextOrder,
    })
    .select('id')
    .single();

  if (error || !ins?.id) {
    if (import.meta.env.DEV) console.warn('[weekly-board] insert card', error);
    return { ok: false, error: 'Failed to create card' };
  }
  await supabase
    .from('client_weekly_activity_boards')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', board.boardId);

  return { ok: true, id: ins.id as string };
}

export async function updateWeeklyActivityCard(params: {
  trainerUserId: string;
  clientUserId: string;
  cardId: string;
  title?: string;
  scheduledDate?: string;
  activityType?: string;
  durationMinutes?: number | null;
  notes?: string | null;
  status?: WeeklyCardStatus;
  sortOrder?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { trainerUserId, clientUserId, cardId } = params;
  const supabase = getSupabaseServer();

  const { data: card, error: fErr } = await supabase
    .from('client_weekly_activity_cards')
    .select('id, board_id, scheduled_date')
    .eq('id', cardId)
    .maybeSingle();

  if (fErr || !card) return { ok: false, error: 'Card not found' };

  const { data: board, error: bErr } = await supabase
    .from('client_weekly_activity_boards')
    .select('id, trainer_user_id, client_user_id, week_start_date')
    .eq('id', (card as { board_id: string }).board_id)
    .maybeSingle();

  if (bErr || !board) return { ok: false, error: 'Card not found' };
  const b = board as {
    id: string;
    trainer_user_id: string;
    client_user_id: string;
    week_start_date: string;
  };
  if (b.trainer_user_id !== trainerUserId || b.client_user_id !== clientUserId) {
    return { ok: false, error: 'Card not found' };
  }

  const weekStart = String(b.week_start_date);
  const nextScheduled = params.scheduledDate?.trim();
  const oldBoardId = b.id;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.title !== undefined) {
    const t = params.title.trim();
    if (!t) return { ok: false, error: 'Title required' };
    if (t.length > 500) return { ok: false, error: 'Title too long' };
    patch.title = t;
  }

  if (nextScheduled) {
    if (!isValidDateOnly(nextScheduled)) {
      return { ok: false, error: 'Invalid date' };
    }
    const targetMonday = mondayOfWeekContainingLocal(new Date(nextScheduled + 'T12:00:00'));
    if (!isScheduledDateInWeek(nextScheduled, targetMonday)) {
      return { ok: false, error: 'scheduledDate must fall in the board week' };
    }
    if (targetMonday !== weekStart) {
      const ensured = await ensureBoard(supabase, trainerUserId, clientUserId, targetMonday);
      if (!ensured.ok) return { ok: false, error: ensured.error };
      patch.board_id = ensured.boardId;
    } else if (!isScheduledDateInWeek(nextScheduled, weekStart)) {
      return { ok: false, error: 'scheduledDate must fall in the board week' };
    }
    patch.scheduled_date = nextScheduled;
  }
  if (params.activityType !== undefined)
    patch.activity_type = params.activityType.trim() || 'activity';
  if (params.durationMinutes !== undefined) {
    patch.duration_minutes =
      params.durationMinutes != null && Number.isFinite(params.durationMinutes)
        ? Math.max(0, Math.floor(params.durationMinutes))
        : null;
  }
  if (params.notes !== undefined) {
    patch.notes =
      typeof params.notes === 'string' && params.notes.trim() ? params.notes.trim() : null;
  }
  if (params.status !== undefined) {
    if (!['planned', 'done', 'skipped'].includes(params.status)) {
      return { ok: false, error: 'Invalid status' };
    }
    patch.status = params.status;
  }
  if (params.sortOrder !== undefined && Number.isFinite(params.sortOrder)) {
    patch.sort_order = Math.floor(params.sortOrder);
  }

  const { error: uErr } = await supabase
    .from('client_weekly_activity_cards')
    .update(patch)
    .eq('id', cardId);

  if (uErr) {
    if (import.meta.env.DEV) console.warn('[weekly-board] update card', uErr);
    return { ok: false, error: 'Failed to update card' };
  }

  const newBoardId = typeof patch.board_id === 'string' ? patch.board_id : oldBoardId;
  await supabase
    .from('client_weekly_activity_boards')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', newBoardId);
  if (newBoardId !== oldBoardId) {
    await supabase
      .from('client_weekly_activity_boards')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', oldBoardId);
  }
  return { ok: true };
}

export async function deleteWeeklyActivityCard(
  trainerUserId: string,
  clientUserId: string,
  cardId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { data: card } = await supabase
    .from('client_weekly_activity_cards')
    .select('id, board_id')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: 'Card not found' };

  const { data: board } = await supabase
    .from('client_weekly_activity_boards')
    .select('id, trainer_user_id, client_user_id')
    .eq('id', (card as { board_id: string }).board_id)
    .maybeSingle();
  if (!board) return { ok: false, error: 'Card not found' };
  const b = board as { id: string; trainer_user_id: string; client_user_id: string };
  if (b.trainer_user_id !== trainerUserId || b.client_user_id !== clientUserId) {
    return { ok: false, error: 'Card not found' };
  }

  const { error } = await supabase.from('client_weekly_activity_cards').delete().eq('id', cardId);
  if (error) {
    if (import.meta.env.DEV) console.warn('[weekly-board] delete card', error);
    return { ok: false, error: 'Failed to delete card' };
  }
  await supabase
    .from('client_weekly_activity_boards')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', b.id);
  return { ok: true };
}

/** Client read: same program-roster gate as coach messages. */
export async function getWeeklyBoardForClient(
  clientUserId: string,
  trainerUserId: string,
  weekStartDate: string
): Promise<GetWeeklyBoardResult> {
  return getWeeklyBoardForTrainer(trainerUserId, clientUserId, weekStartDate);
}

export async function updateWeeklyActivityCardForClient(params: {
  clientUserId: string;
  cardId: string;
  status: WeeklyCardStatus;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { clientUserId, cardId, status } = params;
  if (!['planned', 'done', 'skipped'].includes(status)) {
    return { ok: false, error: 'Invalid status' };
  }

  const supabase = getSupabaseServer();
  const { data: card } = await supabase
    .from('client_weekly_activity_cards')
    .select('id, board_id')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: 'Card not found' };

  const { data: board } = await supabase
    .from('client_weekly_activity_boards')
    .select('client_user_id')
    .eq('id', (card as { board_id: string }).board_id)
    .maybeSingle();
  if (!board || (board as { client_user_id: string }).client_user_id !== clientUserId) {
    return { ok: false, error: 'Card not found' };
  }

  const { error } = await supabase
    .from('client_weekly_activity_cards')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', cardId);

  if (error) {
    if (import.meta.env.DEV) console.warn('[weekly-board] client update', error);
    return { ok: false, error: 'Failed to update' };
  }
  return { ok: true };
}
