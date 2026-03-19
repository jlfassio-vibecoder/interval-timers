/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compact Training Log preview strip for HUD. Phase 1 spec: full-width progress bar
 * with lateral color-coded fill (red <67%, orange 67–99%, green 100%+). Unfilled
 * track shows remaining percentage. Layout matches roadmap mockup.
 */

import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';

export interface TrainingLogPreviewProps {
  minutesThisWeek: number;
  goalMinutes?: number;
}

function getColorClass(minutes: number, goal: number): string {
  if (minutes >= goal) return 'text-green-400';
  if (minutes >= goal * 0.67) return 'text-orange-400';
  return 'text-red-400';
}

function getBarColorClass(minutes: number, goal: number): string {
  if (minutes >= goal) return 'bg-green-500';
  if (minutes >= goal * 0.67) return 'bg-orange-500';
  return 'bg-red-500';
}

const TrainingLogPreview: React.FC<TrainingLogPreviewProps> = ({
  minutesThisWeek,
  goalMinutes = HEALTH_GUIDELINE_WEEKLY_MINUTES,
}) => {
  const G = Math.max(1, goalMinutes);
  const H = HEALTH_GUIDELINE_WEEKLY_MINUTES;
  const showGhost = G < H;
  const scaleMax = Math.max(G, H);
  const percent = Math.round((minutesThisWeek / G) * 100);
  const cappedPercent = Math.min(100, Math.round((minutesThisWeek / scaleMax) * 100));
  const goalReached = minutesThisWeek >= G;
  const remainingMinutes = Math.max(0, G - Math.round(minutesThisWeek));
  const colorClass = getColorClass(minutesThisWeek, G);
  const barColorClass = getBarColorClass(minutesThisWeek, G);
  const ghostPct = showGhost ? (H / scaleMax) * 100 : 0;

  return (
    <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
      {/* Row 1: This week + link */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`font-heading text-xl font-bold ${colorClass}`}>
          This week: {Math.round(minutesThisWeek)} min
        </span>
        <a
          href="/training-log"
          className="hover:text-orange-300 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-orange-light transition-colors"
        >
          View Training Log
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      {/* Row 2: Full-width progress bar + goal text (mockup layout) */}
      <div className="flex w-full min-w-0 items-center gap-3">
        <div
          className="relative min-h-[10px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/10"
          aria-label={`${minutesThisWeek} of ${G} min goal${showGhost ? `. Health guideline: ${H} minutes per week shown as dashed line` : ''}`}
        >
          <div
            className={`h-full min-h-[10px] rounded-full transition-all ${barColorClass}`}
            style={{ width: `${cappedPercent}%` }}
          />
          {showGhost && ghostPct > 0 && ghostPct < 100 && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0 border-l border-dashed border-white/25"
              style={{ left: `${ghostPct}%` }}
              title={`${H} min weekly guideline (WHO-style moderate activity)`}
              aria-hidden
            />
          )}
        </div>
        {goalReached ? (
          <span
            className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-green-400"
            aria-label={percent > 100 ? `Weekly goal exceeded: ${percent}%` : 'Weekly goal reached'}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {percent > 100 ? `${percent}%` : 'Goal!'}
          </span>
        ) : (
          <span
            className="text-orange-400/90 shrink-0 font-mono text-[10px]"
            aria-label={`${remainingMinutes} minutes needed to reach ${G} minute goal`}
          >
            {remainingMinutes} min needed to reach goal
          </span>
        )}
      </div>
    </section>
  );
};

export default TrainingLogPreview;
