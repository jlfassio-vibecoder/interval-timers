/**
 * Modal to schedule a pasted workout: pick date/time, POST handoff, open main app to confirm.
 */

import { useState } from 'react';
import CreateFlowSchedulePicker from '@interval-timers/schedule-picker';
import type { WorkoutSetTemplate } from '@/types/workoutSetTemplate';
import { getApiBase, getMainAppOrigin } from '@/lib/mainAppConfig';
import { trackHubFunnelEvent } from '@/lib/hubAnalytics';
import { openMainAppHandoff } from '@/lib/openMainAppHandoff';
import HandoffFollowThroughBanner from './HandoffFollowThroughBanner';

export interface SchedulePastedWorkoutModalProps {
  workoutSet: WorkoutSetTemplate;
  onClose: () => void;
}

type AfterHandoff = { url: string; popupBlocked: boolean };

export default function SchedulePastedWorkoutModal({ workoutSet, onClose }: SchedulePastedWorkoutModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [afterHandoff, setAfterHandoff] = useState<AfterHandoff | null>(null);

  const appBase = getMainAppOrigin();
  const apiBase = getApiBase();

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setError(null);
    setSubmitting(true);
    const url = apiBase ? `${apiBase}/api/schedule-workout-handoff` : '/api/schedule-workout-handoff';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutSet,
          scheduledAt: new Date(value).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Handoff failed');
      }
      const handoffId = data.handoffId;
      if (!handoffId) throw new Error('No handoff ID returned');
      trackHubFunnelEvent('hub_handoff_post_ok', { kind: 'schedule' });
      const target = `${appBase}/workout/schedule-pasted?hid=${encodeURIComponent(handoffId)}`;
      const { opened, url: handoffUrl } = openMainAppHandoff(target);
      setAfterHandoff({ url: handoffUrl, popupBlocked: !opened });
    } catch (err) {
      trackHubFunnelEvent('hub_handoff_post_fail', { kind: 'schedule' });
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/20 bg-black/90 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {afterHandoff ? (
          <>
            <h2 className="mb-4 text-lg font-bold text-white">Next step</h2>
            <HandoffFollowThroughBanner
              kind="schedule"
              url={afterHandoff.url}
              popupBlocked={afterHandoff.popupBlocked}
              autoDismiss={false}
              onDismiss={onClose}
            />
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl border border-white/20 px-4 py-3 font-bold text-white/80 transition-colors hover:bg-white/10"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-bold text-white">Schedule Workout</h2>
            <CreateFlowSchedulePicker
              value={value}
              onChange={setValue}
              minDate={new Date()}
              maxWeeksAhead={52}
              description="Pick when to schedule this workout. The main app will confirm and add it to your calendar."
            />
            {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/20 px-4 py-3 font-bold text-white/80 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim() || submitting}
                className="flex-1 rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
