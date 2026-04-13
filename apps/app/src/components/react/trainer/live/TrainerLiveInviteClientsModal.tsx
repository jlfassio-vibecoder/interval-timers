import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

type RosterRow = { id: string; full_name: string | null; email: string | null };

export interface TrainerLiveInviteClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

export default function TrainerLiveInviteClientsModal({
  open,
  onOpenChange,
  sessionId,
}: TrainerLiveInviteClientsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterErr, setRosterErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const rosterLabel = useCallback((r: RosterRow) => {
    return (r.full_name?.trim() || r.email?.trim() || r.id).trim();
  }, []);

  useEffect(() => {
    if (!open) return;
    savedFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = savedFocusRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) {
        el.focus();
      }
      savedFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      focusable[0]?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const list = getFocusableElements(root);
      if (list.length === 0) return;
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        list[0]?.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSubmitErr(null);
    setRosterErr(null);
    let cancelled = false;
    setRosterLoading(true);
    void (async () => {
      try {
        const auth = await missionControlApiAuthHeaders();
        const r = await fetch('/api/trainer/roster', {
          credentials: 'include',
          headers: { ...auth },
        });
        const raw = await r.json().catch(() => []);
        if (cancelled) return;
        if (!r.ok) {
          setRosterErr(typeof raw?.error === 'string' ? raw.error : 'Could not load roster');
          setRoster([]);
          return;
        }
        const arr = Array.isArray(raw) ? raw : [];
        setRoster(
          arr
            .map((row: unknown) => {
              const o = row as { id?: string; full_name?: string | null; email?: string | null };
              return {
                id: typeof o.id === 'string' ? o.id : '',
                full_name: o.full_name ?? null,
                email: o.email ?? null,
              };
            })
            .filter((x) => x.id)
        );
      } catch {
        if (!cancelled) {
          setRosterErr('Could not load roster');
          setRoster([]);
        }
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allIds = useMemo(() => roster.map((r) => r.id), [roster]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const handleSubmit = async () => {
    if (!sessionId.trim() || selected.size === 0) return;
    setSubmitErr(null);
    setSubmitBusy(true);
    try {
      const { data, error } = await supabase.rpc('trainer_live_invite_clients_to_session', {
        p_session_id: sessionId.trim(),
        p_client_user_ids: Array.from(selected),
      });
      if (error) {
        setSubmitErr(error.message);
        return;
      }
      const inserted = (data as { inserted?: number } | null)?.inserted ?? 0;
      if (inserted === 0 && selected.size > 0) {
        /* duplicates / already invited */
      }
      onOpenChange(false);
    } finally {
      setSubmitBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 text-white backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trainer-live-invite-title"
        className="max-h-[min(90vh,32rem)] w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-xl"
      >
        <div className="border-white/10 flex items-start justify-between gap-3 border-b px-4 py-3">
          <h2 id="trainer-live-invite-title" className="font-heading text-lg font-bold text-white">
            Invite clients
          </h2>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[min(60vh,22rem)] overflow-y-auto px-4 py-3">
          {rosterLoading ? (
            <p className="text-sm text-white/60">Loading your roster…</p>
          ) : rosterErr ? (
            <p className="text-sm text-red-300">{rosterErr}</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-white/60">No enrolled clients found. Add clients via programs first.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleAll}
                className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange-light hover:underline"
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
              <ul className="space-y-2">
                {roster.map((r) => (
                  <li key={r.id}>
                    <label className="hover:bg-white/5 flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-white/30"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                      <span className="min-w-0 flex-1 text-sm text-white">{rosterLabel(r)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {submitErr ? (
          <p className="border-white/10 border-t px-4 py-2 text-sm text-red-300">{submitErr}</p>
        ) : null}
        <div className="border-white/10 flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitBusy || selected.size === 0 || rosterLoading}
            className="rounded-lg border border-orange-light/50 bg-orange-light/20 px-3 py-1.5 text-sm font-semibold text-orange-light hover:bg-orange-light/30 disabled:opacity-40"
            onClick={() => void handleSubmit()}
          >
            {submitBusy ? 'Sending…' : `Send invites (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
