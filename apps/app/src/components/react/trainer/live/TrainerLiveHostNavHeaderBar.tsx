import type { ReactNode } from 'react';
import { useTrainerLiveAmrapHostNav } from '@/contexts/TrainerLiveAmrapHostNavContext';

/**
 * Top bar: "Live session" + AMRAP host actions (New Workout, Daily Warmup) from context, then `children` on the right.
 */
export default function TrainerLiveHostNavHeaderBar({ children }: { children: ReactNode }) {
  const { hostNavActions } = useTrainerLiveAmrapHostNav();

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 md:px-6">
      <div className="flex min-w-0 max-w-full flex-[1_1_auto] flex-wrap items-center gap-x-3 gap-y-2 sm:max-w-[min(100%,42rem)] md:max-w-none">
        <h1 className="shrink-0 font-heading text-sm font-bold uppercase tracking-tight text-orange-light md:text-base">
          Live session
        </h1>
        {hostNavActions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">{hostNavActions}</div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}
