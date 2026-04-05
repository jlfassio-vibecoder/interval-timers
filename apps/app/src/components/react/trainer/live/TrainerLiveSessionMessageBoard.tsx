import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useTrainerLiveSessionMessages } from '@/hooks/useTrainerLiveSessionMessages';
import { useTrainerLiveSessionParticipants } from '@/hooks/useTrainerLiveSessionParticipants';
import {
  getTrainerLiveReactionPreset,
  groupPresetsByCategory,
  TRAINER_LIVE_REACTION_PRESETS,
  type TrainerLiveReactionPreset,
} from '@/lib/trainer-live/trainerLiveMessageReactions';
import { getActiveMentionSegment } from '@/lib/trainer-live/trainerLiveMentionUtils';

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const MENTION_MAX = 15;

export default function TrainerLiveSessionMessageBoard({
  sessionId,
  participantId,
  className = '',
  compactDrawerLayout = false,
}: {
  sessionId: string | undefined;
  participantId: string | null;
  className?: string;
  /** Fill top split of chat drawer; message list grows with flex instead of fixed max height. */
  compactDrawerLayout?: boolean;
}) {
  const [input, setInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [pendingTarget, setPendingTarget] = useState<{
    id: string;
    displayName: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, loading, loadError, sendError, sendMessage, hasUserPosted } =
    useTrainerLiveSessionMessages(sessionId, participantId);
  const { participants } = useTrainerLiveSessionParticipants(sessionId);

  const mentionSegment = useMemo(
    () => (participantId ? getActiveMentionSegment(input, cursorPos) : null),
    [input, cursorPos, participantId]
  );

  const mentionFiltered = useMemo(() => {
    if (!mentionSegment) return [];
    const q = mentionSegment.query.toLowerCase();
    const list = participants.filter((p) => p.display_name.toLowerCase().includes(q));
    return list.slice(0, MENTION_MAX);
  }, [mentionSegment, participants]);

  const mentionOpen = mentionSegment !== null && !!participantId;

  useEffect(() => {
    setMentionActiveIndex(0);
  }, [mentionSegment?.query, mentionOpen]);

  useEffect(() => {
    if (!reactionMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (composerRef.current?.contains(e.target as Node)) return;
      setReactionMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReactionMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [reactionMenuOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const syncCursor = useCallback(() => {
    const el = inputRef.current;
    if (el) setCursorPos(el.selectionStart ?? 0);
  }, []);

  const clearPendingTarget = useCallback(() => setPendingTarget(null), []);

  const applyMentionPick = useCallback(
    (p: { id: string; display_name: string }) => {
      const seg = getActiveMentionSegment(input, cursorPos);
      if (!seg) return;
      const insert = `@${p.display_name} `;
      const next =
        input.slice(0, seg.start) + insert + input.slice(seg.end);
      const capped = next.slice(0, 500);
      setInput(capped);
      setPendingTarget({ id: p.id, displayName: p.display_name });
      const pos = seg.start + insert.length;
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(pos, pos);
          setCursorPos(pos);
        }
      });
    },
    [input, cursorPos]
  );

  const cancelMentionTyping = useCallback(() => {
    const seg = getActiveMentionSegment(input, cursorPos);
    if (!seg) return;
    const next = input.slice(0, seg.start) + input.slice(seg.end);
    setInput(next);
    const pos = seg.start;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
        setCursorPos(pos);
      }
    });
  }, [input, cursorPos]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;
    const targetId = pendingTarget?.id;
    setInput('');
    clearPendingTarget();
    await sendMessage(text, targetId ? { targetParticipantId: targetId } : undefined);
  };

  const sendReactionPreset = async (preset: TrainerLiveReactionPreset) => {
    setReactionMenuOpen(false);
    const targetId = pendingTarget?.id;
    clearPendingTarget();
    await sendMessage(preset.label, {
      reactionKey: preset.reactionKey,
      ...(targetId ? { targetParticipantId: targetId } : {}),
    });
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value.slice(0, 500));
    setCursorPos(e.target.selectionStart ?? 0);
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen) {
      if (mentionFiltered.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionActiveIndex((i) => (i + 1) % mentionFiltered.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionActiveIndex((i) =>
            i <= 0 ? mentionFiltered.length - 1 : i - 1
          );
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          applyMentionPick(mentionFiltered[mentionActiveIndex]);
          return;
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelMentionTyping();
        return;
      }
    }
    if (e.key === 'Enter' && !mentionOpen) {
      void handleSubmit();
    }
  };

  const reactionGroups = groupPresetsByCategory(TRAINER_LIVE_REACTION_PRESETS);

  if (!sessionId) return null;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/10 bg-black/30 p-4 lg:static ${compactDrawerLayout ? 'min-h-0 flex-1' : ''} ${className}`}
    >
      <h3 className="mb-1 text-lg font-bold text-white">Message board</h3>
      <p className="mb-2 text-xs text-white/45">Room chat for this live session.</p>

      {participantId && !hasUserPosted && (
        <p className="text-orange-400 mb-2 text-sm font-medium">Say hi to the group!</p>
      )}

      {loadError ? (
        <p className="mb-2 text-sm text-amber-200" role="alert">
          Could not load chat: {loadError}
        </p>
      ) : null}

      <div
        ref={listRef}
        className={
          compactDrawerLayout
            ? 'min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'
            : 'max-h-[13.5rem] min-h-[120px] flex-1 space-y-2 overflow-y-auto pr-1'
        }
      >
        {loading ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-white/50">No messages yet. Say hi when you join!</p>
        ) : (
          messages.map((m) => {
            const preset = getTrainerLiveReactionPreset(m.reaction_key);
            const Icon = preset?.icon;
            const targetName = m.target_display_name?.trim();
            return (
              <div
                key={m.id}
                className="flex gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                {Icon ? (
                  <span className="shrink-0 pt-0.5" aria-hidden>
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${preset.iconClassName}`} />
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-white">{m.author_display_name}</span>
                    <span className="text-[10px] text-white/50">
                      {formatMessageTime(m.created_at)}
                    </span>
                  </div>
                  {targetName ? (
                    <p className="text-orange-300/95 mt-0.5 text-xs font-medium">
                      To @{targetName}
                    </p>
                  ) : null}
                  <p className="mt-0.5 break-words text-sm text-white/90">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        {sendError ? <p className="mb-2 text-sm text-red-400">{sendError}</p> : null}
        <div ref={composerRef} className="flex flex-col gap-2">
          {pendingTarget ? (
            <div className="flex items-center gap-2 text-xs text-white/80">
              <span className="text-orange-300/90 font-medium">
                To @{pendingTarget.displayName}
              </span>
              <button
                type="button"
                onClick={clearPendingTarget}
                className="text-white/50 hover:text-white/90 rounded p-0.5"
                aria-label="Clear mention target"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className="flex w-full flex-col gap-2">
            <div className="relative w-full min-w-0">
              {mentionOpen ? (
                <div
                  id="trainer-live-mention-listbox"
                  role="listbox"
                  aria-label="Mention participant"
                  className="border-white/15 absolute bottom-full left-0 right-0 z-[60] mb-1 max-h-[min(12rem,40vh)] overflow-y-auto rounded-lg border bg-zinc-950/98 py-1 shadow-xl backdrop-blur-sm"
                >
                  {mentionFiltered.length === 0 ? (
                    <p className="text-white/45 px-3 py-2 text-sm">No matching participants</p>
                  ) : (
                    mentionFiltered.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={idx === mentionActiveIndex}
                        className={`hover:bg-white/8 w-full px-3 py-2 text-left text-sm text-white/95 ${
                          idx === mentionActiveIndex ? 'bg-white/10' : ''
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyMentionPick(p)}
                      >
                        <span className="font-medium">{p.display_name}</span>
                        <span className="text-white/40 ml-2 text-xs">{p.role}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              <div
                className={`focus-within:border-orange-500/80 focus-within:ring-orange-500 flex min-h-[2.75rem] w-full min-w-0 rounded-lg border border-white/20 bg-black/30 focus-within:ring-1 ${participantId ? '' : 'opacity-50'}`}
              >
              {participantId ? (
                <div className="relative shrink-0 self-stretch border-r border-white/10">
                  <button
                    type="button"
                    id="trainer-live-reactions-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={reactionMenuOpen}
                    aria-controls="trainer-live-reactions-listbox"
                    className="hover:bg-white/5 flex h-full items-center gap-0.5 rounded-l-lg px-2 text-white/80 transition-colors hover:text-white"
                    onClick={() => setReactionMenuOpen((o) => !o)}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                      React
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${reactionMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {reactionMenuOpen ? (
                    <div
                      id="trainer-live-reactions-listbox"
                      role="listbox"
                      aria-labelledby="trainer-live-reactions-trigger"
                      className="border-white/15 absolute bottom-full left-0 z-50 mb-1 max-h-[min(18rem,50vh)] w-[min(calc(100vw-2rem),18rem)] overflow-y-auto rounded-lg border bg-zinc-950/98 py-2 shadow-xl backdrop-blur-sm"
                    >
                      {reactionGroups.map(({ category, label, items }) => (
                        <div key={category} className="px-2 pb-2 last:pb-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                            {label}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {items.map((preset) => {
                              const RIcon = preset.icon;
                              return (
                                <li key={preset.reactionKey} role="option">
                                  <button
                                    type="button"
                                    className="hover:bg-white/8 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-white/95"
                                    aria-label={`Send reaction: ${preset.label}`}
                                    onClick={() => void sendReactionPreset(preset)}
                                  >
                                    <RIcon
                                      className={`h-4 w-4 shrink-0 ${preset.iconClassName}`}
                                      aria-hidden
                                    />
                                    <span className="min-w-0">{preset.label}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={onInputChange}
                onClick={syncCursor}
                onKeyUp={syncCursor}
                onSelect={syncCursor}
                onKeyDown={onInputKeyDown}
                placeholder={participantId ? 'Say hi… (use @ to mention)' : 'Join to message'}
                disabled={!participantId}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none disabled:opacity-50"
                aria-label="Message"
                aria-autocomplete="list"
                aria-controls={mentionOpen ? 'trainer-live-mention-listbox' : undefined}
                aria-expanded={mentionOpen}
              />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!participantId || !input.trim()}
              className="bg-orange-600 hover:bg-orange-500 disabled:hover:bg-orange-600 block w-full rounded-lg px-4 py-2.5 text-center text-sm font-bold text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
        {input.length > 400 ? (
          <p className="mt-1 text-xs text-white/50">{input.length}/500</p>
        ) : null}
      </div>
    </div>
  );
}
