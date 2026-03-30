/**
 * Loading shell for logged-in /welcome (no invite): hero subline + schedule card footprint.
 */

import React from 'react';

/** Pulse line under the welcome-back title (inside hero card). */
export const WelcomeWelcomeBackHeroSkeleton: React.FC = () => (
  <div
    className="mx-auto mt-1 h-5 w-[88%] max-w-sm animate-pulse rounded-md bg-white/10"
    aria-hidden
  />
);

/** Matches `WelcomeSchedulePreview` outer chrome (below hero card). */
export const WelcomeWelcomeBackScheduleSkeleton: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <section
    className={`rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-sm ${className}`.trim()}
    aria-busy="true"
    aria-hidden
  >
    <div className="mb-1 h-3.5 w-28 animate-pulse rounded bg-white/15" />
    <div className="mb-4 h-3 w-[70%] max-w-xs animate-pulse rounded bg-white/10" />
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-8">
      <div className="mx-auto h-4 w-52 max-w-full animate-pulse rounded bg-white/10" />
      <div className="mx-auto mt-4 h-9 w-44 max-w-full animate-pulse rounded-md bg-white/15" />
    </div>
  </section>
);
