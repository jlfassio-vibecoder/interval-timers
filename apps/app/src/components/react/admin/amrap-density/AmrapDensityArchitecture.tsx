/**
 * Density-Based AMRAP: session length tiers + recovery guidance (terminology avoids interval/timer labelling).
 */

import React from 'react';
import type { HiitSessionDurationTier } from '@/types/ai-workout';

const TIER_OPTIONS: {
  value: HiitSessionDurationTier;
  label: string;
  detail: string;
}[] = [
  {
    value: 'micro_dose',
    label: '5 min — Neural Sprint',
    detail: 'Focus: anaerobic power; 90–100% effort.',
  },
  {
    value: 'standard_interval',
    label: '15 min — Lactic Threshold Engine',
    detail: 'Focus: work capacity; RPE 7–8.',
  },
  {
    value: 'high_volume',
    label: '20 min — Aerobic Power Build',
    detail: 'Focus: mitochondrial efficiency; 60–75% effort.',
  },
];

export interface AmrapDensityArchitectureProps {
  sessionDurationTier: HiitSessionDurationTier;
  onSessionDurationTierChange: (tier: HiitSessionDurationTier) => void;
}

const AmrapDensityArchitecture: React.FC<AmrapDensityArchitectureProps> = ({
  sessionDurationTier,
  onSessionDurationTierChange,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="font-heading text-lg font-bold text-white">Metabolic architecture</h3>
      <p className="text-sm text-white/65">
        Density-Based AMRAP: fixed repetition targets per station, as many laps as possible in the
        session clock. Primary metric: Total Laps Completed.
      </p>
      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">Session length</label>
        <select
          value={sessionDurationTier}
          onChange={(e) => onSessionDurationTierChange(e.target.value as HiitSessionDurationTier)}
          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-white/55">
          {TIER_OPTIONS.find((t) => t.value === sessionDurationTier)?.detail}
        </p>
      </div>
      <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-white/65">
        <p className="font-medium text-white/80">
          Durations target metabolic pathways and neuromuscular demand—pick the energy system you
          want to stress.
        </p>
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            <span className="text-white/85">5 min — Neural Sprint:</span> Anaerobic power;
            explosive, low-complexity movements; 90–100% effort; highest recovery demand after.
          </li>
          <li>
            <span className="text-white/85">15 min — Lactic Threshold Engine:</span> Work capacity;
            steady RPE 7–8; consistent pacing across laps.
          </li>
          <li>
            <span className="text-white/85">20 min — Aerobic Power Build:</span> Mitochondrial
            efficiency; 60–75% effort; movement quality over speed.
          </li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/15 text-white/55">
                <th className="py-1 pr-2 font-medium">Duration</th>
                <th className="py-1 pr-2 font-medium">Metabolic focus</th>
                <th className="py-1 pr-2 font-medium">Recovery demand</th>
                <th className="py-1 font-medium">Frequency</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr className="border-b border-white/5">
                <td className="py-1.5 pr-2 font-medium text-white/80">5 min</td>
                <td className="py-1.5 pr-2">Anaerobic glycolysis</td>
                <td className="py-1.5 pr-2">Very high</td>
                <td className="py-1.5">1–2× / week</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-1.5 pr-2 font-medium text-white/80">15 min</td>
                <td className="py-1.5 pr-2">Lactic threshold</td>
                <td className="py-1.5 pr-2">Moderate</td>
                <td className="py-1.5">2–3× / week</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-2 font-medium text-white/80">20 min</td>
                <td className="py-1.5 pr-2">Aerobic power</td>
                <td className="py-1.5 pr-2">Low to moderate</td>
                <td className="py-1.5">2–4× / week</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-white/50">
          Protocol: AMRAP_DENSITY · Station transition: continuous (no station clocks in
          prescription).
        </p>
      </div>
    </div>
  );
};

export default AmrapDensityArchitecture;
