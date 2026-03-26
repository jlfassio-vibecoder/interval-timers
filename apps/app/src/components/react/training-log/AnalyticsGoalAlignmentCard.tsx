/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goal alignment summary card for Training Log analytics.
 */

import React from 'react';

interface AlignmentStat {
  averageComposite: number | null;
  scoredSessions: number;
  totalSessions: number;
}

export interface AnalyticsGoalAlignmentCardProps {
  thisWeek: AlignmentStat;
  allFiltered: AlignmentStat;
  scorerVersion: string;
}

const AnalyticsGoalAlignmentCard: React.FC<AnalyticsGoalAlignmentCardProps> = ({
  thisWeek,
  allFiltered,
  scorerVersion,
}) => {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
        Goal Alignment
      </h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
            This week
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {thisWeek.averageComposite == null ? '—' : `${thisWeek.averageComposite}%`}
          </p>
          <p className="font-mono text-[10px] text-white/50">
            {thisWeek.scoredSessions}/{thisWeek.totalSessions} scored sessions
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
            Filtered range
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {allFiltered.averageComposite == null ? '—' : `${allFiltered.averageComposite}%`}
          </p>
          <p className="font-mono text-[10px] text-white/50">
            {allFiltered.scoredSessions}/{allFiltered.totalSessions} scored sessions
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/55">
        Alignment values are estimates and may shift as the scorer improves (v{scorerVersion}).
      </p>
    </div>
  );
};

export default AnalyticsGoalAlignmentCard;
