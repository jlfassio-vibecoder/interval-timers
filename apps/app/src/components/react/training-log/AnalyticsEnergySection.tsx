/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Estimated kcal summary + profile context for Training Log analytics.
 */

import React from 'react';
import type { TrainingLogEnergyAggregates } from '@/lib/training-log-energy-analytics';

export interface AnalyticsEnergySectionProps {
  /** When false, show complete-profile nudge only. */
  hasMetBaseline: boolean;
  /** Non-null when hasMetBaseline (parent computes with useMemo). */
  aggregates: TrainingLogEnergyAggregates | null;
  weightKg: number;
  tam: number;
}

const AnalyticsEnergySection: React.FC<AnalyticsEnergySectionProps> = ({
  hasMetBaseline,
  aggregates,
  weightKg,
  tam,
}) => {
  if (!hasMetBaseline || !aggregates) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/80">
          <a
            href="/account/profile"
            className="font-medium text-orange-400 underline hover:text-orange-300"
          >
            Complete your profile
          </a>
          {' '}
          — add date of birth, sex, weight, and height to see estimated calorie burn trends for your
          filtered sessions.
        </p>
      </div>
    );
  }

  const avgLabel =
    aggregates.monthAvgEstimatedKcal != null
      ? `${aggregates.monthAvgEstimatedKcal} kcal`
      : '—';

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
        Estimates use your profile weight ({weightKg} kg) and activity multiplier ({tam.toFixed(2)}).
        Values reflect your current profile, not past snapshots.
      </p>
      <div>
        <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          Estimated energy (filtered logs)
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">
              This week
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {aggregates.weekEstimatedKcal}{' '}
              <span className="text-base font-normal text-white/60">kcal</span>
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/45">About · typical intensity by format</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">
              This month
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {aggregates.monthEstimatedKcal}{' '}
              <span className="text-base font-normal text-white/60">kcal</span>
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/45">Calendar month · estimated</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">
              Avg / session (month)
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {avgLabel}
              {aggregates.monthAvgEstimatedKcal != null && (
                <span className="text-base font-normal text-white/60"> est.</span>
              )}
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/45">
              Only sessions with duration ({aggregates.monthSessionsWithEstimate} of{' '}
              {aggregates.monthSessionCount})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsEnergySection;
