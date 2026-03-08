/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quick Stats Bar for Zone 3: week streak, workouts this month, current phase.
 */

import React, { useState, useEffect } from 'react';
import { getStreakData } from '@/lib/supabase/client/progress-analytics';
import { getCurrentWeek } from '@/lib/supabase/client/user-programs';
import { fetchUserPrograms } from '@/lib/supabase/client/user-programs';

export interface QuickStatsBarProps {
  userId: string;
  activeProgramId: string | null;
}

const QuickStatsBar: React.FC<QuickStatsBarProps> = ({ userId, activeProgramId }) => {
  const [weekStreak, setWeekStreak] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);

  useEffect(() => {
    getStreakData(userId).then(({ weekStreak: ws, monthlyCount: mc }) => {
      setWeekStreak(ws);
      setMonthlyCount(mc);
    });
  }, [userId]);

  useEffect(() => {
    if (!activeProgramId) {
      setCurrentPhase(null);
      return;
    }
    fetchUserPrograms(userId)
      .then((list) => {
        const program = list.find((p) => p.programId === activeProgramId);
        if (!program) {
          setCurrentPhase(null);
          return;
        }
        const { current } = getCurrentWeek(program.startDate ?? null, program.durationWeeks ?? 1);
        setCurrentPhase(current);
      })
      .catch(() => setCurrentPhase(null));
  }, [userId, activeProgramId]);

  return (
    <div className="flex flex-wrap gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-[10px] uppercase text-white/50">Week streak</span>
        <p className="font-heading text-lg font-bold text-white">{weekStreak}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-[10px] uppercase text-white/50">This month</span>
        <p className="font-heading text-lg font-bold text-white">{monthlyCount}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-[10px] uppercase text-white/50">Current phase</span>
        <p className="font-heading text-lg font-bold text-white">
          {currentPhase !== null ? `Week ${currentPhase}` : '—'}
        </p>
      </div>
    </div>
  );
};

export default QuickStatsBar;
