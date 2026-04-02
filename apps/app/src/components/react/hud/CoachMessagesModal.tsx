/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P3: Client reads/sends coach messages via /api/me/coach-messages.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface CoachMessagePayload {
  id: string;
  author_user_id: string;
  author_role: string;
  body: string;
  created_at: string;
}

interface CoachMessagesModalProps {
  open: boolean;
  onClose: () => void;
  trainerUserId: string;
}

const CoachMessagesModal: React.FC<CoachMessagesModalProps> = ({ open, onClose, trainerUserId }) => {
  const [messages, setMessages] = useState<CoachMessagePayload[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(
    async (cursor: string | null, appendOlder: boolean) => {
      const q = new URLSearchParams({ trainerUserId });
      if (cursor) q.set('cursor', cursor);
      q.set('limit', '50');
      const res = await fetch(`/api/me/coach-messages?${q}`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load messages');
      }
      const list = Array.isArray(body.messages) ? (body.messages as CoachMessagePayload[]) : [];
      const next = typeof body.nextCursor === 'string' ? body.nextCursor : null;
      if (appendOlder) {
        setMessages((prev) => [...list, ...prev]);
      } else {
        setMessages(list);
      }
      setNextCursor(next);
    },
    [trainerUserId]
  );

  useEffect(() => {
    if (!open || !trainerUserId) return;
    setLoading(true);
    setError(null);
    void loadPage(null, false)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setMessages([]);
        setNextCursor(null);
      })
      .finally(() => setLoading(false));
  }, [open, trainerUserId, loadPage]);

  const onLoadOlder = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(nextCursor, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load older');
    } finally {
      setLoadingMore(false);
    }
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/me/coach-messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainerUserId, body: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Send failed');
        return;
      }
      setDraft('');
      await loadPage(null, false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-messages-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(520px,85vh)] w-full max-w-lg flex-col rounded-xl border border-white/15 bg-bg-dark shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="coach-messages-title" className="font-heading text-lg font-bold text-white">
            Messages with coach
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 font-mono text-xs text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        {error ? <p className="px-4 pt-2 text-sm text-red-300">{error}</p> : null}

        <div className="flex min-h-0 flex-1 flex-col">
          {nextCursor ? (
            <button
              type="button"
              onClick={() => void onLoadOlder()}
              disabled={loadingMore}
              className="border-b border-white/10 px-3 py-2 text-center font-mono text-[10px] uppercase text-orange-light/90 hover:bg-white/5 disabled:opacity-40"
            >
              {loadingMore ? 'Loading…' : 'Load older messages'}
            </button>
          ) : null}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {loading && messages.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-white/40">No messages yet. Say hello below.</p>
            ) : (
              messages.map((m) => {
                const isClient = m.author_role === 'client';
                return (
                  <div key={m.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[88%] rounded-lg px-3 py-2 font-mono text-xs leading-relaxed ${
                        isClient
                          ? 'bg-orange-light/20 text-orange-light'
                          : 'border border-white/15 bg-white/5 text-white/80'
                      }`}
                    >
                      <p className="mb-1 text-[9px] uppercase tracking-wide text-white/35">
                        {isClient ? 'You' : 'Coach'} ·{' '}
                        {new Date(m.created_at).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-white/10 p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Message your coach…"
            className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
            maxLength={8000}
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={sending || !draft.trim()}
            className="w-full rounded-lg bg-orange-light py-2 font-mono text-xs font-bold uppercase text-black hover:opacity-90 disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachMessagesModal;
