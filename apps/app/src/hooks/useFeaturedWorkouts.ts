import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';
import type { FeaturedWorkoutContext } from '@/lib/trainer-live/featured-workout-context';
import type { Database } from '@/types/supabase';

type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

/** Workout fields loaded for featured rows (embed + hydration use the same shape). */
export type TrainerFeaturedWorkoutPayload = Pick<
  WorkoutRow,
  'id' | 'title' | 'blocks' | 'duration_minutes' | 'source' | 'trainer_id'
>;

export type TrainerFeaturedLiveWorkoutRow = {
  id: string;
  trainer_user_id: string;
  workout_id: string;
  sort_order: number;
  context: FeaturedWorkoutContext;
  created_at: string;
  workouts: TrainerFeaturedWorkoutPayload | null;
};

export type UpdateFeaturedWorkoutsParams = {
  p_context: FeaturedWorkoutContext;
  p_workout_ids: string[];
  /** Defaults to the signed-in user; must equal `auth.uid()` for the RPC. */
  p_trainer_id?: string;
};

function extractSupabaseErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [e.message, e.details, e.hint]
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim());
    if (parts.length > 0) return parts.join(' - ');
  }
  return 'Could not update featured workouts';
}

function normalizeWorkoutJoin(raw: unknown): TrainerFeaturedWorkoutPayload | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return (raw[0] as TrainerFeaturedWorkoutPayload | undefined) ?? null;
  return raw as TrainerFeaturedWorkoutPayload;
}

/**
 * Loads featured workout rows for the signed-in trainer and context, with embedded `workouts(*)`.
 * Pass `enabled: false` to skip network (e.g. Live pickers when the modal is closed).
 */
export function useFeaturedWorkoutsQuery(
  context: FeaturedWorkoutContext,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;

  const [rows, setRows] = useState<TrainerFeaturedLiveWorkoutRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!enabled) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setError(null);
      return;
    }

    const { data, error: qErr } = await supabase
      .from('trainer_featured_live_workouts')
      .select('id, trainer_user_id, workout_id, sort_order, context, created_at, workouts(*)')
      .eq('context', context)
      .order('sort_order', { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setRows([]);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    const baseRows: TrainerFeaturedLiveWorkoutRow[] = list.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        trainer_user_id: String(r.trainer_user_id),
        workout_id: String(r.workout_id),
        sort_order: Number(r.sort_order),
        context: r.context as FeaturedWorkoutContext,
        created_at: String(r.created_at),
        workouts: normalizeWorkoutJoin(r.workouts),
      };
    });

    // Embed often comes back null (PostgREST relationship / RLS on nested select). Hydrate by id.
    const missingIds = [
      ...new Set(baseRows.filter((row) => row.workouts == null).map((row) => row.workout_id)),
    ];
    let workoutById = new Map<string, TrainerFeaturedWorkoutPayload>();
    if (missingIds.length > 0) {
      const { data: wRows, error: wErr } = await supabase
        .from('workouts')
        .select('id, title, blocks, duration_minutes, source, trainer_id')
        .in('id', missingIds)
        .eq('trainer_id', user.id);
      if (!wErr && wRows) {
        workoutById = new Map(wRows.map((w) => [w.id, w]));
      }
    }

    setError(null);
    setRows(
      baseRows.map((row) => ({
        ...row,
        workouts: row.workouts ?? workoutById.get(row.workout_id) ?? null,
      }))
    );
  }, [context, enabled]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      await fetchRows();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRows, enabled]);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      await fetchRows();
    } finally {
      setLoading(false);
    }
  }, [fetchRows, enabled]);

  return { rows, loading, error, refetch };
}

/**
 * Atomic replace for one context via `update_featured_workouts` RPC.
 * Call `refetch` from `useFeaturedWorkoutsQuery` in `onSuccess` (see ref pattern below).
 */
export function useUpdateFeaturedWorkoutsMutation(options?: {
  onSuccess?: () => void | Promise<void>;
}) {
  const onSuccessRef = useRef(options?.onSuccess);
  onSuccessRef.current = options?.onSuccess;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutateAsync = useCallback(async (params: UpdateFeaturedWorkoutsParams) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const msg = 'Not signed in';
      setError(msg);
      throw new Error(msg);
    }
    const trainerId = params.p_trainer_id ?? user.id;
    if (trainerId !== user.id) {
      const msg = 'Trainer mismatch';
      setError(msg);
      throw new Error(msg);
    }

    setPending(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('update_featured_workouts', {
        p_trainer_id: trainerId,
        p_context: params.p_context,
        p_workout_ids: params.p_workout_ids,
      });
      if (rpcError) throw rpcError;
      await onSuccessRef.current?.();
    } catch (e) {
      const msg = extractSupabaseErrorMessage(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setPending(false);
    }
  }, []);

  return { mutateAsync, pending, error };
}
