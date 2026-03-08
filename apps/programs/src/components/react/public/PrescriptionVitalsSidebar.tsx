/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared prescription vitals sidebar: Zone, Experience, Injuries, optional Conditions,
 * Goals, optional Days per week, and optional medical disclaimer. Used by Exercise and
 * Program Prescription Engines.
 */

import React from 'react';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'any';

/** Red Light injury pills by region (head to toe). Pill id = rule injury for matching. */
const INJURY_PILLS_BY_REGION: { group: string; pills: { id: string; label: string }[] }[] = [
  {
    group: 'Spine & Torso',
    pills: [
      { id: 'neck', label: 'Neck' },
      { id: 'upper-back', label: 'Upper Back' },
      { id: 'lower-back', label: 'Lower Back' },
      { id: 'chest-ribs', label: 'Chest / Ribs' },
      { id: 'abdominals', label: 'Abdominals (Core)' },
    ],
  },
  {
    group: 'Upper Body',
    pills: [
      { id: 'shoulder', label: 'Shoulders' },
      { id: 'elbow', label: 'Elbows' },
      { id: 'wrist-hands', label: 'Wrists / Hands' },
    ],
  },
  {
    group: 'Lower Body',
    pills: [
      { id: 'hip-glutes', label: 'Hips / Glutes' },
      { id: 'groin', label: 'Groin' },
      { id: 'thighs', label: 'Thighs (Quads/Hamstrings)' },
      { id: 'knee', label: 'Knees' },
      { id: 'shins-calves', label: 'Shins / Calves' },
      { id: 'ankles-feet', label: 'Ankles / Feet' },
    ],
  },
];

/** Medical Conditions pills (alphabetical by label). Backend: Intensity Modifiers or Hidden Mappers. */
const MEDICAL_CONDITION_PILLS: { id: string; label: string }[] = [
  { id: 'carpal-tunnel', label: 'Carpal Tunnel' },
  { id: 'heart-condition', label: 'Heart Condition' },
  { id: 'herniated-disc', label: 'Herniated Disc' },
  { id: 'high-blood-pressure', label: 'High Blood Pressure' },
  { id: 'obesity-metabolic', label: 'Obesity / Metabolic' },
  { id: 'plantar-fasciitis', label: 'Plantar Fasciitis' },
  { id: 'rotator-cuff-tear', label: 'Rotator Cuff Tear' },
  { id: 'sciatica', label: 'Sciatica' },
  { id: 'tennis-golfers-elbow', label: "Tennis/Golfer's Elbow" },
  { id: 'vertigo-dizziness', label: 'Vertigo / Dizziness' },
];

/** Fitness Goals by category (Look, Do, Feel). Goals only rank the remainder after injury/condition filters. */
const GOALS_BY_CATEGORY: {
  category: string;
  label: string;
  goals: { id: string; label: string }[];
}[] = [
  {
    category: 'aesthetic',
    label: 'Aesthetic & Body Composition',
    goals: [
      { id: 'lose-weight', label: 'Lose Weight / Burn Fat' },
      { id: 'build-muscle', label: 'Build Muscle' },
      { id: 'tone-definition', label: 'Tone & Definition' },
    ],
  },
  {
    category: 'performance',
    label: 'Performance & Capability',
    goals: [
      { id: 'increase-strength', label: 'Increase Strength' },
      { id: 'improve-endurance', label: 'Improve Endurance' },
      { id: 'athleticism-power', label: 'Athleticism & Power' },
    ],
  },
  {
    category: 'health',
    label: 'Health & Longevity',
    goals: [
      { id: 'general-health', label: 'General Health / Maintenance' },
      { id: 'mobility-flexibility', label: 'Mobility & Flexibility' },
      { id: 'core-stability-posture', label: 'Core Stability & Posture' },
    ],
  },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const WEEKS_OPTIONS = [6, 8, 12] as const;

const BLOCK_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'main', label: 'Main Workout' },
  { value: 'finisher', label: 'Finisher' },
  { value: 'core', label: 'Core' },
  { value: 'cooldown', label: 'Cooldown' },
];

const MAIN_WORKOUT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hiit', label: 'HIIT' },
];

export interface PrescriptionVitalsSidebarProps {
  zones: { id: string; name: string }[];
  selectedZone: string;
  onZoneChange: (zoneId: string) => void;
  selectedExperience: ExperienceLevel;
  onExperienceChange: (experience: ExperienceLevel) => void;
  injuries: string[];
  onToggleInjury: (id: string) => void;
  goals: string[];
  onToggleGoal: (id: string) => void;
  /** When both provided, render the Days per week slider (programs only). */
  daysPerWeek?: number;
  onDaysPerWeekChange?: (n: number) => void;
  /** When both provided, render the Medical Conditions section (exercises only). */
  conditions?: string[];
  onToggleCondition?: (id: string) => void;
  /** When injuries or conditions are selected and not acknowledged, show disclaimer modal if both provided. */
  disclaimerAcknowledged?: boolean;
  onDisclaimerAcknowledge?: () => void;
  /** When both provided, render the Weeks section (6, 8, 12) for programs only. */
  selectedWeeks?: number[];
  onToggleWeek?: (weeks: number) => void;
  /** Exercises only: Workout block filter. */
  selectedBlock?: string;
  onBlockChange?: (block: string) => void;
  /** Exercises only: Main workout type (when block is "main"). */
  selectedMainWorkoutType?: string;
  onMainWorkoutTypeChange?: (type: string) => void;
}

const PrescriptionVitalsSidebar: React.FC<PrescriptionVitalsSidebarProps> = ({
  zones,
  selectedZone,
  onZoneChange,
  selectedExperience,
  onExperienceChange,
  injuries,
  onToggleInjury,
  goals,
  onToggleGoal,
  daysPerWeek,
  onDaysPerWeekChange,
  conditions,
  onToggleCondition,
  disclaimerAcknowledged = false,
  onDisclaimerAcknowledge,
  selectedWeeks,
  onToggleWeek,
  selectedBlock = '',
  onBlockChange,
  selectedMainWorkoutType = '',
  onMainWorkoutTypeChange,
}) => {
  const showDisclaimerModal =
    (injuries.length > 0 || (conditions?.length ?? 0) > 0) &&
    !disclaimerAcknowledged &&
    typeof onDisclaimerAcknowledge === 'function';

  return (
    <>
      {showDisclaimerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-title"
        >
          <div className="max-w-md rounded-2xl border border-white/10 bg-bg-dark p-6 shadow-2xl">
            <h2
              id="disclaimer-title"
              className="mb-4 font-heading text-lg font-bold uppercase tracking-wider text-white"
            >
              Important – Please read
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-white/80">
              We have filtered out exercises that we know to be unsafe for your stated injuries or
              conditions. This does <strong>not</strong> mean the remaining exercises are safe for
              you or that you are cleared for exercise. If you have any of these conditions, consult
              a medical professional before starting an exercise program.
            </p>
            <button
              type="button"
              onClick={onDisclaimerAcknowledge}
              className="w-full rounded-lg bg-orange-light px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-black transition hover:bg-white"
            >
              I understand
            </button>
          </div>
        </div>
      )}

      <aside className="space-y-6 rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white/90">
          Your Vitals
        </h2>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
            Equipment / Zone
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onZoneChange('')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                !selectedZone
                  ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
              }`}
            >
              Any
            </button>
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => onZoneChange(z.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  selectedZone === z.id
                    ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                    : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                }`}
              >
                {z.name}
              </button>
            ))}
          </div>
        </div>

        {typeof daysPerWeek === 'number' && typeof onDaysPerWeekChange === 'function' && (
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
              Days per week
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={2}
                max={6}
                value={daysPerWeek}
                onChange={(e) => onDaysPerWeekChange(Number(e.target.value))}
                className="h-2 w-full appearance-none rounded-full bg-white/10 accent-orange-light"
              />
              <span className="w-8 font-mono text-sm font-bold text-orange-light">
                {daysPerWeek}
              </span>
            </div>
          </div>
        )}

        {selectedWeeks != null && typeof onToggleWeek === 'function' && (
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
              Weeks
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKS_OPTIONS.map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => onToggleWeek(weeks)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selectedWeeks.includes(weeks)
                      ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                  }`}
                >
                  {weeks}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
            Experience
          </label>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onExperienceChange(opt.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  selectedExperience === opt.value
                    ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                    : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {typeof onBlockChange === 'function' && (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
                Workout Block
              </label>
              <div className="flex flex-wrap gap-2">
                {BLOCK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || 'any'}
                    type="button"
                    onClick={() => onBlockChange(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      selectedBlock === opt.value
                        ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {selectedBlock === 'main' && typeof onMainWorkoutTypeChange === 'function' && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
                  Main Workout Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {MAIN_WORKOUT_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || 'any'}
                      type="button"
                      onClick={() => onMainWorkoutTypeChange(opt.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        selectedMainWorkoutType === opt.value
                          ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                          : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div>
          <p className="mb-2 text-xs text-white/70">
            Tap the body part where you have an acute injury or pain. We will hide exercises that
            directly load these areas.
          </p>
          {INJURY_PILLS_BY_REGION.map(({ group, pills }) => (
            <div key={group} className="mb-3">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/50">
                {group}
              </span>
              <div className="flex flex-wrap gap-2">
                {pills.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggleInjury(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      injuries.includes(p.id)
                        ? 'border-red-500/50 bg-red-500/20 text-red-300'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {conditions != null && typeof onToggleCondition === 'function' && (
          <div>
            <p className="mb-2 text-xs text-white/70">
              Select any diagnosed medical conditions you have. We will adjust your exercises to
              ensure safety and prevent unnecessary strain.
            </p>
            <div className="flex flex-wrap gap-2">
              {MEDICAL_CONDITION_PILLS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggleCondition(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    conditions.includes(p.id)
                      ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs text-white/70">
            Goals only affect ranking of exercises that pass your injury and condition filters.
          </p>
          {GOALS_BY_CATEGORY.map(({ category, label, goals: categoryGoals }) => (
            <div key={category} className="mb-3">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/50">
                {label}
              </span>
              <div className="flex flex-wrap gap-2">
                {categoryGoals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onToggleGoal(g.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      goals.includes(g.id)
                        ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

export default PrescriptionVitalsSidebar;
