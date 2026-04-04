import { supabase } from '@/lib/supabase/supabase-instance';
import type { TrainerLiveActivitySegmentRow } from '@/lib/trainer-live/activity-types';

/** Load segment timeline for a finalized activity session (RLS: trainer or participant). */
export async function fetchTrainerLiveActivitySegments(
  activitySessionId: string
): Promise<TrainerLiveActivitySegmentRow[]> {
  const { data, error } = await supabase
    .from('trainer_live_activity_segments')
    .select(
      'id, ordinal, segment_type, label, started_at, ended_at, amrap_session_id, tabata_session_id'
    )
    .eq('activity_session_id', activitySessionId)
    .order('ordinal', { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  return rows.map((r) => ({
    ...r,
    tabata_session_id: r.tabata_session_id ?? null,
  })) as TrainerLiveActivitySegmentRow[];
}
