/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChallengeBlueprintEditor - Edit challenge schedule + milestones.
 * Wraps ProgramBlueprintEditor for schedule editing and adds milestones section.
 */

import React, { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ChallengeTemplate, ChallengeMilestone } from '@/types/ai-challenge';
import type { ProgramTemplate } from '@/types/ai-program';
import ProgramBlueprintEditor from './ProgramBlueprintEditor';
import ChallengeImagesPanel from './ChallengeImagesPanel';

interface ChallengeBlueprintEditorProps {
  initialData: ChallengeTemplate;
  onSave: (data: ChallengeTemplate) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  challengeId?: string;
  heroImageUrl?: string;
  sectionImages?: Record<string, string>;
  onImagesUpdate?: () => void;
}

const ChallengeBlueprintEditor: React.FC<ChallengeBlueprintEditorProps> = ({
  initialData,
  onSave,
  onCancel,
  onDirtyChange,
  challengeId,
  heroImageUrl,
  sectionImages,
  onImagesUpdate,
}) => {
  const [milestones, setMilestones] = useState<ChallengeMilestone[]>(
    initialData.milestones?.length ? [...initialData.milestones] : []
  );
  const [scheduleDirty, setScheduleDirty] = useState(false);

  const programAsTemplate: ProgramTemplate = {
    title: initialData.title,
    description: initialData.description,
    difficulty: initialData.difficulty,
    durationWeeks: initialData.durationWeeks,
    schedule: initialData.schedule,
  };

  const baselineMilestonesStr = JSON.stringify(
    initialData.milestones?.length ? initialData.milestones : []
  );
  const milestonesDirty = JSON.stringify(milestones) !== baselineMilestonesStr;

  const isDirty = scheduleDirty || milestonesDirty;

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setScheduleDirty(dirty);
  }, []);

  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSaveFromProgram = useCallback(
    async (program: ProgramTemplate) => {
      const challenge: ChallengeTemplate = {
        ...program,
        theme: initialData.theme,
        tagline: initialData.tagline,
        milestones,
      };
      await onSave(challenge);
    },
    [milestones, initialData.theme, initialData.tagline, onSave]
  );

  const addMilestone = () => {
    const maxWeek = initialData.durationWeeks || 4;
    const lastWeek = milestones.length > 0 ? Math.max(...milestones.map((m) => m.week)) : 0;
    const nextWeek = Math.min(lastWeek + 1, maxWeek) || 1;
    setMilestones((prev) => [
      ...prev,
      { week: nextWeek, label: 'New Milestone', checkInPrompt: '' },
    ]);
  };

  const updateMilestone = (
    index: number,
    field: keyof ChallengeMilestone,
    value: string | number
  ) => {
    setMilestones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Milestones Section */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-white">Milestones</h3>
          <button
            type="button"
            onClick={addMilestone}
            className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
            Add Milestone
          </button>
        </div>
        <p className="mb-4 text-sm text-white/60">
          Check-in points for users (e.g. Form Check, Halfway, Final Push)
        </p>
        {milestones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/20 py-6 text-center text-sm text-white/50">
            No milestones. Add one to encourage user check-ins.
          </p>
        ) : (
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <div
                key={i}
                className="flex flex-wrap items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
              >
                <div className="min-w-[80px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-white/60">Week</label>
                  <input
                    type="number"
                    min={1}
                    max={initialData.durationWeeks || 6}
                    value={m.week}
                    onChange={(e) => updateMilestone(i, 'week', parseInt(e.target.value, 10) || 1)}
                    className="focus:border-orange-light/50 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="min-w-[120px] flex-[2]">
                  <label className="mb-1 block text-xs font-medium text-white/60">Label</label>
                  <input
                    type="text"
                    value={m.label}
                    onChange={(e) => updateMilestone(i, 'label', e.target.value)}
                    className="focus:border-orange-light/50 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="e.g. Halfway"
                  />
                </div>
                <div className="min-w-[180px] flex-[3]">
                  <label className="mb-1 block text-xs font-medium text-white/60">
                    Check-in Prompt (optional)
                  </label>
                  <input
                    type="text"
                    value={m.checkInPrompt || ''}
                    onChange={(e) => updateMilestone(i, 'checkInPrompt', e.target.value)}
                    className="focus:border-orange-light/50 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    placeholder="Reflection question for the user"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeMilestone(i)}
                  className="mt-6 rounded p-2 text-white/60 transition-colors hover:bg-red-500/20 hover:text-red-300"
                  title="Remove milestone"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {challengeId && (
        <ChallengeImagesPanel
          challengeId={challengeId}
          challengeTitle={initialData.title}
          challengeTheme={initialData.theme}
          heroImageUrl={heroImageUrl}
          sectionImages={sectionImages}
          onUpdate={onImagesUpdate ?? (() => {})}
        />
      )}

      {/* Schedule Editor (reuse ProgramBlueprintEditor) */}
      <ProgramBlueprintEditor
        initialData={programAsTemplate}
        onSave={handleSaveFromProgram}
        onCancel={onCancel}
        onDirtyChange={handleDirtyChange}
      />
    </div>
  );
};

export default ChallengeBlueprintEditor;
