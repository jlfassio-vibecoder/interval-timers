/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deployment Timeline: week selector (HUB and program views).
 */

import React, { useMemo } from 'react';
import { X, Target, Lock } from 'lucide-react';

export interface DeploymentTimelineProps {
  weeks: number;
  unlockedWeeks: number[];
  selectedWeek: number | null;
  onSelectWeek: (week: number | null) => void;
  weekLabels?: Record<number, string>;
}

const DeploymentTimeline: React.FC<DeploymentTimelineProps> = ({
  weeks,
  unlockedWeeks,
  selectedWeek,
  onSelectWeek,
  weekLabels,
}) => {
  const unlocked = useMemo(() => new Set(unlockedWeeks), [unlockedWeeks]);
  return (
    <div className="space-y-6">
      <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
        Deployment Timeline
      </h4>
      <div className="space-y-4">
        {Array.from({ length: weeks }, (_, i) => i + 1).map((week) => {
          const isUnlocked = unlocked.has(week);
          const isActive = selectedWeek === week;
          const title = weekLabels?.[week];

          return (
            <button
              key={week}
              type="button"
              disabled={!isUnlocked}
              onClick={() => onSelectWeek(isActive ? null : week)}
              className={`group/week flex w-full items-center justify-between rounded-xl border p-4 transition-all ${
                isActive
                  ? 'border-orange-light bg-orange-light text-black shadow-[0_0_20px_rgba(255,191,0,0.4)]'
                  : isUnlocked
                    ? 'border-orange-light/30 bg-orange-light/10 hover:bg-orange-light/20 text-white'
                    : 'cursor-not-allowed border-white/10 bg-white/5 text-white/10'
              }`}
            >
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors ${isActive ? 'bg-black text-orange-light' : isUnlocked ? 'bg-orange-light text-black' : 'bg-white/5'}`}
                  >
                    {week}
                  </span>
                  <span
                    className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-black' : ''}`}
                  >
                    Week {week}
                  </span>
                </div>
                {title ? (
                  <span
                    className={`ml-11 text-[10px] uppercase tracking-wider ${isActive ? 'text-black/80' : isUnlocked ? 'text-white/60' : 'text-white/20'}`}
                  >
                    {title}
                  </span>
                ) : null}
              </div>
              {isUnlocked ? (
                isActive ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Target className="h-4 w-4 text-orange-light" />
                )
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DeploymentTimeline;
