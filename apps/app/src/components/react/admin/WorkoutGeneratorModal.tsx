/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, Play, Loader2, Send } from 'lucide-react';
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
  AmrapDensityOptions,
} from '@/types/ai-workout';
import AmrapDensityArchitecture from '@/components/react/admin/amrap-density/AmrapDensityArchitecture';
import { amrapDensityTierMinutes } from '@/lib/amrap-density-tier';
import {
  getAllZones,
  getZoneById,
  getAllEquipmentItems,
  type Zone,
} from '@/lib/supabase/client/equipment';
import {
  saveTrainerAiWorkoutToLibrary,
  saveWorkoutToLibrary,
  updateWorkout,
} from '@/lib/supabase/client/workout-persistence';
import { useWorkoutFactoryGeneration } from '@/hooks/useWorkoutFactoryGeneration';
import { postPreviewWorkoutChainPrompt } from '@/lib/workout-factory-client';
import { useAppContext } from '@/contexts/AppContext';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import { isHIITWorkout, workoutInSetToHIITWorkoutData } from '@/lib/hiit-workout-data';
import IntervalTimerOverlay from '@/components/react/interval-timers/IntervalTimerOverlay';
import WorkoutSessionPreviewContent from '@/components/react/trainer/WorkoutSessionPreviewContent';

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
  /** Admin catalog (workout_sets) vs Mission Control trainer library (public.workouts). */
  saveTarget?: 'admin' | 'trainer';
  /** Full-page shell under /trainer/workouts/factory vs modal overlay. */
  layout?: 'modal' | 'page';
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
  amrapDensityMode: false,
};

const defaultAmrapDensityOptions: AmrapDensityOptions = {
  protocolFormat: 'AMRAP_DENSITY',
  workRestRatio: 'continuous',
  sessionDurationTier: 'standard_interval',
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
  { value: 'ladder', label: 'Ladder (Ascending/Descending)' },
  { value: 'chipper', label: 'Chipper (List Completion)' },
];

const HIIT_WORK_REST_OPTIONS: { value: HiitWorkRestRatio; label: string }[] = [
  { value: '1:1', label: '1:1 (Aerobic Power)' },
  { value: '2:1', label: '2:1 (Lactate Threshold)' },
  { value: '1:2', label: '1:2 (Phosphagen/Power)' },
  { value: '1:3', label: '1:3 (Recovery Focus)' },
];

/** Minutes sent to the chain for each tier (Mission Control metabolic pathways). */
function hiitTierSessionMinutes(tier: HiitSessionDurationTier): number {
  switch (tier) {
    case 'micro_dose':
      return 5;
    case 'standard_interval':
      return 15;
    case 'high_volume':
      return 20;
    default:
      return 15;
  }
}

const HIIT_SESSION_TIER_OPTIONS_GENERIC: { value: HiitSessionDurationTier; label: string }[] = [
  { value: 'micro_dose', label: 'Micro-dose (~5 min) — short, high output' },
  { value: 'standard_interval', label: 'Standard (~15 min) — work capacity' },
  { value: 'high_volume', label: 'Extended (~20 min) — aerobic power' },
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
  saveTarget = 'admin',
  layout = 'modal',
}) => {
  const { user } = useAppContext();
  const isPageLayout = layout === 'page';
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
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [equipmentItems, setEquipmentItems] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [workoutSetType, setWorkoutSetType] = useState<WorkoutSetType>('split');
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);

  /** After trainer library save: assign one or more clients (P1 single, P2 multi). */
  const [savedTrainerWorkoutIds, setSavedTrainerWorkoutIds] = useState<string[] | null>(null);
  const [resourceIdForAssign, setResourceIdForAssign] = useState('');
  const [assignClientUserIds, setAssignClientUserIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<
    Array<{ id: string; full_name: string | null; email: string | null }>
  >([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [reviewStep1PromptBeforeGenerate, setReviewStep1PromptBeforeGenerate] = useState(false);
  const [step1PromptStep, setStep1PromptStep] = useState<'idle' | 'review'>('idle');
  const [editedStep1UserPrompt, setEditedStep1UserPrompt] = useState('');
  const [previewingStep1Prompt, setPreviewingStep1Prompt] = useState(false);

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

  useEffect(() => {
    if (!isOpen) {
      setSavedTrainerWorkoutIds(null);
      setResourceIdForAssign('');
      setAssignClientUserIds([]);
      setRoster([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || saveTarget !== 'trainer' || !savedTrainerWorkoutIds?.length) return;
    let cancelled = false;
    setRosterLoading(true);
    void (async () => {
      try {
        const auth = await missionControlApiAuthHeaders();
        const r = await fetch('/api/trainer/roster', {
          credentials: 'include',
          headers: { ...auth },
        });
        const raw = await r.json().catch(() => []);
        if (cancelled) return;
        const arr = Array.isArray(raw) ? raw : [];
        setRoster(
          arr
            .map((row: unknown) => {
              const o = row as { id?: string; full_name?: string | null; email?: string | null };
              return {
                id: typeof o.id === 'string' ? o.id : '',
                full_name: o.full_name ?? null,
                email: o.email ?? null,
              };
            })
            .filter((x) => x.id)
        );
      } catch {
        if (!cancelled) setRoster([]);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, saveTarget, savedTrainerWorkoutIds]);

  const buildPersona = useCallback((): WorkoutPersona => {
    const amrapOn = !!workoutConfig.amrapDensityMode;
    const hiitOn = !!workoutConfig.hiitMode && !amrapOn;
    return {
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
      hiitMode: hiitOn,
      hiitOptions: hiitOn ? (workoutConfig.hiitOptions ?? defaultHiitOptions) : undefined,
      amrapDensityMode: amrapOn,
      amrapDensityOptions: amrapOn
        ? (workoutConfig.amrapDensityOptions ?? defaultAmrapDensityOptions)
        : undefined,
    };
  }, [workoutConfig, selectedZone?.id, selectedEquipmentIds, workoutSetType]);

  const buildRequestBody = useCallback(() => {
    const useMetabolicBlocks = workoutConfig.hiitMode || workoutConfig.amrapDensityMode;
    return {
      ...buildPersona(),
      blockOptions: useMetabolicBlocks
        ? undefined
        : (workoutConfig.blockOptions ?? defaultBlockOptions),
      hiitMode: !!workoutConfig.hiitMode && !workoutConfig.amrapDensityMode,
      hiitOptions:
        workoutConfig.hiitMode && !workoutConfig.amrapDensityMode
          ? (workoutConfig.hiitOptions ?? defaultHiitOptions)
          : undefined,
      amrapDensityMode: !!workoutConfig.amrapDensityMode,
      amrapDensityOptions: workoutConfig.amrapDensityMode
        ? (workoutConfig.amrapDensityOptions ?? defaultAmrapDensityOptions)
        : undefined,
    };
  }, [
    buildPersona,
    workoutConfig.hiitMode,
    workoutConfig.amrapDensityMode,
    workoutConfig.blockOptions,
    workoutConfig.hiitOptions,
    workoutConfig.amrapDensityOptions,
  ]);

  const {
    handleGenerate: runWorkoutChain,
    loading: chainLoading,
    loadingMessage,
    chainStep,
    error,
    setError,
    resetGenerationState,
  } = useWorkoutFactoryGeneration({
    buildRequestBody,
    onSuccess: ({ workoutSet, chain_metadata }) => {
      setStep1PromptStep('idle');
      setGeneratedWorkout(workoutSet);
      setChainMetadata(chain_metadata);
      setStep('preview');
    },
    successToast:
      saveTarget === 'trainer'
        ? {
            title: 'Workout generated',
            description: 'Review and save to your library.',
          }
        : undefined,
  });

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
      setStep1PromptStep('idle');
      setEditedStep1UserPrompt('');
      resetGenerationState();
    }
  }, [existingWorkout, providedConfig, editingChainMetadata, isOpen, resetGenerationState]);

  const busy = chainLoading || saving || assignBusy || previewingStep1Prompt;

  const rosterLabel = (id: string) => {
    const r = roster.find((x) => x.id === id);
    return (r?.full_name?.trim() || r?.email?.trim() || id).trim();
  };

  const toggleAssignClient = (id: string) => {
    setAssignClientUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const assignWorkoutToClients = async () => {
    if (!resourceIdForAssign.trim() || assignClientUserIds.length === 0) return;
    setAssignBusy(true);
    const rid = resourceIdForAssign.trim();
    const auth = await missionControlApiAuthHeaders();
    let ok = 0;
    const failures: { id: string; message: string }[] = [];
    try {
      for (const clientUserId of assignClientUserIds) {
        try {
          const res = await fetch(
            `/api/trainer/clients/${encodeURIComponent(clientUserId)}/assignments`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { ...auth, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                assignmentType: 'workout',
                resourceId: rid,
              }),
            }
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            failures.push({
              id: clientUserId,
              message: typeof body.error === 'string' ? body.error : 'Could not assign workout',
            });
          } else {
            ok += 1;
          }
        } catch (err) {
          failures.push({
            id: clientUserId,
            message: err instanceof Error ? err.message : 'Request failed',
          });
        }
      }

      const n = assignClientUserIds.length;
      if (ok === n) {
        toast.success(
          n === 1 ? 'Workout assigned to client.' : `Workout assigned to ${n} clients.`
        );
      } else if (ok > 0) {
        const detail = failures
          .slice(0, 3)
          .map((f) => `${rosterLabel(f.id)}: ${f.message}`)
          .join(' · ');
        toast.warning(`Assigned to ${ok} of ${n}. ${detail}`);
      } else {
        toast.error(
          failures[0]
            ? `${rosterLabel(failures[0].id)}: ${failures[0].message}`
            : 'Could not assign workout'
        );
      }
    } finally {
      setAssignBusy(false);
    }
  };

  const handleGenerate = async (e: React.SyntheticEvent) => {
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

    if (reviewStep1PromptBeforeGenerate && step1PromptStep === 'idle') {
      setPreviewingStep1Prompt(true);
      try {
        const data = await postPreviewWorkoutChainPrompt(buildRequestBody());
        setEditedStep1UserPrompt(data.step1UserPrompt);
        setStep1PromptStep('review');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prompt preview');
      } finally {
        setPreviewingStep1Prompt(false);
      }
      return;
    }

    void runWorkoutChain(e);
  };

  const handleGenerateFromEditedStep1Prompt = (e: React.SyntheticEvent) => {
    void runWorkoutChain(e, { step1UserPromptOverride: editedStep1UserPrompt });
  };

  const cancelStep1PromptReview = () => {
    setStep1PromptStep('idle');
  };

  const handleSave = async () => {
    if (!generatedWorkout) return;
    if (!user?.uid) {
      setError('You must be signed in to save.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (saveTarget === 'trainer') {
        const ids = await saveTrainerAiWorkoutToLibrary(
          generatedWorkout,
          workoutConfig,
          chainMetadata ?? undefined,
          'draft'
        );
        if (ids.length > 0) {
          setSavedTrainerWorkoutIds(ids);
          setResourceIdForAssign(ids[0] ?? '');
          setAssignClientUserIds([]);
        } else {
          setSavedTrainerWorkoutIds(null);
        }
        toast.success('Saved to your workout library.');
        onGenerate();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 1500);
      } else if (editingWorkoutId) {
        await updateWorkout(editingWorkoutId, {
          workoutSet: generatedWorkout,
          workoutConfig: workoutConfig,
        });
        toast.success('Workout updated.');
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1500);
      } else {
        await saveWorkoutToLibrary(generatedWorkout, workoutConfig, chainMetadata ?? undefined);
        toast.success('Workout saved to library.');
        onGenerate();
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div
          className={
            isPageLayout
              ? 'relative w-full max-w-5xl'
              : 'fixed inset-0 z-50 flex items-center justify-center p-4'
          }
        >
          {!isPageLayout && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
          )}
          <motion.div
            initial={{ scale: isPageLayout ? 1 : 0.95, y: isPageLayout ? 0 : 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: isPageLayout ? 1 : 0.95, y: isPageLayout ? 0 : 20 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0d0500] shadow-[0_0_100px_rgba(255,191,0,0.1)] ${
              isPageLayout ? 'max-w-5xl' : step === 'preview' ? 'max-w-4xl' : 'max-w-3xl'
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
                        ? saveTarget === 'trainer'
                          ? 'Review workout'
                          : 'Review Workouts'
                        : 'Workout Factory'}
                  </h2>
                  <p className="text-sm text-white/60">
                    {step === 'preview'
                      ? saveTarget === 'trainer'
                        ? 'Review and save to your private library'
                        : 'Review and save your workout set'
                      : saveTarget === 'trainer'
                        ? 'Generate bespoke programming for your clients'
                        : 'Create a single or split workout set from persona'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                disabled={busy}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className={`overflow-y-auto p-6 ${isPageLayout ? 'max-h-none min-h-[60vh]' : 'max-h-[70vh]'}`}
            >
              {chainLoading ? (
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
                        <WorkoutSessionPreviewContent w={w} headingLevel="h4" />
                      </div>
                    ))}
                  </div>
                  {saveTarget === 'trainer' &&
                  savedTrainerWorkoutIds &&
                  savedTrainerWorkoutIds.length > 0 ? (
                    <div className="border-orange-light/25 bg-orange-light/5 mt-6 rounded-lg border p-4">
                      <h4 className="font-heading text-sm font-bold text-orange-light">
                        Assign to clients
                      </h4>
                      <p className="mt-1 text-xs text-white/55">
                        Deliver this workout from your library. Select one or more clients. When the
                        plan has multiple saved rows, pick which session to assign below.
                      </p>
                      {savedTrainerWorkoutIds.length > 1 && generatedWorkout ? (
                        <div className="mt-3">
                          <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">
                            Session to assign
                          </label>
                          <select
                            value={resourceIdForAssign}
                            onChange={(e) => setResourceIdForAssign(e.target.value)}
                            className="w-full max-w-md rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                          >
                            {savedTrainerWorkoutIds.map((wid, idx) => {
                              const session = generatedWorkout.workouts[idx];
                              const label =
                                session?.title?.trim() ||
                                (savedTrainerWorkoutIds.length > 1
                                  ? `Session ${idx + 1}`
                                  : 'Workout');
                              return (
                                <option key={wid} value={wid}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : null}
                      <div className="mt-3">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <label className="font-mono text-[10px] uppercase text-white/50">
                            Clients
                          </label>
                          {!rosterLoading && roster.length > 0 ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setAssignClientUserIds(roster.map((r) => r.id))}
                                className="text-orange-light/80 text-[10px] font-medium underline hover:text-orange-light"
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                onClick={() => setAssignClientUserIds([])}
                                className="text-[10px] font-medium text-white/50 underline hover:text-white/80"
                              >
                                Clear
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {rosterLoading ? (
                          <p className="text-sm text-white/50">Loading roster…</p>
                        ) : roster.length === 0 ? (
                          <p className="text-sm text-white/50">No clients on your roster yet.</p>
                        ) : (
                          <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                            {roster.map((r) => {
                              const label = (
                                r.full_name?.trim() ||
                                r.email?.trim() ||
                                'Client'
                              ).trim();
                              const checked = assignClientUserIds.includes(r.id);
                              return (
                                <li key={r.id}>
                                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white/90">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleAssignClient(r.id)}
                                      className="rounded border-white/30 bg-black/40 text-orange-light focus:ring-orange-light"
                                    />
                                    {label}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !resourceIdForAssign.trim() ||
                              assignClientUserIds.length === 0
                            }
                            onClick={() => void assignWorkoutToClients()}
                            className="border-orange-light/40 bg-orange-light/10 hover:bg-orange-light/20 rounded-lg border px-4 py-2 font-mono text-xs font-bold uppercase text-orange-light disabled:opacity-40"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                      {assignClientUserIds.length > 0 && resourceIdForAssign.trim() ? (
                        <div className="text-orange-light/90 mt-3 space-y-1 text-xs font-medium">
                          {assignClientUserIds.map((uid) => (
                            <a
                              key={uid}
                              href={`/trainer/roster/${encodeURIComponent(uid)}/lab?prefillWorkout=${encodeURIComponent(resourceIdForAssign)}`}
                              className="mr-3 inline-block underline hover:text-orange-light"
                            >
                              Performance Lab — {rosterLabel(uid)}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
                      disabled={busy}
                      className="hover:bg-orange-light/90 rounded-lg bg-orange-light px-4 py-2 font-medium text-black disabled:opacity-50"
                    >
                      {editingWorkoutId
                        ? 'Update Workout'
                        : saveTarget === 'trainer'
                          ? 'Save to library'
                          : 'Save to Library'}
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
                              amrapDensityMode: checked ? false : prev.amrapDensityMode,
                              hiitOptions:
                                checked && !prev.hiitOptions
                                  ? defaultHiitOptions
                                  : prev.hiitOptions,
                            };
                            if (checked && next.hiitOptions) {
                              const tier = next.hiitOptions.sessionDurationTier;
                              next.requirements = {
                                ...prev.requirements,
                                sessionDurationMinutes: hiitTierSessionMinutes(tier),
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
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!workoutConfig.amrapDensityMode}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setWorkoutConfig((prev) => {
                            const tier = (prev.amrapDensityOptions ?? defaultAmrapDensityOptions)
                              .sessionDurationTier;
                            const minutes = amrapDensityTierMinutes(tier);
                            return {
                              ...prev,
                              amrapDensityMode: checked,
                              hiitMode: checked ? false : prev.hiitMode,
                              amrapDensityOptions: checked
                                ? (prev.amrapDensityOptions ?? defaultAmrapDensityOptions)
                                : prev.amrapDensityOptions,
                              requirements: {
                                ...prev.requirements,
                                sessionDurationMinutes: checked
                                  ? minutes
                                  : prev.requirements.sessionDurationMinutes,
                              },
                            };
                          });
                        }}
                        className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                      />
                      <span className="text-sm font-medium text-white/80">
                        Enable Density-Based AMRAP Mode
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
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="workout-factory-review-step1-prompt"
                        checked={reviewStep1PromptBeforeGenerate}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setReviewStep1PromptBeforeGenerate(on);
                          if (!on) setStep1PromptStep('idle');
                        }}
                        className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light"
                      />
                      <label
                        htmlFor="workout-factory-review-step1-prompt"
                        className="text-sm font-medium text-white/80"
                      >
                        Review Step 1 prompt before generating
                      </label>
                    </div>
                  </div>

                  {!workoutConfig.hiitMode && !workoutConfig.amrapDensityMode && (
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

                  {workoutConfig.amrapDensityMode && (
                    <AmrapDensityArchitecture
                      sessionDurationTier={
                        (workoutConfig.amrapDensityOptions ?? defaultAmrapDensityOptions)
                          .sessionDurationTier
                      }
                      onSessionDurationTierChange={(tier) => {
                        const minutes = amrapDensityTierMinutes(tier);
                        setWorkoutConfig((prev) => ({
                          ...prev,
                          amrapDensityOptions: {
                            ...(prev.amrapDensityOptions ?? defaultAmrapDensityOptions),
                            sessionDurationTier: tier,
                          },
                          requirements: {
                            ...prev.requirements,
                            sessionDurationMinutes: minutes,
                          },
                        }));
                      }}
                    />
                  )}

                  {workoutConfig.hiitMode && !workoutConfig.amrapDensityMode && (
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
                            onChange={(e) => {
                              const nextFormat = e.target.value as HiitProtocolFormat;
                              setWorkoutConfig((prev) => {
                                const baseOpts = { ...(prev.hiitOptions ?? defaultHiitOptions) };
                                baseOpts.protocolFormat = nextFormat;
                                const tier = baseOpts.sessionDurationTier;
                                return {
                                  ...prev,
                                  hiitOptions: baseOpts,
                                  requirements: {
                                    ...prev.requirements,
                                    sessionDurationMinutes: hiitTierSessionMinutes(tier),
                                  },
                                };
                              });
                            }}
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
                        {workoutConfig.hiitMode && !workoutConfig.amrapDensityMode ? (
                          <select
                            value={
                              (workoutConfig.hiitOptions ?? defaultHiitOptions).sessionDurationTier
                            }
                            onChange={(e) => {
                              const tier = e.target.value as HiitSessionDurationTier;
                              const minutes = hiitTierSessionMinutes(tier);
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
                            {HIIT_SESSION_TIER_OPTIONS_GENERIC.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : workoutConfig.amrapDensityMode ? (
                          <p className="text-sm text-white/75">
                            Session clock:{' '}
                            <span className="font-medium text-white">
                              {workoutConfig.requirements.sessionDurationMinutes} min
                            </span>{' '}
                            — set by the Density-Based AMRAP tier above (5, 15, or 20 min).
                          </p>
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
                            workoutConfig.hiitMode && !workoutConfig.amrapDensityMode
                              ? (workoutConfig.hiitOptions ?? defaultHiitOptions).primaryGoal
                              : workoutConfig.goals.primary
                          }
                          onChange={(e) =>
                            workoutConfig.hiitMode && !workoutConfig.amrapDensityMode
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
                          {workoutConfig.hiitMode && !workoutConfig.amrapDensityMode
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
                    {workoutConfig.hiitMode && !workoutConfig.amrapDensityMode && (
                      <p className="text-xs text-white/50">
                        For HIIT, the AI deprioritizes heavy barbell setups and favors Dumbbells,
                        Kettlebells, and Bodyweight for safety under fatigue.
                      </p>
                    )}
                    {workoutConfig.amrapDensityMode && (
                      <p className="text-xs text-white/50">
                        For Density-Based AMRAP, the AI favors practical, repeatable movements
                        (Dumbbells, Kettlebells, Bodyweight) for clean lap counting.
                      </p>
                    )}
                  </div>

                  {step1PromptStep === 'review' && (
                    <div className="border-orange-light/30 rounded-lg border bg-black/30 p-6">
                      <h3 className="mb-2 text-lg font-semibold text-white">
                        Review Step 1 prompt (Workout Architect)
                      </h3>
                      <p className="mb-4 text-sm text-white/70">
                        Edit the prompt below before generating. Only the Workout Architect step
                        uses this text; later steps still run automatically from its JSON output.
                      </p>
                      <div className="mb-4">
                        <label className="mb-1 block text-sm font-medium text-white/80">
                          User prompt
                        </label>
                        <textarea
                          value={editedStep1UserPrompt}
                          onChange={(e) => setEditedStep1UserPrompt(e.target.value)}
                          rows={12}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 max-h-[min(50vh,28rem)] w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 font-mono text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={cancelStep1PromptReview}
                          className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateFromEditedStep1Prompt}
                          disabled={chainLoading}
                          className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 text-sm font-bold text-black transition-colors disabled:opacity-50"
                        >
                          {chainLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Generate workout
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-white/10 bg-black/20 px-6 py-2 text-white hover:bg-white/5"
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy || step1PromptStep === 'review'}
                      className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 font-medium text-black disabled:opacity-50"
                    >
                      {previewingStep1Prompt || chainLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                      {previewingStep1Prompt
                        ? 'Preparing prompt...'
                        : chainLoading
                          ? 'Generating...'
                          : 'Generate Workout'}
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
