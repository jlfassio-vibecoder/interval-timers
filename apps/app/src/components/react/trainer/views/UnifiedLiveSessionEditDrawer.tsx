/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Edit runtime trainer live session from unified calendar (P1).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UnifiedLiveSessionCalendarItem } from '@/lib/supabase/admin/trainer-unified-calendar';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';

type Props = {
  open: boolean;
  event: UnifiedLiveSessionCalendarItem | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function UnifiedLiveSessionEditDrawer({ open, event, onClose, onSaved }: Props) {
  const [shell, setShell] = useState<'video_only' | 'countdown_timer'>('video_only');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !event) return;
    const sh = event.shell === 'countdown_timer' ? 'countdown_timer' : 'video_only';
    setShell(sh);
    setErr(null);
  }, [open, event]);

  const patchSession = useCallback(
    async (body: Record<string, unknown>) => {
      if (!event) return;
      setBusy(true);
      setErr(null);
      try {
        const auth = await missionControlApiAuthHeaders();
        const res = await fetch(
          `/api/trainer/live-sessions/${encodeURIComponent(event.sessionId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        );
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setErr(typeof j.error === 'string' ? j.error : 'Failed to update');
          return;
        }
        onSaved();
        onClose();
      } catch {
        setErr('Network error');
      } finally {
        setBusy(false);
      }
    },
    [event, onClose, onSaved]
  );

  const onEndSession = useCallback(() => {
    if (!event || event.status !== 'active') return;
    if (!window.confirm('End this live session for everyone?')) return;
    void patchSession({ endSession: true });
  }, [event, patchSession]);

  const onSaveShell = useCallback(() => {
    if (!event || event.status !== 'active') return;
    const current =
      event.shell === 'countdown_timer' ? 'countdown_timer' : 'video_only';
    if (shell === current) {
      onClose();
      return;
    }
    void patchSession({ shell });
  }, [event, shell, patchSession, onClose]);

  if (!open || !event) return null;

  const isActive = event.status === 'active';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 p-2 sm:p-4"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-live-edit-title"
        className="flex h-full w-full max-w-md flex-col border-l border-white/15 bg-bg-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="unified-live-edit-title" className="font-heading text-lg font-bold text-white">
            Live session
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <p className="font-mono text-xs text-white/55">ID · {event.sessionId}</p>
          <p className="text-sm text-white/70">
            Status:{' '}
            <span className="text-cyan-200/90">
              {event.status}
              {event.status === 'ended' ? ' (read-only)' : ''}
            </span>
          </p>

          <Link
            to={`/live/${encodeURIComponent(event.sessionId)}`}
            className="inline-block text-sm text-cyan-200/90 underline decoration-cyan-400/40"
          >
            Open host / room
          </Link>

          {isActive ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-white/50" htmlFor="live-edit-shell">
                  Shell
                </label>
                <select
                  id="live-edit-shell"
                  value={shell}
                  onChange={(e) =>
                    setShell(e.target.value as 'video_only' | 'countdown_timer')
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="video_only">Video only</option>
                  <option value="countdown_timer">Countdown timer</option>
                </select>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSaveShell()}
                className="w-full rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save shell'}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void onEndSession()}
                className="w-full rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-500/25 disabled:opacity-40"
              >
                End session for everyone
              </button>
            </>
          ) : (
            <p className="text-xs text-white/45">
              Ended sessions cannot change shell from here. Open the room link for history if
              available.
            </p>
          )}

          {err ? <p className="text-sm text-red-300">{err}</p> : null}
        </div>
      </div>
    </div>
  );
}
