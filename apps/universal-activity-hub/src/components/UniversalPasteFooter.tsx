/**
 * Footer actions: Schedule, Log Past, Open Workout, Save Workout.
 * Open Workout and Save Workout share the same handoff flow (workout-handoff → log-pasted).
 */

import { useEffect, useState } from 'react';
import type { WorkoutSetTemplate } from '@/types/workoutSetTemplate';
import { getApiBase, getMainAppOrigin } from '@/lib/mainAppConfig';
import { trackHubFunnelEvent } from '@/lib/hubAnalytics';
import { openMainAppHandoff } from '@/lib/openMainAppHandoff';
import HandoffFollowThroughBanner, {
  type HandoffFollowThroughKind,
} from './HandoffFollowThroughBanner';
import SchedulePastedWorkoutModal from './SchedulePastedWorkoutModal';

const btnClass =
  'flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

const primaryClass =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-600/40 to-orange-600/30 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-amber-50 transition-colors hover:from-amber-600/55 hover:to-orange-600/45 disabled:cursor-not-allowed disabled:opacity-40';

function hasExercises(workoutSet: WorkoutSetTemplate): boolean {
  return workoutSet.workouts?.some((w) => {
    if (w.exerciseBlocks?.length) {
      return w.exerciseBlocks.some((b) => (b.exercises?.length ?? 0) > 0);
    }
    return (w.blocks?.length ?? 0) > 0;
  });
}

export interface UniversalPasteFooterProps {
  workoutSet: WorkoutSetTemplate | null;
}

type FollowThroughState = {
  kind: HandoffFollowThroughKind;
  url: string;
  popupBlocked: boolean;
};

export default function UniversalPasteFooter({ workoutSet }: UniversalPasteFooterProps) {
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [followThrough, setFollowThrough] = useState<FollowThroughState | null>(null);

  useEffect(() => {
    setFollowThrough(null);
  }, [workoutSet]);

  if (!workoutSet) return null;

  const hasPayload = Boolean(workoutSet.title?.trim()) || hasExercises(workoutSet);
  const disabled = !hasPayload;

  const appBase = getMainAppOrigin();
  const apiBase = getApiBase();

  const postWorkoutHandoff = async (): Promise<string | null> => {
    const url = apiBase ? `${apiBase}/api/workout-handoff` : '/api/workout-handoff';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutSet }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Handoff failed');
    }
    const handoffId = data.handoffId;
    if (!handoffId) throw new Error('No handoff ID returned');
    return handoffId;
  };

  const handleOpenWorkout = async () => {
    setHandoffError(null);
    trackHubFunnelEvent('hub_action_click', { action: 'open_workout' });
    try {
      const handoffId = await postWorkoutHandoff();
      if (!handoffId) return;
      trackHubFunnelEvent('hub_handoff_post_ok', { kind: 'workout' });
      const target = `${appBase}/workout/log-pasted?hid=${encodeURIComponent(handoffId)}`;
      const { opened, url } = openMainAppHandoff(target);
      setFollowThrough({ kind: 'open', url, popupBlocked: !opened });
    } catch (err) {
      trackHubFunnelEvent('hub_handoff_post_fail', { kind: 'workout' });
      setHandoffError(err instanceof Error ? err.message : 'Failed to open workout');
    }
  };

  const handleSaveWorkout = async () => {
    setHandoffError(null);
    trackHubFunnelEvent('hub_action_click', { action: 'save_workout' });
    try {
      const handoffId = await postWorkoutHandoff();
      if (!handoffId) return;
      trackHubFunnelEvent('hub_handoff_post_ok', { kind: 'workout' });
      const target = `${appBase}/workout/save-pasted?hid=${encodeURIComponent(handoffId)}`;
      const { opened, url } = openMainAppHandoff(target);
      setFollowThrough({ kind: 'save', url, popupBlocked: !opened });
    } catch (err) {
      trackHubFunnelEvent('hub_handoff_post_fail', { kind: 'workout' });
      setHandoffError(err instanceof Error ? err.message : 'Failed to save workout');
    }
  };

  const handleLogPast = async () => {
    setHandoffError(null);
    trackHubFunnelEvent('hub_action_click', { action: 'log_past' });
    const url = apiBase ? `${apiBase}/api/quick-log-workout-handoff` : '/api/quick-log-workout-handoff';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutSet }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Handoff failed');
      }
      const handoffId = data.handoffId;
      if (!handoffId) throw new Error('No handoff ID returned');
      trackHubFunnelEvent('hub_handoff_post_ok', { kind: 'quick_log' });
      const target = `${appBase}/workout/log-past-summary?hid=${encodeURIComponent(handoffId)}`;
      const { opened, url: handoffUrl } = openMainAppHandoff(target);
      setFollowThrough({ kind: 'logPast', url: handoffUrl, popupBlocked: !opened });
    } catch (err) {
      trackHubFunnelEvent('hub_handoff_post_fail', { kind: 'quick_log' });
      setHandoffError(err instanceof Error ? err.message : 'Failed to open log form');
    }
  };

  return (
    <footer className="mt-8 space-y-3 border-t border-white/10 pt-6">
      {followThrough && (
        <HandoffFollowThroughBanner
          kind={followThrough.kind}
          url={followThrough.url}
          popupBlocked={followThrough.popupBlocked}
          onDismiss={() => setFollowThrough(null)}
        />
      )}
      {handoffError && (
        <p className="text-center text-sm text-red-300">{handoffError}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={btnClass}
          disabled={disabled}
          onClick={() => {
            trackHubFunnelEvent('hub_action_click', { action: 'schedule' });
            setScheduleModalOpen(true);
          }}
        >
          Schedule
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={disabled}
          onClick={handleLogPast}
        >
          Log Past
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={disabled}
          onClick={handleOpenWorkout}
        >
          Open Workout
        </button>
      </div>
      <button
        type="button"
        className={primaryClass}
        disabled={disabled}
        onClick={handleSaveWorkout}
      >
        Save Workout
      </button>
      {scheduleModalOpen && (
        <SchedulePastedWorkoutModal
          workoutSet={workoutSet}
          onClose={() => setScheduleModalOpen(false)}
        />
      )}
    </footer>
  );
}
