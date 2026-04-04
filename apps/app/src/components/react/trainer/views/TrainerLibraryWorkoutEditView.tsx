/**
 * Mission Control — edit a trainer library workout (public.workouts), with versions and fork flows.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkoutBlock, BlockExercise } from '@/lib/supabase/admin/workout-details';
import { blocksToWorkoutInSet, workoutInSetToBlocks } from '@/lib/admin/workout-editor-map';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import type { WorkoutInSet, WorkoutSetTemplate } from '@/types/ai-workout';
import WorkoutSessionPreviewContent from '@/components/react/trainer/WorkoutSessionPreviewContent';

function normalizeBlocks(raw: unknown): WorkoutBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean) as WorkoutBlock[];
}

/** Ensures block/exercise ids for stable React keys and immutable updates (legacy rows may omit ids). */
function withStableBlockAndExerciseIds(blocks: WorkoutBlock[]): WorkoutBlock[] {
  return blocks.map((b) => ({
    ...b,
    id: b.id ?? crypto.randomUUID(),
    exercises: b.exercises.map((ex) => ({
      ...ex,
      id: ex.id ?? crypto.randomUUID(),
    })),
  }));
}

type TrainerWorkoutApi = {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  difficultyLevel: string | null;
  blocks: unknown;
  source: string;
  visibility: string;
  lineageId: string;
  versionIndex: number;
  workoutSeriesId?: string | null;
  sessionIndex?: number | null;
  rawWorkoutSet?: unknown;
};

const TrainerLibraryWorkoutEditView: React.FC = () => {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineageId, setLineageId] = useState<string | null>(null);
  const [versions, setVersions] = useState<TrainerWorkoutApi[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [difficulty, setDifficulty] = useState('intermediate');
  const [visibility, setVisibility] = useState<'draft' | 'ready' | 'assigned'>('draft');
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [rawPreviewSession, setRawPreviewSession] = useState<WorkoutInSet | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(null);

  const loadWorkoutAndVersions = useCallback(async () => {
    if (!workoutId) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(`/api/trainer/workouts/${encodeURIComponent(workoutId)}`, {
        credentials: 'include',
        headers: { ...auth },
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof raw.error === 'string' ? raw.error : 'Could not load workout');
      }
      const row = raw as TrainerWorkoutApi & { blocks?: unknown };
      setLineageId(row.lineageId);
      setTitle(row.title);
      setDescription(row.description ?? '');
      setDuration(row.durationMinutes ?? 60);
      setDifficulty(row.difficultyLevel ?? 'intermediate');
      if (
        row.visibility === 'draft' ||
        row.visibility === 'ready' ||
        row.visibility === 'assigned'
      ) {
        setVisibility(row.visibility);
      }
      const nb = normalizeBlocks(row.blocks);
      setBlocks(
        withStableBlockAndExerciseIds(
          nb.length > 0 ? nb : workoutInSetToBlocks(undefined)
        )
      );

      const wid =
        typeof row.workoutSeriesId === 'string' && row.workoutSeriesId.trim()
          ? row.workoutSeriesId.trim()
          : null;
      setSeriesId(wid);
      const si = typeof row.sessionIndex === 'number' ? row.sessionIndex : null;
      const rawSet = row.rawWorkoutSet as WorkoutSetTemplate | undefined;
      if (rawSet?.workouts?.length && si != null && si >= 0 && rawSet.workouts[si]) {
        setRawPreviewSession(rawSet.workouts[si] as WorkoutInSet);
      } else {
        setRawPreviewSession(null);
      }

      const vRes = await fetch(
        `/api/trainer/workouts/by-lineage/${encodeURIComponent(row.lineageId)}`,
        { credentials: 'include', headers: { ...auth } }
      );
      const vRaw = await vRes.json().catch(() => ({}));
      if (vRes.ok && Array.isArray((vRaw as { versions?: unknown }).versions)) {
        setVersions((vRaw as { versions: TrainerWorkoutApi[] }).versions);
      } else {
        setVersions([row]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    void loadWorkoutAndVersions();
  }, [loadWorkoutAndVersions]);

  const blocksPayload = useCallback(() => {
    const w = blocksToWorkoutInSet(blocks, undefined, {
      title: title.trim() || 'Workout',
      description: description.trim(),
    });
    return w;
  }, [blocks, title, description]);

  const serializableBlocks = useCallback(() => {
    const w = blocksPayload();
    return workoutInSetToBlocks(w);
  }, [blocksPayload]);

  const handleUpdateThisVersion = async () => {
    if (!workoutId) return;
    setSaving(true);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(`/api/trainer/workouts/${encodeURIComponent(workoutId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          durationMinutes: duration,
          blocks: serializableBlocks(),
          difficultyLevel: difficulty,
          visibility,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'Could not save');
        return;
      }
      toast.success('Workout updated.');
      void loadWorkoutAndVersions();
    } finally {
      setSaving(false);
    }
  };

  const handleFork = async (mode: 'new_lineage' | 'new_version') => {
    if (!workoutId) return;
    setSaving(true);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(`/api/trainer/workouts/${encodeURIComponent(workoutId)}/fork`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title: title.trim(),
          description: description.trim() || null,
          durationMinutes: duration,
          blocks: serializableBlocks(),
          difficultyLevel: difficulty,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'Could not save');
        return;
      }
      const newId = typeof body.id === 'string' ? body.id : null;
      toast.success(mode === 'new_lineage' ? 'Saved as new workout.' : 'Saved as new version.');
      if (newId) {
        navigate(`/workouts/${encodeURIComponent(newId)}/edit`, { replace: true });
      } else {
        void loadWorkoutAndVersions();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExercise = (
    blockIndex: number,
    exerciseIndex: number,
    field: string,
    value: string | number
  ) => {
    setBlocks(
      blocks.map((b, bi) => {
        if (bi !== blockIndex) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex, ei) =>
            ei !== exerciseIndex ? ex : { ...ex, [field]: value }
          ),
        };
      })
    );
  };

  const handleAddExercise = (blockIndex: number) => {
    const newExercise: BlockExercise = {
      id: crypto.randomUUID(),
      name: 'New Exercise',
      sets: 3,
      reps: '10',
      restSeconds: 60,
    };
    setBlocks(
      blocks.map((b, i) =>
        i !== blockIndex ? b : { ...b, exercises: [...b.exercises, newExercise] }
      )
    );
  };

  const handleRemoveExercise = (blockIndex: number, exerciseIndex: number) => {
    setBlocks(
      blocks.map((b, i) =>
        i !== blockIndex
          ? b
          : { ...b, exercises: b.exercises.filter((_, ei) => ei !== exerciseIndex) }
      )
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
      </div>
    );
  }

  if (error || !workoutId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => navigate('/workouts')}
          className="flex items-center gap-2 text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Workouts
        </button>
        <p className="text-red-300">{error ?? 'Missing workout id'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="bg-bg-dark/95 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/workouts')}
            className="rounded-full bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Edit library workout</h1>
            <p className="text-xs text-white/40">{title || 'Untitled'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lineageId && versions.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-white/60">
              Version
              <select
                value={workoutId}
                onChange={(e) => {
                  const id = e.target.value;
                  navigate(`/workouts/${encodeURIComponent(id)}/edit`, { replace: true });
                }}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionIndex}
                    {v.id === workoutId ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="focus:border-orange-light/50 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Duration (min)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
              className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'draft' | 'ready' | 'assigned')}
              className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>
        </div>
      </div>

      {rawPreviewSession && (
        <div className="border-orange-light/25 bg-orange-light/5 rounded-xl border p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase text-orange-light">Generated preview</h2>
            {seriesId ? (
              <NavLink
                to={`/workouts/series/${encodeURIComponent(seriesId)}`}
                className="text-orange-light/90 text-xs font-bold uppercase underline hover:text-orange-light"
              >
                Open series
              </NavLink>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-white/50">
            Unparsed snapshot from Workout Factory (shows timer intervals). Editable blocks below
            may differ where the library format does not store work/rest rounds.
          </p>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <WorkoutSessionPreviewContent w={rawPreviewSession} headingLevel="h4" />
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="border-b border-white/10 pb-2 text-lg font-bold text-white">
          Workout blocks
        </h2>
        {blocks.map((block, blockIndex) => (
          <div
            key={block.id ?? `block-${blockIndex}`}
            className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]/40"
          >
            <div className="flex items-center justify-between bg-white/5 p-3">
              <input
                type="text"
                value={block.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setBlocks(
                    blocks.map((b, bi) => (bi !== blockIndex ? b : { ...b, name: v }))
                  );
                }}
                className="focus:border-orange-light/50 border-b border-transparent bg-transparent font-bold text-white focus:outline-none"
              />
              <span className="rounded bg-white/10 px-2 py-1 text-xs uppercase text-white/50">
                {block.type}
              </span>
            </div>
            <div className="space-y-3 p-4">
              {block.exercises.map((ex, exIndex) => (
                <div
                  key={ex.id ?? `ex-${blockIndex}-${exIndex}`}
                  className="group flex items-start gap-3"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ex.name}
                        onChange={(e) =>
                          handleUpdateExercise(blockIndex, exIndex, 'name', e.target.value)
                        }
                        className="focus:border-orange-light/50 flex-1 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm font-medium text-white outline-none"
                        placeholder="Exercise name"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(blockIndex, exIndex)}
                        className="p-1.5 text-white/20 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <div className="flex items-center gap-1 rounded border border-white/5 bg-white/5 px-2 py-1">
                        <span className="uppercase text-white/40">Sets</span>
                        <input
                          type="number"
                          value={ex.sets}
                          onChange={(e) =>
                            handleUpdateExercise(
                              blockIndex,
                              exIndex,
                              'sets',
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="w-8 bg-transparent text-center font-mono text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-white/5 bg-white/5 px-2 py-1">
                        <span className="uppercase text-white/40">Reps</span>
                        <input
                          type="text"
                          value={ex.reps}
                          onChange={(e) =>
                            handleUpdateExercise(blockIndex, exIndex, 'reps', e.target.value)
                          }
                          className="w-12 bg-transparent text-center font-mono text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-white/5 bg-white/5 px-2 py-1">
                        <span className="uppercase text-white/40">Rest (s)</span>
                        <input
                          type="number"
                          value={ex.restSeconds}
                          onChange={(e) =>
                            handleUpdateExercise(
                              blockIndex,
                              exIndex,
                              'restSeconds',
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="w-10 bg-transparent text-center font-mono text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddExercise(blockIndex)}
                className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-white/10 py-2 text-xs font-bold uppercase tracking-wide text-white/30 transition-colors hover:bg-white/5 hover:text-orange-light"
              >
                <Plus className="h-3 w-3" />
                Add exercise
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setBlocks([
              ...blocks,
              {
                id: crypto.randomUUID(),
                type: 'main',
                name: 'New block',
                order: blocks.length + 1,
                exercises: [],
              },
            ])
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 py-3 font-bold uppercase text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Add block
        </button>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleUpdateThisVersion()}
          className="hover:bg-orange-light/90 flex items-center justify-center gap-2 rounded-lg bg-orange-light px-6 py-3 text-sm font-bold text-black transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Update this version
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleFork('new_version')}
          className="rounded-lg bg-white/10 px-6 py-3 text-sm font-bold uppercase text-white transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          Save as new version
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleFork('new_lineage')}
          className="rounded-lg border border-white/20 px-6 py-3 text-sm font-bold uppercase text-white/90 transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          Save as new workout
        </button>
      </div>
      <p className="text-xs text-white/40">
        Updating overwrites this row (assignments keep pointing here). New version creates another
        row in the same lineage. New workout is a separate card with a new lineage.
      </p>
    </div>
  );
};

export default TrainerLibraryWorkoutEditView;
