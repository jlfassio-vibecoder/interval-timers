/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Info, Sparkles, Globe, GlobeLock, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchFullProgram,
  fetchProgramMetadata,
  fetchScaffold,
  updateProgram,
} from '@/lib/supabase/client/program-persistence';
import { saveWorkoutToLibrary } from '@/lib/supabase/client/workout-persistence';
import { programWorkoutToWorkoutSet } from '@/lib/program-workout-extract';
import { supabase } from '@/lib/supabase/client';
import type {
  ProgramTemplate,
  ProgramConfig,
  ProgramSchedule,
  ProgramTemplateScaffold,
  ProgramPersona,
  PromptChainMetadata,
} from '@/types/ai-program';
import { useAppContext } from '@/contexts/AppContext';
import ScheduleBuilder from '../ScheduleBuilder';
import ProgramGeneratorModal from '../ProgramGeneratorModal';

const DEFAULT_TARGET_AUDIENCE = {
  ageRange: '26-35',
  sex: 'Male',
  weight: 180,
  experienceLevel: 'intermediate' as const,
};

function durationWeeksToRequirement(n: number): 6 | 8 | 12 {
  if (n <= 6) return 6;
  if (n <= 8) return 8;
  return 12;
}

const ProgramEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppContext();

  const [programData, setProgramData] = useState<ProgramTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>(
    'intermediate'
  );
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [scaffold, setScaffold] = useState<ProgramTemplateScaffold | null>(null);
  const [buildingPhaseIndex, setBuildingPhaseIndex] = useState<number | null>(null);
  const [generatingPublicCopy, setGeneratingPublicCopy] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [featuredOnLanding, setFeaturedOnLanding] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [extractingWorkout, setExtractingWorkout] = useState(false);

  const handleEditWorkoutInFactory = useCallback(
    async (
      weekNumber: number,
      workoutIndex: number,
      workout: ProgramSchedule['workouts'][number]
    ) => {
      if (!id || !user?.uid) {
        toast.error('You must be logged in to edit workouts.');
        return;
      }
      setExtractingWorkout(true);
      try {
        const { workoutSet, workoutConfig } = programWorkoutToWorkoutSet(workout);
        const workoutId = await saveWorkoutToLibrary(
          workoutSet,
          workoutConfig,
          undefined
        );
        navigate(`/workouts/${workoutId}`, {
          state: { fromProgram: { programId: id, weekNumber, workoutIndex } },
        });
        toast.success('Workout extracted to Workout Factory.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to extract workout');
      } finally {
        setExtractingWorkout(false);
      }
    },
    [id, user?.uid, navigate]
  );

  const loadProgram = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [data, scaffoldData, meta] = await Promise.all([
        fetchFullProgram(id),
        fetchScaffold(id).catch(() => null),
        fetchProgramMetadata(id).catch(() => null),
      ]);
      setProgramData(data);
      setIsPublished(meta?.status === 'published');
      setFeaturedOnLanding(meta?.featuredOnLanding ?? false);
      setTitle(data.title);
      setDescription(data.description ?? '');
      setDifficulty(
        data.difficulty === 'beginner' || data.difficulty === 'intermediate' || data.difficulty === 'advanced'
          ? data.difficulty
          : 'intermediate'
      );
      setDurationWeeks(data.durationWeeks ?? 4);
      setScaffold(scaffoldData ?? null);
    } catch (err) {
      console.error('[ProgramEditor] Failed to load:', err);
      setError('Failed to load program. It may not exist or you lack permission.');
      toast.error('Failed to load program.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadProgram();
  }, [id, loadProgram]);

  const handleScheduleChange = useCallback((schedule: ProgramSchedule[]) => {
    setProgramData((prev) => (prev ? { ...prev, schedule } : null));
  }, []);

  const programConfigForModal: ProgramConfig = {
    programInfo: { title, description },
    targetAudience: DEFAULT_TARGET_AUDIENCE,
    requirements: { durationWeeks: durationWeeksToRequirement(durationWeeks) },
    goals: { primary: 'Muscle Gain', secondary: 'Strength' },
  };

  const handleGenerate = useCallback(
    (updated: Omit<ProgramTemplate, 'id' | 'createdAt'>, savedProgramId?: string) => {
      setProgramData((prev) => (prev ? { ...prev, ...updated } : null));
      if (savedProgramId && savedProgramId === id) {
        toast.success('Program updated.');
      }
      setGeneratorOpen(false);
    },
    [id]
  );

  const buildPersonaForPhase = useCallback(async (): Promise<ProgramPersona> => {
    const meta = id ? await fetchProgramMetadata(id) : null;
    const config = meta?.equipmentProfile;
    return {
      title,
      description,
      demographics: meta?.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
      medical: { injuries: '', conditions: '' },
      goals: meta?.goals ?? { primary: 'Muscle Gain', secondary: 'Strength' },
      zoneId: config?.zoneId,
      selectedEquipmentIds: config?.equipmentIds,
      durationWeeks,
      daysPerWeek: programConfigForModal.requirements.daysPerWeek,
    };
  }, [id, title, description, durationWeeks, programConfigForModal.requirements.daysPerWeek]);

  const handleGeneratePublicCopy = useCallback(async () => {
    if (!id) return;
    const schedule = programData?.schedule ?? [];
    if (!schedule.length) {
      toast.error('Add workouts to the program before generating public copy.');
      return;
    }
    setGeneratingPublicCopy(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch('/api/ai/generate-public-copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ programId: id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to generate public copy');
      }
      const data = (await response.json()) as { title: string; description: string };
      setTitle(data.title);
      setDescription(data.description);
      toast.success('Public title and description generated. Edit if needed, then save.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate public copy');
    } finally {
      setGeneratingPublicCopy(false);
    }
  }, [id, programData?.schedule?.length]);

  const handleBuildPhase = useCallback(
    async (phaseIndex: number) => {
      if (!id || !scaffold) return;
      setBuildingPhaseIndex(phaseIndex);
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const persona = await buildPersonaForPhase();
        const response = await fetch('/api/ai/build-phase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            programId: id,
            phaseIndex,
            persona,
            previousPhaseWorkouts: programData?.schedule ?? [],
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? 'Failed to build phase');
        }
        const data = await fetchFullProgram(id);
        setProgramData(data);
        toast.success(`Phase ${phaseIndex} built`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to build phase');
      } finally {
        setBuildingPhaseIndex(null);
      }
    },
    [id, scaffold, buildPersonaForPhase, programData?.schedule]
  );

  const handlePublishToggle = useCallback(async () => {
    if (!id) return;
    const nextStatus = isPublished ? 'draft' : 'published';
    setPublishLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/admin/programs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to update status');
      }
      setIsPublished(nextStatus === 'published');
      toast.success(nextStatus === 'published' ? 'Program published.' : 'Program unpublished.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setPublishLoading(false);
    }
  }, [id, isPublished]);

  const handleFeaturedToggle = useCallback(async () => {
    if (!id) return;
    const next = !featuredOnLanding;
    setFeaturedLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/admin/programs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ featured_on_landing: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to update');
      }
      setFeaturedOnLanding(next);
      toast.success(next ? 'Featured on homepage.' : 'Removed from homepage.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setFeaturedLoading(false);
    }
  }, [id, featuredOnLanding]);

  const handleSave = async () => {
    if (!id || !user?.uid || !programData) return;
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const updatedData: ProgramTemplate = {
        ...programData,
        title,
        description,
        difficulty,
        durationWeeks,
      };

      const programConfig: ProgramConfig = {
        programInfo: { title, description },
        targetAudience: DEFAULT_TARGET_AUDIENCE,
        requirements: {
          durationWeeks: durationWeeksToRequirement(durationWeeks),
        },
        goals: { primary: 'Muscle Gain', secondary: 'Strength' },
      };

      await updateProgram(id, updatedData, programConfig, user.uid);

      setProgramData(updatedData);
      setSaveSuccess(true);
      toast.success('Program saved successfully.');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[ProgramEditor] Save failed:', err);
      setError('Failed to save changes.');
      toast.error('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
        <span className="ml-3 text-white/60">Loading Program...</span>
      </div>
    );
  }

  if (error || !programData) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/programs')}
          className="flex items-center gap-2 text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-red-300">
          <h2 className="mb-2 text-lg font-bold">Error</h2>
          <p>{error || 'Program not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/programs')}
            className="rounded-full bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Program</h1>
            <p className="text-sm text-white/40">ID: {id}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleFeaturedToggle}
            disabled={featuredLoading}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 font-medium transition-colors disabled:opacity-50 ${
              featuredOnLanding
                ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
            }`}
            title={featuredOnLanding ? 'Remove from homepage' : 'Feature on homepage'}
          >
            {featuredLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Star className={`h-5 w-5 ${featuredOnLanding ? 'fill-orange-light' : ''}`} />
            )}
            {featuredLoading ? 'Updating...' : featuredOnLanding ? 'Featured' : 'Feature on Homepage'}
          </button>
          <button
            type="button"
            onClick={handlePublishToggle}
            disabled={publishLoading}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
            title={isPublished ? 'Unpublish (remove from programs landing)' : 'Publish (show on programs landing)'}
          >
            {publishLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPublished ? (
              <GlobeLock className="h-5 w-5" />
            ) : (
              <Globe className="h-5 w-5" />
            )}
            {publishLoading ? 'Updating...' : isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={() => setGeneratorOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-orange-light/50 bg-orange-light/10 px-4 py-2.5 font-medium text-orange-light transition-colors hover:bg-orange-light/20"
            title="Open AI program editor (scaffold, phases)"
          >
            <Sparkles className="h-5 w-5" />
            Edit with AI
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2.5 font-bold text-black transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-400">
          Program saved successfully!
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-6 backdrop-blur-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <Info className="h-4 w-4 text-orange-light" />
              Basic Info
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Program Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none transition-colors"
                  placeholder="e.g. Hypertrophy Phase 1"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="focus:border-orange-light/50 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none transition-colors"
                  placeholder="Describe the goals and methodology..."
                />
                <button
                  type="button"
                  onClick={handleGeneratePublicCopy}
                  disabled={generatingPublicCopy || !(programData?.schedule?.length ?? 0)}
                  title="AI will write a public-facing title and phase-by-phase description based on the finished program."
                  className="mt-2 flex items-center gap-2 rounded-lg border border-orange-light/30 bg-orange-light/10 px-3 py-2 text-sm font-medium text-orange-light transition-colors hover:bg-orange-light/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPublicCopy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generatingPublicCopy ? 'Generating...' : 'Generate Public Title & Description'}
                </button>
                <p className="mt-1 text-xs text-white/50">
                  Writes a public-facing title and description with phase breakdown from the finished program.
                </p>
              </div>
            </div>
          </div>

          <ScheduleBuilder
            programId={id!}
            schedule={programData.schedule ?? []}
            durationWeeks={durationWeeks}
            onScheduleChange={handleScheduleChange}
            onEditWorkout={extractingWorkout ? undefined : handleEditWorkoutInFactory}
          />
        </div>

        <div className="space-y-6">
          {scaffold && (
            <div className="rounded-2xl border border-orange-light/20 bg-orange-light/5 p-6 backdrop-blur-sm">
              <h2 className="mb-2 text-lg font-bold">Rebuild phases</h2>
              <p className="mb-4 text-sm text-white/60">
                This program has a scaffold. Rebuild a phase to regenerate its workouts with AI.
              </p>
              <div className="flex flex-wrap gap-2">
                {scaffold.phases.map((p) => (
                  <button
                    key={p.phaseIndex}
                    type="button"
                    onClick={() => handleBuildPhase(p.phaseIndex)}
                    disabled={buildingPhaseIndex !== null}
                    className="rounded-lg border border-orange-light/30 bg-orange-light/10 px-4 py-2 text-sm font-medium text-orange-light hover:bg-orange-light/20 disabled:opacity-50"
                  >
                    {buildingPhaseIndex === p.phaseIndex
                      ? 'Building...'
                      : `Build Phase ${p.phaseIndex} (${p.weeks}w)`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-bold">Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')
                  }
                  className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Duration (Weeks)
                </label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(parseInt(e.target.value, 10) || 4)}
                  className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProgramGeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={handleGenerate}
        existingProgram={programData}
        programConfig={programConfigForModal}
        editingProgramId={id ?? undefined}
        editingChainMetadata={(programData as { chain_metadata?: PromptChainMetadata })?.chain_metadata}
      />
    </div>
  );
};

export default ProgramEditor;
