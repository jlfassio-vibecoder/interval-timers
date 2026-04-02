/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P3 Performance Lab: trainer–client message thread (read + send + paginate older).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

export interface LabMessagePayload {
  id: string;
  author_user_id: string;
  author_role: string;
  body: string;
  created_at: string;
}

interface PerformanceLabMessagesSectionProps {
  userId: string;
}

const PerformanceLabMessagesSection: React.FC<PerformanceLabMessagesSectionProps> = ({ userId }) => {
  const { user } = useAppContext();
  const [messages, setMessages] = useState<LabMessagePayload[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Bumped on every full replace load so in-flight "load older" cannot apply after a newer full refresh (e.g. post-send). */
  const fullLoadGenerationRef = useRef(0);

  const loadPage = useCallback(
    async (cursor: string | null, appendOlder: boolean) => {
      let generationAtStart: number;
      if (!appendOlder) {
        fullLoadGenerationRef.current += 1;
        generationAtStart = fullLoadGenerationRef.current;
      } else {
        generationAtStart = fullLoadGenerationRef.current;
      }

      const q = new URLSearchParams();
      if (cursor) q.set('cursor', cursor);
      q.set('limit', '50');
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/messages?${q}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load messages');
      }
      const list = Array.isArray(body.messages) ? (body.messages as LabMessagePayload[]) : [];
      const next = typeof body.nextCursor === 'string' ? body.nextCursor : null;
      if (generationAtStart !== fullLoadGenerationRef.current) return;

      if (appendOlder) {
        setMessages((prev) => [...list, ...prev]);
      } else {
        setMessages(list);
      }
      setNextCursor(next);
    },
    [userId]
  );

  const initialLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPage(null, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setMessages([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  const onLoadOlder = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(nextCursor, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load older');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, loadPage]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/clients/${encodeURIComponent(userId)}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Send failed');
        return;
      }
      setDraft('');
      const newId = typeof body.id === 'string' ? body.id : null;
      const trainerUid = user?.uid;
      if (newId && trainerUid) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId,
            author_user_id: trainerUid,
            author_role: 'trainer',
            body: text,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        await loadPage(null, false);
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setSending(false);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        <span className="ml-3 text-white/60">Loading messages…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-orange-light" />
          <h2 className="font-heading text-xl font-bold">Message board</h2>
        </div>
      </div>

      <p className="text-sm text-white/55">
        Async thread with this client. Messages are stored for both of you; the client can reply from the
        app sidebar when they have an active program with you.
      </p>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex max-h-[min(420px,50vh)] flex-col rounded-lg border border-white/10 bg-black/25">
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
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-white/40">No messages yet. Send the first one below.</p>
          ) : (
            messages.map((m) => {
              const isTrainer = m.author_role === 'trainer';
              return (
                <div
                  key={m.id}
                  className={`flex ${isTrainer ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 font-mono text-xs leading-relaxed ${
                      isTrainer
                        ? 'bg-orange-light/20 text-orange-light'
                        : 'border border-white/15 bg-white/5 text-white/80'
                    }`}
                  >
                    <p className="mb-1 text-[9px] uppercase tracking-wide text-white/35">
                      {isTrainer ? 'You' : 'Client'} ·{' '}
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Write a message…"
          className="min-h-[5rem] flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
          maxLength={8000}
        />
        <button
          type="button"
          onClick={() => void onSend()}
          disabled={sending || loading || !draft.trim()}
          className="rounded-lg bg-orange-light px-4 py-2 font-mono text-xs font-bold uppercase text-black hover:opacity-90 disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default PerformanceLabMessagesSection;
