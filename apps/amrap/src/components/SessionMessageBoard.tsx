import { useState, useRef, useEffect } from 'react';
import { useSessionMessages } from '@/hooks/useSessionMessages';
import type { AmrapSessionMessageRow, AmrapParticipantRow } from '@/lib/supabase';

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getNickname(participantId: string, participants: AmrapParticipantRow[]): string {
  const p = participants.find((x) => x.id === participantId);
  return p?.nickname ?? 'Someone';
}

export interface SessionMessageBoardProps {
  sessionId: string | undefined;
  participantId: string | null;
  participants: AmrapParticipantRow[];
  className?: string;
}

export default function SessionMessageBoard({
  sessionId,
  participantId,
  participants,
  className = '',
}: SessionMessageBoardProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sendError, sendMessage, hasUserPosted } = useSessionMessages(
    sessionId,
    participantId
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  };

  if (!sessionId) return null;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/10 bg-black/30 p-4 lg:sticky lg:top-4 ${className}`}
    >
      <h3 className="mb-3 text-lg font-bold text-white">Message board</h3>

      {participantId && !hasUserPosted && (
        <p className="mb-2 text-sm font-medium text-orange-400">Say hi to the group!</p>
      )}

      {/* ~3 messages visible before scroll */}
      <div
        ref={listRef}
        className="min-h-[120px] max-h-[13.5rem] flex-1 space-y-2 overflow-y-auto pr-1"
      >
        {loading ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-white/50">No messages yet. Say hi when you join!</p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              nickname={getNickname(m.participant_id, participants)}
            />
          ))
        )}
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        {sendError && <p className="mb-2 text-sm text-red-400">{sendError}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={participantId ? 'Say hi…' : 'Join to message'}
            disabled={!participantId}
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!participantId || !input.trim()}
            className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600"
          >
            Send
          </button>
        </div>
        {input.length > 400 && (
          <p className="mt-1 text-xs text-white/50">{input.length}/500</p>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  nickname,
}: {
  message: AmrapSessionMessageRow;
  nickname: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-white">{nickname}</span>
        <span className="text-[10px] text-white/50">{formatMessageTime(message.created_at)}</span>
      </div>
      <p className="mt-0.5 break-words text-sm text-white/90">{message.body}</p>
    </div>
  );
}
