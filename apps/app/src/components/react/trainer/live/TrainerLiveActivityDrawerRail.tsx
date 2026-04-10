import type { ReactNode } from 'react';
import {
  useTrainerLiveDrawerOpen,
  trainerLiveDrawerStorageKey,
} from '@/hooks/useTrainerLiveDrawerOpen';

/**
 * Left-edge collapsible rail for session activity timer + block controls.
 * Mirrors `TrainerLiveVideoFeedDrawer` / `TrainerLiveCollapsibleSideRail`; panel is on the left,
 * toggle strip sits against the main session content.
 */
export default function TrainerLiveActivityDrawerRail({
  children,
  sessionId,
  defaultOpen = true,
}: {
  children: ReactNode;
  sessionId?: string;
  defaultOpen?: boolean;
}) {
  const storageKey = sessionId ? trainerLiveDrawerStorageKey(sessionId, 'activity') : undefined;
  const [open, setOpen] = useTrainerLiveDrawerOpen(storageKey, defaultOpen);

  return (
    <div
      className="flex h-full min-h-0 shrink-0 self-stretch border-r border-white/10 bg-zinc-950/95 backdrop-blur-sm"
      data-testid="trainer-live-activity-drawer-rail"
    >
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Collapse session activity drawer' : 'Expand session activity drawer'}
        className="text-orange-light/90 flex w-11 shrink-0 flex-col items-center justify-center gap-2 border-l border-white/10 bg-black/50 px-1 py-4 hover:bg-white/5"
      >
        <span className="text-lg leading-none text-white" aria-hidden>
          {open ? '⟩' : '⟨'}
        </span>
        <span
          className="rotate-180 select-none text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]"
          aria-hidden
        >
          Session
        </span>
      </button>
    </div>
  );
}
