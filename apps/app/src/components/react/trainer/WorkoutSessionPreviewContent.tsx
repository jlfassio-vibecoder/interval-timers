/**
 * Read-only session preview (matches Workout Factory Review step: timer vs sets/reps).
 */

import React from 'react';
import type { WorkoutInSet } from '@/types/ai-workout';

export interface WorkoutSessionPreviewContentProps {
  w: WorkoutInSet;
  headingLevel?: 'h3' | 'h4';
}

const WorkoutSessionPreviewContent: React.FC<WorkoutSessionPreviewContentProps> = ({
  w,
  headingLevel = 'h4',
}) => {
  const TitleTag = headingLevel;
  return (
    <>
      <TitleTag className="font-medium text-white">{w.title}</TitleTag>
      <p className="mt-1 text-sm text-white/60">{w.description}</p>

      {(w.warmupBlocks ?? []).length > 0 && (
        <div className="mt-3">
          <h5 className="text-sm font-medium text-white/80">Warmup</h5>
          <ul className="mt-1 space-y-1 text-sm text-white/70">
            {(w.warmupBlocks ?? []).map((item, i) => (
              <li key={i}>
                {item.exerciseName}
                {Array.isArray(item.instructions) && item.instructions.length > 0 && (
                  <span className="text-white/50"> — {item.instructions.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(w.exerciseBlocks ?? []).length > 0 ? (
        <div className="mt-3">
          {(w.exerciseBlocks ?? []).map((block, bIdx) => (
            <div key={bIdx} className={bIdx > 0 ? 'mt-3' : ''}>
              <h5 className="text-sm font-medium text-white/80">
                {(block as { name?: string }).name ?? `Block ${bIdx + 1}`}
              </h5>
              <ul className="mt-1 space-y-1 text-sm text-white/70">
                {(block.exercises ?? []).map((ex, i) => {
                  const densityLap =
                    ex.workSeconds == null &&
                    ex.sets === 1 &&
                    ex.reps != null &&
                    String(ex.reps).trim() !== '' &&
                    (ex.restSeconds === 0 || ex.restSeconds == null);
                  return (
                    <li key={i}>
                      {densityLap ? (
                        <>
                          {String(ex.reps)} {ex.exerciseName}
                          <span className="text-white/50">
                            {' '}
                            (once per lap · track Total Laps Completed)
                          </span>
                          {ex.rpe != null ? ` @ RPE ${ex.rpe}` : ''}
                        </>
                      ) : (
                        <>
                          {ex.exerciseName} —{' '}
                          {ex.workSeconds != null && ex.restSeconds != null && ex.rounds != null
                            ? ex.rounds === 1
                              ? `${ex.workSeconds}s station / ${ex.restSeconds}s transition (once per lap)`
                              : `${ex.workSeconds}s station / ${ex.restSeconds}s transition × ${ex.rounds}`
                            : `${ex.sets}×${ex.reps}${ex.rpe != null ? ` @ RPE ${ex.rpe}` : ''}`}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        (w.blocks ?? []).length > 0 && (
          <div className="mt-3">
            <h5 className="text-sm font-medium text-white/80">Main</h5>
            <ul className="mt-1 space-y-1 text-sm text-white/70">
              {(w.blocks ?? []).map((ex, i) => {
                const raw = ex as {
                  exerciseName?: string;
                  sets?: number;
                  reps?: string;
                  workSeconds?: number;
                  restSeconds?: number;
                  rounds?: number;
                };
                const timerSchema =
                  raw.workSeconds != null && raw.restSeconds != null && raw.rounds != null;
                return (
                  <li key={i}>
                    {raw.exerciseName} —{' '}
                    {timerSchema
                      ? raw.rounds === 1
                        ? `${raw.workSeconds}s work / ${raw.restSeconds}s rest (once per lap)`
                        : `${raw.workSeconds}s work / ${raw.restSeconds}s rest × ${raw.rounds} rounds`
                      : `${raw.sets}×${raw.reps}`}
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}

      {(w.finisherBlocks ?? []).length > 0 && (
        <div className="mt-3">
          <h5 className="text-sm font-medium text-white/80">Finisher</h5>
          <ul className="mt-1 space-y-1 text-sm text-white/70">
            {(w.finisherBlocks ?? []).map((item, i) => (
              <li key={i}>
                {item.exerciseName}
                {Array.isArray(item.instructions) && item.instructions.length > 0 && (
                  <span className="text-white/50"> — {item.instructions.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(w.cooldownBlocks ?? []).length > 0 && (
        <div className="mt-3">
          <h5 className="text-sm font-medium text-white/80">Cool down</h5>
          <ul className="mt-1 space-y-1 text-sm text-white/70">
            {(w.cooldownBlocks ?? []).map((item, i) => (
              <li key={i}>
                {item.exerciseName}
                {Array.isArray(item.instructions) && item.instructions.length > 0 && (
                  <span className="text-white/50"> — {item.instructions.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default WorkoutSessionPreviewContent;
