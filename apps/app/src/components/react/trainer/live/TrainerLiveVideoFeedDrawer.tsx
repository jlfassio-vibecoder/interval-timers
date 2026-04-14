import type { ReactNode } from 'react';
import {
  useTrainerLiveDrawerOpen,
  trainerLiveDrawerStorageKey,
} from '@/hooks/useTrainerLiveDrawerOpen';

/**
 * Right-side rail for the Trainer Live Agora feed. Keeps children mounted so the channel
 * stays connected; collapsed state only hides the panel visually.
 * With `sessionId`, open/closed is remembered for this live session (sessionStorage).
 */
export default function TrainerLiveVideoFeedDrawer({
  children,
  sessionId,
  defaultOpen = true,
}: {
  children: ReactNode;
  /** When set, persist rail open state per Trainer Live session. */
  sessionId?: string;
  defaultOpen?: boolean;
}) {
  const storageKey = sessionId ? trainerLiveDrawerStorageKey(sessionId, 'video') : undefined;
  const [open, setOpen] = useTrainerLiveDrawerOpen(storageKey, defaultOpen);

  return (
    <div
      className="flex h-full min-h-0 shrink-0 self-stretch border-l border-white/10 bg-zinc-950/95 backdrop-blur-sm"
      data-region="trainer-live-video-feed-drawer"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Collapse video feed' : 'Expand video feed'}
        className="text-orange-light/90 flex w-11 shrink-0 flex-col items-center justify-center gap-2 border-r border-white/10 bg-black/50 px-1 py-4 hover:bg-white/5"
      >
        <span className="text-lg leading-none text-white" aria-hidden>
          {open ? '⟩' : '⟨'}
        </span>
        <span
          className="rotate-180 select-none text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]"
          aria-hidden
        >
          Video
        </span>
      </button>
      <div
        className={
          open
            ? 'flex h-full min-h-0 w-[min(20rem,calc(100vw-2.75rem))] max-w-[20rem] flex-col overflow-hidden transition-[width] duration-200 ease-out'
            : 'w-0 overflow-hidden transition-[width] duration-200 ease-out'
        }
        aria-hidden={!open}
      >
        <div
          className={
            open
              ? 'h-full min-h-0 overflow-y-auto overflow-x-hidden p-2'
              : 'pointer-events-none opacity-0'
          }
          inert={!open}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
