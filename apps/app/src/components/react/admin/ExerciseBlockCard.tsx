/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Displays a single configured exercise (sets, reps, RPE, rest, notes).
 * Optional "View mapped exercise" button when onViewMapped is provided (matches Program Editor).
 */

import React from 'react';
import { Link2, Pencil, Trash2, ExternalLink, Sparkles, CheckCircle } from 'lucide-react';
import type { Exercise } from '@/types/ai-program';

/** Format rest duration in seconds for display: seconds when < 60, else minutes (and optional seconds). */
function formatRestDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export interface ExerciseBlockCardProps {
  block: Exercise;
  onEdit?: () => void;
  onLink?: () => void;
  onRemove?: () => void;
  onViewMapped?: () => void;
  onGenerate?: () => void;
  /** When provided, shows editable "Link" input for exerciseQuery (map to approved exercise). */
  onExerciseQueryChange?: (value: string) => void;
  readOnly?: boolean;
  /** When set (e.g. from workout exerciseOverrides with images), shows generated-image indicator. */
  override?: { name?: string; images?: string[]; instructions?: string[] } | null;
}

const ExerciseBlockCard: React.FC<ExerciseBlockCardProps> = ({
  block,
  onEdit,
  onLink,
  onRemove,
  onViewMapped,
  onGenerate,
  onExerciseQueryChange,
  readOnly = false,
  override,
}) => {
  const hasName = !!block.exerciseName?.trim();
  const hasOverrideImage = !!override?.images?.[0];
  const statusBorder = !hasName
    ? 'border-yellow-500/50 bg-yellow-500/10'
    : 'border-white/5 bg-black/10';

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${statusBorder}`}
      data-exercise-block-card
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
        {block.order}
      </span>
      {hasOverrideImage && override?.images?.[0] && (
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-white/10 bg-black/20">
          <img
            src={override.images[0]}
            alt={
              override?.name
                ? `Generated image for ${override.name}`
                : block.exerciseName
                  ? `Generated image for ${block.exerciseName}`
                  : 'Generated exercise image'
            }
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {!hasName ? (
          <span className="text-sm text-white/40">Exercise not specified</span>
        ) : (
          <>
            <div className="flex items-center gap-2 font-medium text-white">
              {block.exerciseName}
              {hasOverrideImage && (
                <span title="Generated image saved to workout">
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-400" aria-hidden />
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-white/60">
              {block.workSeconds != null && block.restSeconds != null && block.rounds != null ? (
                <span>
                  {block.workSeconds}s work / {formatRestDuration(block.restSeconds)} rest ×{' '}
                  {block.rounds} rounds
                </span>
              ) : (
                <>
                  <span>{block.sets ?? 0} sets</span>
                  <span>{block.reps ?? ''} reps</span>
                  {block.rpe != null && <span>RPE {block.rpe}</span>}
                  {block.restSeconds != null && (
                    <span>{formatRestDuration(block.restSeconds)} rest</span>
                  )}
                </>
              )}
            </div>
            {onExerciseQueryChange != null && (
              <div className="mt-1.5">
                <label className="mb-0.5 block text-xs text-white/50">Link</label>
                <input
                  type="text"
                  value={block.exerciseQuery ?? ''}
                  onChange={(e) => onExerciseQueryChange(e.target.value)}
                  placeholder="e.g. bench press"
                  title="Map to approved exercise"
                  className="w-full min-w-0 rounded border-b border-transparent border-white/10 bg-transparent px-1 py-0.5 text-sm text-white/80 transition-colors placeholder:text-white/40 focus:border-[#ffbf00]/50 focus:bg-black/20 focus:outline-none"
                />
              </div>
            )}
            {block.coachNotes != null && block.coachNotes.trim() !== '' && (
              <p className="mt-1 text-xs italic text-white/50">{block.coachNotes}</p>
            )}
          </>
        )}
      </div>
      {!readOnly &&
        (onEdit != null ||
          onLink != null ||
          onViewMapped != null ||
          onGenerate != null ||
          onRemove != null) && (
          <div className="flex shrink-0 gap-1">
            {onEdit != null && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Edit exercise"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onLink != null && (
              <button
                type="button"
                onClick={onLink}
                className="rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Link exercise"
              >
                <Link2 className="h-4 w-4" />
              </button>
            )}
            {onGenerate != null && (
              <button
                type="button"
                onClick={onGenerate}
                className="rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                title="Generate with Visualization Lab"
                aria-label="Generate with Visualization Lab"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
            {onViewMapped != null && (
              <button
                type="button"
                onClick={onViewMapped}
                className="shrink-0 rounded border border-[#ffbf00]/50 bg-[#ffbf00]/10 p-1.5 text-[#ffbf00] transition-colors hover:bg-[#ffbf00]/20"
                title="View mapped exercise"
                aria-label="View mapped exercise"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            {onRemove != null && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded p-1 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-300"
                aria-label="Remove exercise"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
    </div>
  );
};

export default ExerciseBlockCard;
