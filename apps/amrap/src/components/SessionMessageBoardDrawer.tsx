import type { ReactNode } from 'react';
import { useDrawerOpenPersisted, amrapMessageDrawerStorageKey } from '@/hooks/useDrawerOpenPersisted';

/**
 * Right-edge rail for the session message board (Trainer Live embed). Matches
 * `TrainerLiveVideoFeedDrawer` in apps/app: children stay mounted when collapsed.
 * With `sessionId`, open/closed is remembered for this AMRAP session (sessionStorage).
 */
export default function SessionMessageBoardDrawer({
  children,
  sessionId,
  defaultOpen = false,
}: {
  children: ReactNode;
  /** When set, persist rail open state per AMRAP session. */
  sessionId?: string;
  defaultOpen?: boolean;
}) {
  const storageKey = sessionId ? amrapMessageDrawerStorageKey(sessionId) : undefined;
  const [open, setOpen] = useDrawerOpenPersisted(storageKey, defaultOpen);

  return (
    <div className="flex min-h-0 shrink-0 border-l border-white/10 bg-zinc-950/95 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Collapse message board' : 'Expand message board'}
        className="flex w-11 shrink-0 flex-col items-center justify-center gap-2 border-r border-white/10 bg-black/50 px-1 py-4 text-orange-400/90 hover:bg-white/5"
      >
        <span className="text-lg leading-none text-white" aria-hidden>
          {open ? '⟩' : '⟨'}
        </span>
        <span
          className="select-none text-[10px] font-semibold uppercase tracking-wider text-orange-300/90 [writing-mode:vertical-rl] rotate-180"
          aria-hidden
        >
          Chat
        </span>
      </button>
      <div
        className={
          open
            ? 'min-h-0 w-[min(20rem,calc(100vw-2.75rem))] max-w-[20rem] overflow-hidden transition-[width] duration-200 ease-out'
            : 'w-0 overflow-hidden transition-[width] duration-200 ease-out'
        }
        aria-hidden={!open}
      >
        {/* inert: keep children mounted but unfocusable when rail is collapsed */}
        <div
          className={
            open
              ? 'h-full max-h-[min(85vh,calc(100vh-6rem))] min-h-0 overflow-y-auto overflow-x-hidden p-2'
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
