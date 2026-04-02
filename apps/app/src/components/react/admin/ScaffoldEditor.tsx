/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Editable program scaffold: phases (name, weeks, focus, instructions).
 * Save scaffold to server; Build Phase 1..N or Build all phases.
 */

import { useState } from 'react';
import type { ProgramTemplateScaffold, PhaseScaffold } from '@/types/ai-program';

interface ScaffoldEditorProps {
  scaffold: ProgramTemplateScaffold;
  programId: string;
  durationWeeks: number;
  onUpdate: (scaffold: ProgramTemplateScaffold) => void;
  onSaveScaffold: (scaffold: ProgramTemplateScaffold) => Promise<void>;
  onBuildPhase: (phaseIndex: number) => Promise<void>;
  onBuildAllPhases: () => Promise<void>;
  onBack: () => void;
  loading: boolean;
  buildingPhaseIndex: number | null;
}

export default function ScaffoldEditor({
  scaffold,
  durationWeeks,
  onUpdate,
  onSaveScaffold,
  onBuildPhase,
  onBuildAllPhases,
  onBack,
  loading,
  buildingPhaseIndex,
}: ScaffoldEditorProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sumWeeks = scaffold.phases.reduce((s, p) => s + p.weeks, 0);
  const isValid = sumWeeks === durationWeeks && scaffold.phases.every((p) => p.weeks >= 1);

  const handlePhaseChange = (index: number, field: keyof PhaseScaffold, value: string | number) => {
    const next = { ...scaffold };
    const phase = { ...next.phases[index] };
    if (field === 'weeks') phase.weeks = Math.max(1, value as number);
    else (phase as Record<string, unknown>)[field] = value;
    next.phases = [...next.phases];
    next.phases[index] = phase;
    next.totalWeeks = next.phases.reduce((s, p) => s + p.weeks, 0);
    onUpdate(next);
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaveError(null);
    setSaving(true);
    try {
      await onSaveScaffold(scaffold);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save scaffold');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/70">
        Edit phases below. Total weeks must equal {durationWeeks}. Then build each phase (or build
        all) to generate workouts.
      </p>

      {saveError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {saveError}
        </div>
      )}

      <div className="space-y-4">
        {scaffold.phases.map((phase, index) => (
          <div
            key={phase.phaseIndex}
            className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <div className="font-medium text-white">
              Phase {phase.phaseIndex}: {phase.name}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/60">Name</label>
                <input
                  type="text"
                  value={phase.name}
                  onChange={(e) => handlePhaseChange(index, 'name', e.target.value)}
                  className="focus:border-orange-light/50 focus:ring-orange-light/30 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Weeks</label>
                <input
                  type="number"
                  min={1}
                  value={phase.weeks}
                  onChange={(e) =>
                    handlePhaseChange(index, 'weeks', parseInt(e.target.value, 10) || 1)
                  }
                  className="focus:border-orange-light/50 focus:ring-orange-light/30 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Focus</label>
              <input
                type="text"
                value={phase.focus}
                onChange={(e) => handlePhaseChange(index, 'focus', e.target.value)}
                className="focus:border-orange-light/50 focus:ring-orange-light/30 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1"
                placeholder="e.g. Build work capacity"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Instructions (optional)</label>
              <input
                type="text"
                value={phase.instructions ?? ''}
                onChange={(e) => handlePhaseChange(index, 'instructions', e.target.value)}
                className="focus:border-orange-light/50 focus:ring-orange-light/30 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1"
                placeholder="e.g. Emphasize technique; higher reps"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-white/60">Total weeks:</span>
        <span className={sumWeeks === durationWeeks ? 'text-green-400' : 'text-amber-400'}>
          {sumWeeks} {sumWeeks !== durationWeeks ? `(should be ${durationWeeks})` : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
        >
          Back to config
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || saving || loading}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save scaffold'}
        </button>
        {scaffold.phases.map((p) => (
          <button
            key={p.phaseIndex}
            type="button"
            onClick={() => onBuildPhase(p.phaseIndex)}
            disabled={loading || buildingPhaseIndex !== null}
            className="bg-orange-light/20 hover:bg-orange-light/30 rounded-lg px-4 py-2 text-sm font-medium text-orange-light disabled:opacity-50"
          >
            {buildingPhaseIndex === p.phaseIndex ? 'Building...' : `Build Phase ${p.phaseIndex}`}
          </button>
        ))}
        <button
          type="button"
          onClick={onBuildAllPhases}
          disabled={loading || buildingPhaseIndex !== null}
          className="hover:bg-orange-light/90 rounded-lg bg-orange-light px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {buildingPhaseIndex !== null ? 'Building...' : 'Build all phases'}
        </button>
      </div>
    </div>
  );
}
