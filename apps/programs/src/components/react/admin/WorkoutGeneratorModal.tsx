/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, Play } from 'lucide-react';
import { toast } from 'sonner';
import type {
  WorkoutConfig,
  WorkoutSetTemplate,
  WorkoutPersona,
  WorkoutChainMetadata,
  WorkoutSplitType,
  WorkoutLifestyle,
  BlockOptions,
  HiitOptions,
  HiitProtocolFormat,
  HiitWorkRestRatio,
  HiitCircuitStructure,
  HiitSessionDurationTier,
  HiitPrimaryGoal,
} from '@/types/ai-workout';
import {
  getAllZones,
  getZoneById,
  getAllEquipmentItems,
  type Zone,
} from '@/lib/supabase/client/equipment';
import { saveWorkoutToLibrary, updateWorkout } from '@/lib/supabase/client/workout-persistence';
import { useAppContext } from '@/contexts/AppContext';
import { isHIITWorkout, workoutInSetToHIITWorkoutData } from '@/lib/hiit-workout-data';
import IntervalTimerOverlay from '../interval-timers/IntervalTimerOverlay';

type Step = 'config' | 'preview';
type WorkoutSetType = 'single' | 'split';

interface WorkoutGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
  existingWorkout?: WorkoutSetTemplate;
  workoutConfig?: WorkoutConfig;
  editingWorkoutId?: string;
  editingChainMetadata?: WorkoutChainMetadata;
}

const SPLIT_OPTIONS: { value: WorkoutSplitType; label: string }[] = [
  { value: 'upper_lower', label: 'Upper/Lower' },
  { value: 'ppl', label: 'Push/Pull/Legs' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'push_pull_legs', label: 'Push-Pull-Legs' },
  { value: 'bro_split', label: 'Bro Split' },
  { value: 'custom', label: 'Custom' },
];

const LIFESTYLE_OPTIONS: { value: WorkoutLifestyle; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'active', label: 'Active' },
  { value: 'athlete', label: 'Athlete' },
];

const defaultConfig: WorkoutConfig = {
  workoutInfo: { title: '', description: '' },
  targetAudience: {
    ageRange: '26-35',
    sex: 'Male',
    weight: 180,
    experienceLevel: 'intermediate',
  },
  requirements: {
    sessionsPerWeek: 3,
    sessionDurationMinutes: 45,
    splitType: 'upper_lower',
    lifestyle: 'active',
    twoADay: false,
    weeklyTimeMinutes: 180,
  },
  medicalContext: { includeInjuries: false, includeConditions: false },
  goals: { primary: 'Muscle Gain', secondary: 'Strength' },
  blockOptions: {
    includeWarmup: true,
    mainBlockCount: 1,
    includeFinisher: false,
    includeCooldown: false,
  },
};

const defaultBlockOptions: BlockOptions = {
  includeWarmup: true,
  mainBlockCount: 1,
  includeFinisher: false,
  includeCooldown: false,
};

const defaultHiitCircuitStructure: HiitCircuitStructure = {
  includeWarmup: true,
  circuit1: true,
  circuit2: false,
  circuit3: false,
  includeCooldown: true,
};

const defaultHiitOptions: HiitOptions = {
  protocolFormat: 'standard_ratio',
  workRestRatio: '1:1',
  circuitStructure: defaultHiitCircuitStructure,
  sessionDurationTier: 'standard_interval',
  primaryGoal: 'fat_oxidation',
};

const HIIT_PROTOCOL_OPTIONS: { value: HiitProtocolFormat; label: string }[] = [
  { value: 'standard_ratio', label: 'Standard Ratio (Work:Rest)' },
  { value: 'tabata', label: 'Tabata Style (20:10)' },
  { value: 'emom', label: 'EMOM (Every Minute on the Minute)' },
  { value: 'amrap', label: 'AMRAP (As Many Rounds As Possible)' },
  { value: 'ladder', label: 'Ladder (Ascending/Descending)' },
  { value: 'chipper', label: 'Chipper (List Completion)' },
];

const HIIT_WORK_REST_OPTIONS: { value: HiitWorkRestRatio; label: string }[] = [
  { value: '1:1', label: '1:1 (Aerobic Power)' },
  { value: '2:1', label: '2:1 (Lactate Threshold)' },
  { value: '1:2', label: '1:2 (Phosphagen/Power)' },
  { value: '1:3', label: '1:3 (Recovery Focus)' },
];

const HIIT_SESSION_TIER_OPTIONS: { value: HiitSessionDurationTier; label: string }[] = [
  { value: 'micro_dose', label: 'Micro-Dose (4–10 mins)' },
  { value: 'standard_interval', label: 'Standard Interval (15–20 mins)' },
  { value: 'high_volume', label: 'High Volume (25–30 mins)' },
];

const HIIT_PRIMARY_GOAL_OPTIONS: { value: HiitPrimaryGoal; label: string }[] = [
  { value: 'vo2_max', label: 'VO2 Max (Aerobic Ceiling)' },
  { value: 'lactate_tolerance', label: 'Lactate Tolerance (The "Burn")' },
  { value: 'explosive_power', label: 'Explosive Power (Speed)' },
  { value: 'fat_oxidation', label: 'Fat Oxidation (Metabolic Conditioning)' },
];

const STANDARD_GOALS = [
  'Fat Loss',
  'Strength',
  'Muscle Gain',
  'Endurance',
  'General Fitness',
] as const;

const WorkoutGeneratorModal: React.FC<WorkoutGeneratorModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  existingWorkout,
  workoutConfig: providedConfig,
  editingWorkoutId,
  editingChainMetadata,
}) => {
  const { user } = useAppContext();
  const isEditMode = !!existingWorkout && !!editingWorkoutId;
  const [step, setStep] = useState<Step>(existingWorkout ? 'preview' : 'config');
  const [workoutConfig, setWorkoutConfig] = useState<WorkoutConfig>(
    providedConfig || defaultConfig
  );
  const [generatedWorkout, setGeneratedWorkout] = useState<WorkoutSetTemplate | null>(
    existingWorkout || null
  );
  const [chainMetadata, setChainMetadata] = useState<WorkoutChainMetadata | null>(
    editingChainMetadata ?? null
  );
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [chainStep, setChainStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [equipmentItems, setEquipmentItems] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [workoutSetType, setWorkoutSetType] = useState<WorkoutSetType>('split');
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);

  const firstHIITWorkout = useMemo(
    () => generatedWorkout?.workouts?.find((w) => isHIITWorkout(w)) ?? null,
    [generatedWorkout]
  );
  const previewTimeline = useMemo(() => {
    if (!firstHIITWorkout) return [];
    const hiitData = workoutInSetToHIITWorkoutData(firstHIITWorkout, {
      primaryGoal: workoutConfig.hiitOptions?.primaryGoal,
    });
    return hiitData.timeline;
  }, [firstHIITWorkout, workoutConfig.hiitOptions?.primaryGoal]);

  useEffect(() => {
    if (existingWorkout) {
      setGeneratedWorkout(existingWorkout);
      setStep('preview');
      setChainMetadata(editingChainMetadata ?? null);
      if (providedConfig) setWorkoutConfig(providedConfig);
      if (existingWorkout.workouts?.length === 1) {
        setWorkoutSetType('single');
      }
    } else if (!isOpen) {
      setStep('config');
      setGeneratedWorkout(null);
      setWorkoutConfig(defaultConfig);
      setChainMetadata(null);
      setChainStep(0);
    }
  }, [existingWorkout, providedConfig, editingChainMetadata, isOpen]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [z, e] = await Promise.all([getAllZones(), getAllEquipmentItems()]);
        setZones(z);
        setEquipmentItems(e);
      } catch (err) {
        console.error('[WorkoutGeneratorModal] zones/equipment:', err);
      }
    };
    fetch();
  }, []);

  const buildPersona = (): WorkoutPersona => ({
    title: workoutConfig.workoutInfo.title.trim(),
    description: workoutConfig.workoutInfo.description.trim(),
    demographics: workoutConfig.targetAudience,
    medical: {
      injuries: workoutConfig.medicalContext?.includeInjuries
        ? workoutConfig.medicalContext.injuries || ''
        : '',
      conditions: workoutConfig.medicalContext?.includeConditions
        ? workoutConfig.medicalContext.conditions || ''
        : '',
    },
    goals: workoutConfig.goals,
    zoneId: selectedZone?.id ?? workoutConfig.zoneId,
    selectedEquipmentIds:
      selectedEquipmentIds.length > 0 ? selectedEquipmentIds : workoutConfig.selectedEquipmentIds,
    weeklyTimeMinutes: workoutConfig.requirements.weeklyTimeMinutes,
    sessionsPerWeek: workoutSetType === 'single' ? 1 : workoutConfig.requirements.sessionsPerWeek,
    sessionDurationMinutes: workoutConfig.requirements.sessionDurationMinutes,
    splitType: workoutConfig.requirements.splitType,
    lifestyle: workoutConfig.requirements.lifestyle,
    twoADay: workoutSetType === 'single' ? false : workoutConfig.requirements.twoADay,
    preferredFocus: workoutConfig.preferredFocus,
    hiitMode: workoutConfig.hiitMode,
    hiitOptions: workoutConfig.hiitMode
      ? (workoutConfig.hiitOptions ?? defaultHiitOptions)
      : undefined,
  });

  const chainMessages = [
    'Step 1/4: Designing workout structure...',
    'Step 2/4: Mapping movement patterns...',
    'Step 3/4: Selecting exercises...',
    'Step 4/4: Writing prescriptions...',
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!workoutConfig.workoutInfo.title.trim()) {
      setError('Workout title is required');
      return;
    }
    if (!workoutConfig.workoutInfo.description.trim()) {
      setError('Workout description is required');
      return;
    }
    setLoading(true);
    setChainStep(0);
    setLoadingMessage(chainMessages[0]);
    const progressInterval = setInterval(() => {
      setChainStep((prev) => {
        const next = Math.min(prev + 1, 2);
        setLoadingMessage(chainMessages[next]);
        return next;
      });
    }, 4000);
    try {
      const res = await fetch('/api/ai/generate-workout-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPersona(),
          blockOptions: workoutConfig.hiitMode
            ? undefined
            : (workoutConfig.blockOptions ?? defaultBlockOptions),
          hiitMode: workoutConfig.hiitMode,
          hiitOptions: workoutConfig.hiitMode
            ? (workoutConfig.hiitOptions ?? defaultHiitOptions)
            : undefined,
        }),
      });
      clearInterval(progressInterval);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText || 'Failed to generate workout');
      }
      const data = await res.json();
      setGeneratedWorkout(data.workoutSet);
      setChainMetadata(data.chain_metadata);
      setStep('preview');
      setChainStep(4);
      toast.success('Workout set generated', {
        description: 'Review and save to library.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate workout';
      setError(msg);
      toast.error('Generation failed', { description: msg });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSave = async () => {
    if (!generatedWorkout) return;
    if (!user?.uid) {
      setError('You must be signed in to save.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (editingWorkoutId) {
        await updateWorkout(editingWorkoutId, {
          workoutSet: generatedWorkout,
          workoutConfig: workoutConfig,
        });
        toast.success('Workout updated.');
      } else {
        await saveWorkoutToLibrary(
          generatedWorkout,
          workoutConfig,
          user.uid,
          chainMetadata ?? undefined
        );
        toast.success('Workout saved to library.');
        onGenerate();
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)] ${
              step === 'preview' ? 'max-w-4xl' : 'max-w-3xl'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-orange-light" />
                <div>
                  <h2 className="font-heading text-2xl font-bold">
                    {isEditMode
                      ? 'Edit Workout'
                      : step === 'preview'
                        ? 'Review Workouts'
                        : 'Workout Factory'}
                  </h2>
                  <p className="text-sm text-white/60">
                    {step === 'preview'
                      ? 'Review and save your workout set'
                      : 'Create a single or split workout set from persona'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="border-orange-light/20 mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-orange-light" />
                  <p className="text-lg font-medium text-white">{loadingMessage}</p>
                  <div className="mt-4 flex gap-2">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        className={`h-2 w-8 rounded-full ${
                          s <= chainStep + 1 ? 'bg-orange-light' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : step === 'preview' && generatedWorkout ? (
                <>
                  {saveSuccess && (
                    <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-300">
                      {editingWorkoutId ? 'Workout updated.' : 'Workout saved to library.'}
                    </div>
                  )}
                  {error && (
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                      <p className="text-sm text-red-200">{error}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-heading text-lg font-bold text-white">
                        {generatedWorkout.title}
                      </h3>
                      <p className="mt-1 text-sm text-white/60">{generatedWorkout.description}</p>
                      <p className="mt-1 text-xs text-white/50">
                        {generatedWorkout.workouts.length} workout(s) ·{' '}
                        {generatedWorkout.difficulty}
                      </p>
                      {firstHIITWorkout && (
                        <button
                          type="button"
                          onClick={() => setShowPreviewOverlay(true)}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                        >
                          <Play className="h-4 w-4" />
                          Preview Interval Timer
                        </button>
                      )}
                    </div>
                    {generatedWorkout.workouts.map((w, idx) => (
                      <div key={idx} className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <h4 className="font-medium text-white">{w.title}</h4>
                        <p className="mt-1 text-sm text-white/60">{w.description}</p>

                        {(w.warmupBlocks ?? []).length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-white/80">Warmup</h5>
                            <ul className="mt-1 space-y-1 text-sm text-white/70">
                              {(w.warmupBlocks ?? []).map((item, i) => (
                                <li key={i}>
                                  {item.exerciseName}
                                  {Array.isArray(item.instructions) &&
                                    item.instructions.length > 0 && (
                                      <span className="text-white/50">
                                        {' '}
                                        — {item.instructions.join(', ')}
                                      </span>
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
                                  {(block.exercises ?? []).map((ex, i) => (
                                    <li key={i}>
                                      {ex.exerciseName} —{' '}
                                      {ex.workSeconds != null &&
                                      ex.restSeconds != null &&
                                      ex.rounds != null
                                        ? `${ex.workSeconds}s work / ${ex.restSeconds}s rest × ${ex.rounds} rounds`
                                        : `${ex.sets}×${ex.reps}${ex.rpe != null ? ` @ RPE ${ex.rpe}` : ''}`}
                                    </li>
                                  ))}
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
                                    raw.workSeconds != null &&
                                    raw.restSeconds != null &&
                                    raw.rounds != null;
                                  return (
                                    <li key={i}>
                                      {raw.exerciseName} —{' '}
                                      {timerSchema
                                        ? `${raw.workSeconds}s work / ${raw.restSeconds}s rest × ${raw.rounds} rounds`
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
                                  {Array.isArray(item.instructions) &&
                                    item.instructions.length > 0 && (
                                      <span className="text-white/50">
                                        {' '}
                                        — {item.instructions.join(', ')}
                                      </span>
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
                                  {Array.isArray(item.instructions) &&
                                    item.instructions.length > 0 && (
                                      <span className="text-white/50">
                                        {' '}
                                        — {item.instructions.join(', ')}
                                      </span>
                                    )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white hover:bg-white/5"
                    >
                      Back to config
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={loading}
                      className="hover:bg-orange-light/90 rounded-lg bg-orange-light px-4 py-2 font-medium text-black disabled:opacity-50"
                    >
                      {editingWorkoutId ? 'Update Workout' : 'Save to Library'}
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleGenerate} className="space-y-6">
                  {error && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                      <p className="text-sm text-red-200">{error}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Workout Information
                    </h3>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={workoutConfig.workoutInfo.title}
                        onChange={(e) =>
                          setWorkoutConfig((prev) => ({
                            ...prev,
                            workoutInfo: { ...prev.workoutInfo, title: e.target.value },
                          }))
                        }
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        placeholder="e.g. Upper/Lower Split"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Description *
                      </label>
                      <textarea
                        value={workoutConfig.workoutInfo.description}
                        onChange={(e) =>
                          setWorkoutConfig((prev) => ({
                            ...prev,
                            workoutInfo: { ...prev.workoutInfo, description: e.target.value },
                          }))
                        }
                        rows={2}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        placeholder="Brief description of the workout set"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!workoutConfig.hiitMode}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setWorkoutConfig((prev) => {
                            const next: WorkoutConfig = {
                              ...prev,
                              hiitMode: checked,
                              hiitOptions:
                                checked && !prev.hiitOptions
                                  ? defaultHiitOptions
                                  : prev.hiitOptions,
                            };
                            if (checked && next.hiitOptions) {
                              const tier = next.hiitOptions.sessionDurationTier;
                              const minutes =
                                tier === 'micro_dose' ? 7 : tier === 'standard_interval' ? 18 : 28;
                              next.requirements = {
                                ...prev.requirements,
                                sessionDurationMinutes: minutes,
                              };
                            }
                            return next;
                          });
                        }}
                        className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                      />
                      <span className="text-sm font-medium text-white/80">
                        Enable Metabolic Conditioning (HIIT) Mode
                      </span>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">Generate</h3>
                    <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5">
                      <button
                        type="button"
                        onClick={() => setWorkoutSetType('single')}
                        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                          workoutSetType === 'single'
                            ? 'bg-orange-light text-black'
                            : 'text-white/80 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        Single Workout
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkoutSetType('split')}
                        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                          workoutSetType === 'split'
                            ? 'bg-orange-light text-black'
                            : 'text-white/80 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        Split Workout
                      </button>
                    </div>
                  </div>

                  {!workoutConfig.hiitMode && (
                    <div className="space-y-4">
                      <h3 className="font-heading text-lg font-bold text-white">Block selectors</h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={
                              (workoutConfig.blockOptions ?? defaultBlockOptions).includeWarmup
                            }
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                blockOptions: {
                                  ...(prev.blockOptions ?? defaultBlockOptions),
                                  includeWarmup: e.target.checked,
                                },
                              }))
                            }
                            className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                          />
                          <span className="text-sm font-medium text-white/80">
                            Include warmup block
                          </span>
                        </label>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Main workout blocks
                          </label>
                          <select
                            value={
                              (workoutConfig.blockOptions ?? defaultBlockOptions).mainBlockCount
                            }
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                blockOptions: {
                                  ...(prev.blockOptions ?? defaultBlockOptions),
                                  mainBlockCount: parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5,
                                },
                              }))
                            }
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          >
                            {([1, 2, 3, 4, 5] as const).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={
                              (workoutConfig.blockOptions ?? defaultBlockOptions).includeFinisher
                            }
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                blockOptions: {
                                  ...(prev.blockOptions ?? defaultBlockOptions),
                                  includeFinisher: e.target.checked,
                                },
                              }))
                            }
                            className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                          />
                          <span className="text-sm font-medium text-white/80">
                            Include finisher block
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={
                              (workoutConfig.blockOptions ?? defaultBlockOptions).includeCooldown
                            }
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                blockOptions: {
                                  ...(prev.blockOptions ?? defaultBlockOptions),
                                  includeCooldown: e.target.checked,
                                },
                              }))
                            }
                            className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                          />
                          <span className="text-sm font-medium text-white/80">
                            Include cool down block
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {workoutConfig.hiitMode && (
                    <div className="space-y-4">
                      <h3 className="font-heading text-lg font-bold text-white">
                        Metabolic Architecture
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Protocol Format
                          </label>
                          <select
                            value={(workoutConfig.hiitOptions ?? defaultHiitOptions).protocolFormat}
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                hiitOptions: {
                                  ...(prev.hiitOptions ?? defaultHiitOptions),
                                  protocolFormat: e.target.value as HiitProtocolFormat,
                                },
                              }))
                            }
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          >
                            {HIIT_PROTOCOL_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {(workoutConfig.hiitOptions ?? defaultHiitOptions).protocolFormat ===
                          'standard_ratio' && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/80">
                              Work:Rest Ratio
                            </label>
                            <select
                              value={
                                (workoutConfig.hiitOptions ?? defaultHiitOptions).workRestRatio ??
                                '1:1'
                              }
                              onChange={(e) =>
                                setWorkoutConfig((prev) => ({
                                  ...prev,
                                  hiitOptions: {
                                    ...(prev.hiitOptions ?? defaultHiitOptions),
                                    workRestRatio: e.target.value as HiitWorkRestRatio,
                                  },
                                }))
                              }
                              className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                            >
                              {HIIT_WORK_REST_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <span className="text-sm font-medium text-white/80">Circuit Structure</span>
                        <div className="flex flex-wrap gap-4">
                          {[
                            {
                              key: 'includeWarmup' as const,
                              label: 'Include Warmup (Ramp Up)',
                            },
                            { key: 'circuit1' as const, label: 'Circuit 1 (The Driver)' },
                            { key: 'circuit2' as const, label: 'Circuit 2 (The Sustainer)' },
                            { key: 'circuit3' as const, label: 'Circuit 3 (The Burnout)' },
                            {
                              key: 'includeCooldown' as const,
                              label: 'Include Cool Down (Parasympathetic Reset)',
                            },
                          ].map(({ key, label }) => (
                            <label key={key} className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={
                                  (workoutConfig.hiitOptions ?? defaultHiitOptions)
                                    .circuitStructure[key]
                                }
                                onChange={(e) =>
                                  setWorkoutConfig((prev) => {
                                    const cs = (prev.hiitOptions ?? defaultHiitOptions)
                                      .circuitStructure;
                                    const circuitKeys = [
                                      'circuit1',
                                      'circuit2',
                                      'circuit3',
                                    ] as const;
                                    const isCircuit = circuitKeys.includes(
                                      key as (typeof circuitKeys)[number]
                                    );
                                    const newChecked = e.target.checked;
                                    let value = newChecked;
                                    if (isCircuit && !newChecked) {
                                      const count = circuitKeys.filter((k) => cs[k]).length;
                                      const isLast =
                                        count === 1 && cs[key as (typeof circuitKeys)[number]];
                                      if (isLast) value = true;
                                    }
                                    return {
                                      ...prev,
                                      hiitOptions: {
                                        ...(prev.hiitOptions ?? defaultHiitOptions),
                                        circuitStructure: {
                                          ...(prev.hiitOptions ?? defaultHiitOptions)
                                            .circuitStructure,
                                          [key]: value,
                                        },
                                      },
                                    };
                                  })
                                }
                                className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                              />
                              <span className="text-sm text-white/70">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">Time & Sessions</h3>
                    <div
                      className={`grid grid-cols-1 gap-4 ${workoutSetType === 'split' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
                    >
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Weekly time (min) *
                        </label>
                        <input
                          type="number"
                          min={30}
                          max={600}
                          value={workoutConfig.requirements.weeklyTimeMinutes}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              requirements: {
                                ...prev.requirements,
                                weeklyTimeMinutes: parseInt(e.target.value, 10) || 180,
                              },
                            }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        />
                      </div>
                      {workoutSetType === 'split' && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Sessions per week *
                          </label>
                          <select
                            value={workoutConfig.requirements.sessionsPerWeek}
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                requirements: {
                                  ...prev.requirements,
                                  sessionsPerWeek: parseInt(e.target.value, 10) as
                                    | 1
                                    | 2
                                    | 3
                                    | 4
                                    | 5
                                    | 6
                                    | 7,
                                },
                              }))
                            }
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          >
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Session duration (min) *
                        </label>
                        {workoutConfig.hiitMode ? (
                          <select
                            value={
                              (workoutConfig.hiitOptions ?? defaultHiitOptions).sessionDurationTier
                            }
                            onChange={(e) => {
                              const tier = e.target.value as HiitSessionDurationTier;
                              const minutes =
                                tier === 'micro_dose' ? 7 : tier === 'standard_interval' ? 18 : 28;
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                hiitOptions: {
                                  ...(prev.hiitOptions ?? defaultHiitOptions),
                                  sessionDurationTier: tier,
                                },
                                requirements: {
                                  ...prev.requirements,
                                  sessionDurationMinutes: minutes,
                                },
                              }));
                            }}
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          >
                            {HIIT_SESSION_TIER_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            min={15}
                            max={180}
                            value={workoutConfig.requirements.sessionDurationMinutes}
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                requirements: {
                                  ...prev.requirements,
                                  sessionDurationMinutes: parseInt(e.target.value, 10) || 45,
                                },
                              }))
                            }
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {workoutSetType === 'split' && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Split type *
                          </label>
                          <select
                            value={workoutConfig.requirements.splitType}
                            onChange={(e) =>
                              setWorkoutConfig((prev) => ({
                                ...prev,
                                requirements: {
                                  ...prev.requirements,
                                  splitType: e.target.value as WorkoutSplitType,
                                },
                              }))
                            }
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          >
                            {SPLIT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Lifestyle *
                        </label>
                        <select
                          value={workoutConfig.requirements.lifestyle}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              requirements: {
                                ...prev.requirements,
                                lifestyle: e.target.value as WorkoutLifestyle,
                              },
                            }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          {LIFESTYLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {workoutSetType === 'split' && (
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={workoutConfig.requirements.twoADay}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              requirements: {
                                ...prev.requirements,
                                twoADay: e.target.checked,
                              },
                            }))
                          }
                          className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                        />
                        <span className="text-sm font-medium text-white/80">Two-a-day allowed</span>
                      </label>
                    )}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Preferred focus (optional)
                      </label>
                      <input
                        type="text"
                        value={workoutConfig.preferredFocus ?? ''}
                        onChange={(e) =>
                          setWorkoutConfig((prev) => ({
                            ...prev,
                            preferredFocus: e.target.value || undefined,
                          }))
                        }
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        placeholder="e.g. upper push only"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">Target Persona</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Age range *
                        </label>
                        <select
                          value={workoutConfig.targetAudience.ageRange}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                ageRange: e.target.value,
                              },
                            }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          {['18-25', '26-35', '36-45', '46-55', '56-65', '65+'].map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Sex *
                        </label>
                        <select
                          value={workoutConfig.targetAudience.sex}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                sex: e.target.value,
                              },
                            }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Weight (lbs) *
                        </label>
                        <input
                          type="number"
                          min={50}
                          max={500}
                          value={workoutConfig.targetAudience.weight}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                weight: parseInt(e.target.value, 10) || 180,
                              },
                            }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Experience *
                        </label>
                        <select
                          value={workoutConfig.targetAudience.experienceLevel}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                experienceLevel: e.target.value as
                                  | 'beginner'
                                  | 'intermediate'
                                  | 'advanced',
                              },
                            }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">Goals</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Primary *
                        </label>
                        <select
                          value={
                            workoutConfig.hiitMode
                              ? (workoutConfig.hiitOptions ?? defaultHiitOptions).primaryGoal
                              : workoutConfig.goals.primary
                          }
                          onChange={(e) =>
                            workoutConfig.hiitMode
                              ? setWorkoutConfig((prev) => ({
                                  ...prev,
                                  hiitOptions: {
                                    ...(prev.hiitOptions ?? defaultHiitOptions),
                                    primaryGoal: e.target.value as HiitPrimaryGoal,
                                  },
                                }))
                              : setWorkoutConfig((prev) => ({
                                  ...prev,
                                  goals: { ...prev.goals, primary: e.target.value },
                                }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          {workoutConfig.hiitMode
                            ? HIIT_PRIMARY_GOAL_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))
                            : STANDARD_GOALS.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Secondary *
                        </label>
                        <select
                          value={workoutConfig.goals.secondary}
                          onChange={(e) =>
                            setWorkoutConfig((prev) => ({
                              ...prev,
                              goals: { ...prev.goals, secondary: e.target.value },
                            }))
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          {[
                            'Fat Loss',
                            'Strength',
                            'Muscle Gain',
                            'Endurance',
                            'General Fitness',
                          ].map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Equipment (optional)
                    </h3>
                    <select
                      value={selectedZone?.id ?? ''}
                      onChange={async (e) => {
                        const id = e.target.value;
                        if (id) {
                          const z = await getZoneById(id);
                          setSelectedZone(z ?? null);
                          setSelectedEquipmentIds(z?.equipmentIds ?? []);
                          setWorkoutConfig((prev) => ({
                            ...prev,
                            zoneId: z?.id,
                            selectedEquipmentIds: z?.equipmentIds ?? [],
                          }));
                        } else {
                          setSelectedZone(null);
                          setSelectedEquipmentIds([]);
                          setWorkoutConfig((prev) => ({
                            ...prev,
                            zoneId: undefined,
                            selectedEquipmentIds: undefined,
                          }));
                        }
                      }}
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                    >
                      <option value="">None</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    {selectedZone && (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="text-sm text-white/80">
                          Equipment:{' '}
                          {selectedEquipmentIds.length > 0
                            ? selectedEquipmentIds
                                .map((id) => equipmentItems.find((e) => e.id === id)?.name ?? id)
                                .join(', ')
                            : 'All in zone'}
                        </p>
                      </div>
                    )}
                    {workoutConfig.hiitMode && (
                      <p className="text-xs text-white/50">
                        For HIIT, the AI deprioritizes heavy barbell setups and favors Dumbbells,
                        Kettlebells, and Bodyweight for safety under fatigue.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-white/10 bg-black/20 px-6 py-2 text-white hover:bg-white/5"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 font-medium text-black disabled:opacity-50"
                    >
                      <Sparkles className="h-5 w-5" />
                      {loading ? 'Generating...' : 'Generate Workout'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
      {typeof document !== 'undefined' &&
        showPreviewOverlay &&
        previewTimeline.length > 0 &&
        createPortal(
          <IntervalTimerOverlay
            timeline={previewTimeline}
            onClose={() => setShowPreviewOverlay(false)}
          />,
          document.body
        )}
    </>
  );
};

export default WorkoutGeneratorModal;
