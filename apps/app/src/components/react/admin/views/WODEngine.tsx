/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WOD Engine: Level Selector + Generate one workout; save and publish (Supabase).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles,
  AlertCircle,
  Loader2,
  Upload,
  EyeOff,
  Eye,
  X,
  CheckCircle,
  Plus,
  RefreshCw,
  Dumbbell,
  TrendingUp,
  Zap,
  ArrowLeftRight,
  Clock,
  Timer,
  Repeat,
  List,
  Activity,
  Scale,
  Wind,
  User,
  Users,
  UsersRound,
} from 'lucide-react';
import LevelFilter, { type LevelFilterValue } from '@/components/react/LevelFilter';
import type { WODLevel, GeneratedWOD, Exercise } from '@/types';
import { getAllZones, getZoneById, getAllEquipmentItems } from '@/lib/supabase/client/equipment';
import type { Zone } from '@/lib/supabase/client/equipment';
import { supabase } from '@/lib/supabase/supabase-instance';
import {
  createGeneratedWOD,
  getGeneratedWODs,
  updateGeneratedWODStatus,
  updateExerciseOverride,
  updateGeneratedWODName,
} from '@/lib/supabase/client/generated-wods';
import type { GeneratedWODDoc, IterationMetadata } from '@/types/generated-wod';
import type { OverloadProtocol } from '@/types/overload-protocol';
import { getAllProtocols } from '@/types/overload-protocol';
import { getRecommendedProtocol } from '@/lib/wod-utils';
import ExerciseVisualizationLabModal from '@/components/react/admin/ExerciseVisualizationLabModal';
import ExerciseSwapModal from '@/components/react/admin/ExerciseSwapModal';
import ExercisePreviewModal from '@/components/react/admin/ExercisePreviewModal';
import { getGeneratedExercises } from '@/lib/supabase/client/generated-exercises';
import type { GeneratedExercise } from '@/types/generated-exercise';
import type {
  WODParameters,
  TimeDomainCategory,
  WorkoutFormat,
  MovementBias,
  ModalityBias,
  TargetArea,
} from '@/types/wod-parameters';
import {
  DEFAULT_WOD_PARAMETERS,
  mergeWODParameters,
  getAllTimeDomainOptions,
  getAllWorkoutFormats,
  TIME_DOMAIN_OPTIONS,
  WORKOUT_FORMAT_OPTIONS,
  LOAD_PROFILE_OPTIONS,
  SOCIAL_CONFIG_OPTIONS,
  MOVEMENT_BIAS_OPTIONS,
  MODALITY_BIAS_OPTIONS,
  TARGET_AREA_OPTIONS,
  getAllLoadProfileOptions,
  getAllSocialConfigOptions,
} from '@/types/wod-parameters';

/** Mode for the WOD Engine: create a new WOD or iterate from a previous one. */
type WODEngineMode = 'new' | 'iterate';

function formatDate(value: { toDate?: () => Date } | Date | null): string {
  if (!value) return '—';
  const d =
    value && typeof (value as { toDate?: () => Date }).toDate === 'function'
      ? (value as { toDate: () => Date }).toDate()
      : (value as Date);
  return d instanceof Date ? d.toLocaleDateString() : '—';
}

const WODEngine: React.FC = () => {
  // Mode selection state
  const [mode, setMode] = useState<WODEngineMode>('new');

  // New WOD mode state
  const [level, setLevel] = useState<WODLevel>('intermediate');
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [equipmentItems, setEquipmentItems] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);

  // WOD parameters (Step 2 & 3) — used for New WOD; Iterate inherits from source
  const [parameters, setParameters] = useState<WODParameters>(() => ({
    ...DEFAULT_WOD_PARAMETERS,
  }));
  const [exclusionInput, setExclusionInput] = useState('');

  // Iteration mode state
  const [selectedSourceWOD, setSelectedSourceWOD] = useState<GeneratedWODDoc | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<OverloadProtocol | null>(null);
  const [pendingIterationMetadata, setPendingIterationMetadata] =
    useState<IterationMetadata | null>(null);
  const [pendingResolvedFormat, setPendingResolvedFormat] = useState<WorkoutFormat | null>(null);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedWOD, setGeneratedWOD] = useState<GeneratedWOD | null>(null);

  // Saved WODs state
  const [savedWODs, setSavedWODs] = useState<GeneratedWODDoc[]>([]);
  const [savedWODsLoading, setSavedWODsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [selectedSavedWOD, setSelectedSavedWOD] = useState<GeneratedWODDoc | null>(null);
  const [labExercise, setLabExercise] = useState<string | null>(null);
  const [swapExercise, setSwapExercise] = useState<string | null>(null);
  const [previewExercise, setPreviewExercise] = useState<GeneratedExercise | null>(null);
  // Map of exercise name (lowercase) to GeneratedExercise for auto-matching
  const [approvedExercisesMap, setApprovedExercisesMap] = useState<Map<string, GeneratedExercise>>(
    new Map()
  );
  // Only setter is used (loading during save); underscore satisfies @typescript-eslint/no-unused-vars.
  const [_savingExerciseOverride, setSavingExerciseOverride] = useState(false);

  // Saved WOD modal: editable title (draft), AI suggestion, save name
  const [editingWODName, setEditingWODName] = useState<string | null>(null);
  const [savingWODName, setSavingWODName] = useState(false);
  const [suggestingWODName, setSuggestingWODName] = useState(false);

  // Filter approved WODs for iteration selection
  const approvedWODs = useMemo(
    () => savedWODs.filter((wod) => wod.status === 'approved'),
    [savedWODs]
  );

  // Get recommended protocol when source WOD is selected
  const recommendedProtocol = useMemo(() => {
    if (!selectedSourceWOD) return null;
    return getRecommendedProtocol(selectedSourceWOD);
  }, [selectedSourceWOD]);

  useEffect(() => {
    const fetchZonesAndEquipment = async () => {
      try {
        const [zonesData, equipmentData] = await Promise.all([
          getAllZones(),
          getAllEquipmentItems(),
        ]);
        setZones(zonesData);
        setEquipmentItems(equipmentData);
      } catch {
        // Zones/equipment load failed; form still usable with empty options
      }
    };
    fetchZonesAndEquipment();
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setUser(session?.user ? { id: session.user.id } : null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ? { id: session.user.id } : null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user == null) {
      setSavedWODsLoading(false);
      setSavedWODs([]);
      return;
    }

    const fetchSavedWODs = async () => {
      try {
        setSavedWODsLoading(true);
        setSaveError(null);
        const list = await getGeneratedWODs();
        setSavedWODs(list);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to fetch saved WODs');
        setSavedWODs([]);
      } finally {
        setSavedWODsLoading(false);
      }
    };
    fetchSavedWODs();
  }, [user]);

  // Sync draft title when saved WOD modal opens/closes
  useEffect(() => {
    if (selectedSavedWOD) {
      setEditingWODName(selectedSavedWOD.name);
    } else {
      setEditingWODName(null);
      setSuggestingWODName(false);
      setSavingWODName(false);
    }
  }, [selectedSavedWOD]);

  // Fetch approved exercises for auto-matching when saved WOD modal opens
  useEffect(() => {
    if (!selectedSavedWOD) {
      setApprovedExercisesMap(new Map());
      return;
    }

    const fetchApprovedExercises = async () => {
      try {
        const exercises = await getGeneratedExercises('approved');
        const map = new Map<string, GeneratedExercise>();
        exercises.forEach((ex) => {
          // Use lowercase for case-insensitive matching
          map.set(ex.exerciseName.toLowerCase(), ex);
        });
        setApprovedExercisesMap(map);
      } catch {
        setApprovedExercisesMap(new Map());
      }
    };

    fetchApprovedExercises();
  }, [selectedSavedWOD]);

  // Helper to check for auto-matched exercise
  const getMatchedExercise = (exerciseName: string): GeneratedExercise | null => {
    return approvedExercisesMap.get(exerciseName.toLowerCase()) ?? null;
  };

  const handleLevelChange = (value: LevelFilterValue) => {
    if (value === 'all') return;
    setLevel(value as WODLevel);
    setGeneratedWOD(null);
    setError(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGeneratedWOD(null);
    setPendingIterationMetadata(null);
    setLoading(true);

    // Validate iteration mode requirements
    if (mode === 'iterate') {
      if (!selectedSourceWOD) {
        setError('Please select a WOD to iterate from.');
        setLoading(false);
        return;
      }
      if (!selectedProtocol) {
        setError('Please select an overload protocol.');
        setLoading(false);
        return;
      }
      setLoadingMessage('Generating progressive iteration...');
    } else {
      setLoadingMessage('Generating WOD brief...');
    }

    try {
      setLoadingMessage('Prescribing workout...');

      // Build request body based on mode
      const requestBody: Record<string, unknown> = {
        level: mode === 'iterate' ? selectedSourceWOD?.level : level,
        zoneId: selectedZone?.id,
        selectedEquipmentIds: selectedEquipmentIds.length > 0 ? selectedEquipmentIds : undefined,
      };

      // Parameters: use current state (for iterate, state was populated from source WOD and can be edited)
      const paramsToSend: WODParameters = {
        ...parameters,
        allowedFormats:
          parameters.allowedFormats.length > 0
            ? parameters.allowedFormats
            : DEFAULT_WOD_PARAMETERS.allowedFormats,
      };
      requestBody.parameters = paramsToSend;

      // Add iteration fields if in iterate mode
      if (mode === 'iterate' && selectedSourceWOD && selectedProtocol) {
        requestBody.iteration_source_wod_id = selectedSourceWOD.id;
        requestBody.overload_protocol = selectedProtocol;
      }

      const response = await fetch('/api/ai/generate-wod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to generate WOD');
      }

      if (data?.wod) {
        setGeneratedWOD(data.wod as GeneratedWOD);
        if (data?.iteration) {
          setPendingIterationMetadata(data.iteration as IterationMetadata);
        }
        if (data?.resolvedFormat) {
          setPendingResolvedFormat(data.resolvedFormat as WorkoutFormat);
        } else {
          setPendingResolvedFormat(null);
        }
      } else {
        throw new Error('Invalid response: missing wod');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate WOD';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSave = async () => {
    if (!generatedWOD) return;
    if (!user) {
      setSaveError('You must be signed in to save a WOD.');
      return;
    }
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      // Use source WOD level if in iteration mode, otherwise use selected level
      const wodLevel = mode === 'iterate' && selectedSourceWOD ? selectedSourceWOD.level : level;

      const paramsToSave: WODParameters = parameters;

      await createGeneratedWOD({
        level: wodLevel,
        name: generatedWOD.name,
        genre: generatedWOD.genre,
        image: generatedWOD.image,
        day: generatedWOD.day,
        description: generatedWOD.description,
        intensity: generatedWOD.intensity,
        workoutDetail: generatedWOD.workoutDetail,
        status: 'pending',
        ...(pendingIterationMetadata && { iteration: pendingIterationMetadata }),
        parameters: paramsToSave,
        ...(pendingResolvedFormat && { resolvedFormat: pendingResolvedFormat }),
        ...(generatedWOD.targetVolumeMinutes != null && {
          targetVolumeMinutes: generatedWOD.targetVolumeMinutes,
        }),
        ...(generatedWOD.windowMinutes != null && { windowMinutes: generatedWOD.windowMinutes }),
        ...(generatedWOD.restLoad != null &&
          generatedWOD.restLoad !== '' && {
            restLoad: generatedWOD.restLoad,
          }),
      });
      setSaveSuccess(true);
      const list = await getGeneratedWODs();
      setSavedWODs(list);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save WOD');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      setPublishingId(id);
      setSaveError(null);
      await updateGeneratedWODStatus(id, 'approved');
      const list = await getGeneratedWODs();
      setSavedWODs(list);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to publish WOD');
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      setPublishingId(id);
      setSaveError(null);
      await updateGeneratedWODStatus(id, 'pending');
      const list = await getGeneratedWODs();
      setSavedWODs(list);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to unpublish WOD');
    } finally {
      setPublishingId(null);
    }
  };

  const handleOpenSavedWOD = (wod: GeneratedWODDoc) => {
    setSelectedSavedWOD(wod);
  };

  const handleCloseSavedWODModal = () => {
    setSelectedSavedWOD(null);
    setEditingWODName(null);
    setSuggestingWODName(false);
    setSavingWODName(false);
  };

  const draftName = editingWODName ?? selectedSavedWOD?.name ?? '';
  const nameChanged = selectedSavedWOD && draftName.trim() !== selectedSavedWOD.name.trim();
  const canSaveName =
    !!selectedSavedWOD && nameChanged && draftName.trim().length > 0 && !savingWODName;

  const handleSuggestWODName = async () => {
    if (!selectedSavedWOD || suggestingWODName) return;
    setSuggestingWODName(true);
    try {
      const res = await fetch('/api/ai/suggest-wod-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selectedSavedWOD.level,
          description: selectedSavedWOD.description ?? undefined,
          genre: selectedSavedWOD.genre ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to suggest name');
      const suggestion =
        typeof data?.suggestion === 'string' ? data.suggestion.trim().slice(0, 80) : '';
      if (suggestion) setEditingWODName(suggestion);
    } catch (err) {
      // Use toast for suggest failures so saveError stays for save operations only (per PR review).
      toast.error(err instanceof Error ? err.message : 'Failed to suggest name');
    } finally {
      setSuggestingWODName(false);
    }
  };

  const handleSaveWODName = async () => {
    if (!selectedSavedWOD || !canSaveName) return;
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setSavingWODName(true);
    setSaveError(null);
    try {
      await updateGeneratedWODName(selectedSavedWOD.id, trimmed);
      setSelectedSavedWOD((prev) => (prev ? { ...prev, name: trimmed } : prev));
      setSavedWODs((prev) =>
        prev.map((wod) => (wod.id === selectedSavedWOD.id ? { ...wod, name: trimmed } : wod))
      );
      setEditingWODName(trimmed);
      toast.success('Title Saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setSavingWODName(false);
    }
  };

  const handleOpenLab = (exerciseName: string) => {
    setLabExercise(exerciseName);
  };

  const handleCloseLab = () => {
    setLabExercise(null);
  };

  const handleOpenSwap = (exerciseName: string) => {
    setSwapExercise(exerciseName);
  };

  const handleCloseSwap = () => {
    setSwapExercise(null);
  };

  const handleSwapExercise = async (exercise: Exercise) => {
    if (!selectedSavedWOD || !swapExercise) return;
    setSavingExerciseOverride(true);
    try {
      await updateExerciseOverride(selectedSavedWOD.id, swapExercise, exercise);
      // Update local state to reflect the change
      setSelectedSavedWOD((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exerciseOverrides: {
            ...prev.exerciseOverrides,
            [swapExercise]: exercise,
          },
        };
      });
      // Also update the savedWODs list
      setSavedWODs((prev) =>
        prev.map((wod) =>
          wod.id === selectedSavedWOD.id
            ? {
                ...wod,
                exerciseOverrides: {
                  ...wod.exerciseOverrides,
                  [swapExercise]: exercise,
                },
              }
            : wod
        )
      );
      setSwapExercise(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to swap exercise');
    } finally {
      setSavingExerciseOverride(false);
    }
  };

  const handleSaveExerciseToWOD = async (exercise: Exercise) => {
    if (!selectedSavedWOD || !labExercise) return;
    setSavingExerciseOverride(true);
    try {
      await updateExerciseOverride(selectedSavedWOD.id, labExercise, exercise);
      // Update local state to reflect the change
      setSelectedSavedWOD((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exerciseOverrides: {
            ...prev.exerciseOverrides,
            [labExercise]: exercise,
          },
        };
      });
      // Also update the savedWODs list
      setSavedWODs((prev) =>
        prev.map((wod) =>
          wod.id === selectedSavedWOD.id
            ? {
                ...wod,
                exerciseOverrides: {
                  ...wod.exerciseOverrides,
                  [labExercise]: exercise,
                },
              }
            : wod
        )
      );
      setLabExercise(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save exercise');
    } finally {
      setSavingExerciseOverride(false);
    }
  };

  // Handle mode change and reset related state
  const handleModeChange = (newMode: WODEngineMode) => {
    setMode(newMode);
    setGeneratedWOD(null);
    setPendingIterationMetadata(null);
    setPendingResolvedFormat(null);
    setError(null);
    if (newMode === 'new') {
      setSelectedSourceWOD(null);
      setSelectedProtocol(null);
    }
  };

  // Handle source WOD selection
  const handleSourceWODSelect = (wodId: string) => {
    const wod = approvedWODs.find((w) => w.id === wodId) ?? null;
    setSelectedSourceWOD(wod);
    if (wod) {
      const recommended = getRecommendedProtocol(wod);
      setSelectedProtocol(recommended);
      // Inherit parameters from source WOD for iteration (admin can still edit before generating)
      setParameters(mergeWODParameters(wod.parameters ?? undefined));
    } else {
      setSelectedProtocol(null);
      setParameters({ ...DEFAULT_WOD_PARAMETERS });
    }
    setGeneratedWOD(null);
    setPendingIterationMetadata(null);
    setPendingResolvedFormat(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">WOD Engine</h1>
        <p className="mt-2 text-white/60">
          Generate one Workout of the Day for the selected level. Save as draft, then publish to
          make it public (no paywall).
        </p>
      </div>

      <form onSubmit={handleGenerate} className="space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="font-medium text-red-300">Error</p>
              <p className="mt-1 text-sm text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Mode Selection */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <h2 className="mb-4 font-heading text-lg font-bold text-white">Generation Mode</h2>
          <p className="mb-4 text-sm text-white/60">Choose how you want to generate the WOD.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* New WOD Card */}
            <button
              type="button"
              onClick={() => handleModeChange('new')}
              className={`flex flex-col items-start rounded-xl border-2 p-6 text-left transition-all ${
                mode === 'new'
                  ? 'bg-orange-light/10 border-orange-light'
                  : 'border-white/10 bg-black/20 hover:border-white/30'
              }`}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${
                  mode === 'new' ? 'bg-orange-light/20' : 'bg-white/10'
                }`}
              >
                <Plus
                  className={`h-6 w-6 ${mode === 'new' ? 'text-orange-light' : 'text-white/60'}`}
                />
              </div>
              <h3 className="font-heading text-lg font-bold text-white">New WOD</h3>
              <p className="mt-1 text-sm text-white/60">
                Start fresh with a new WOD for your selected level and equipment.
              </p>
            </button>

            {/* Iterate Previous Card */}
            <button
              type="button"
              onClick={() => handleModeChange('iterate')}
              disabled={approvedWODs.length === 0}
              className={`flex flex-col items-start rounded-xl border-2 p-6 text-left transition-all ${
                mode === 'iterate'
                  ? 'border-amber-500 bg-amber-500/10'
                  : approvedWODs.length === 0
                    ? 'cursor-not-allowed border-white/5 bg-black/10 opacity-50'
                    : 'border-white/10 bg-black/20 hover:border-white/30'
              }`}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${
                  mode === 'iterate' ? 'bg-amber-500/20' : 'bg-white/10'
                }`}
              >
                <RefreshCw
                  className={`h-6 w-6 ${mode === 'iterate' ? 'text-amber-500' : 'text-white/60'}`}
                />
              </div>
              <h3 className="font-heading text-lg font-bold text-white">Iterate Previous</h3>
              <p className="mt-1 text-sm text-white/60">
                {approvedWODs.length === 0
                  ? 'No published WODs available. Publish a WOD first to iterate.'
                  : 'Progress from a saved WOD using an overload protocol.'}
              </p>
            </button>
          </div>
        </div>

        {/* Conditionally show New WOD or Iterate flow */}
        {mode === 'new' ? (
          <>
            {/* Step 1: The Basics */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <h2 className="mb-1 font-heading text-sm font-medium text-white/60">
                Step 1: The Basics
              </h2>
              <h3 className="mb-4 font-heading text-lg font-bold text-white">Level Selector</h3>
              <p className="mb-4 text-sm text-white/60">
                Select the user level the WOD will be designed for. The engine creates exactly one
                workout for this level.
              </p>
              <LevelFilter
                variant="wod"
                selectedLevel={level as LevelFilterValue}
                onLevelChange={handleLevelChange}
                label="Level"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <h3 className="mb-4 font-heading text-lg font-bold text-white">
                Zone & Equipment (Optional)
              </h3>
              <select
                value={selectedZone?.id ?? ''}
                onChange={async (e) => {
                  const zoneId = e.target.value;
                  if (zoneId) {
                    try {
                      const zone = await getZoneById(zoneId);
                      if (zone) {
                        setSelectedZone(zone);
                        setSelectedEquipmentIds(zone.equipmentIds ?? []);
                      } else {
                        setSelectedZone(null);
                        setSelectedEquipmentIds([]);
                      }
                    } catch {
                      setSelectedZone(null);
                      setSelectedEquipmentIds([]);
                    }
                  } else {
                    setSelectedZone(null);
                    setSelectedEquipmentIds([]);
                  }
                }}
                className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
              >
                <option value="">None — generate without zone context</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              {selectedZone && (
                <div className="border-orange-light/20 bg-orange-light/10 mt-4 rounded-lg border p-4">
                  <div className="mb-2 font-medium text-white">{selectedZone.name}</div>
                  <label className="mb-2 block text-xs font-medium text-white/80">
                    Equipment ({selectedEquipmentIds.length} selected)
                  </label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-white/10 bg-black/20 p-3">
                    {(selectedZone.equipmentIds ?? []).map((equipmentId) => {
                      const item = equipmentItems.find((i) => i.id === equipmentId);
                      const isSelected = selectedEquipmentIds.includes(equipmentId);
                      return (
                        <label
                          key={equipmentId}
                          className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEquipmentIds((prev) =>
                                  prev.includes(equipmentId) ? prev : [...prev, equipmentId]
                                );
                              } else {
                                setSelectedEquipmentIds((prev) =>
                                  prev.filter((id) => id !== equipmentId)
                                );
                              }
                            }}
                            className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                          />
                          <span className={isSelected ? 'text-white' : 'text-white/50'}>
                            {item?.name ?? equipmentId}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedZone(null);
                      setSelectedEquipmentIds([]);
                    }}
                    className="hover:text-orange-light/80 mt-3 text-sm text-orange-light underline"
                  >
                    Clear zone
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: The Parameters */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <h2 className="mb-1 font-heading text-sm font-medium text-white/60">
                Step 2: The Parameters
              </h2>
              <p className="mb-4 text-sm text-white/60">
                Control stimulus, format, and logistics of the session.
              </p>

              {/* Time Domain */}
              <div className="mb-6">
                <label className="mb-2 block font-heading text-sm font-bold text-white">
                  Target Time
                </label>
                <div className="flex flex-wrap gap-2">
                  {getAllTimeDomainOptions().map((opt) => {
                    const Icon = opt.icon === 'zap' ? Zap : opt.icon === 'clock' ? Clock : Timer;
                    const isSelected = parameters.timeDomain.category === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setParameters((p) => ({
                            ...p,
                            timeDomain: { ...p.timeDomain, category: opt.id as TimeDomainCategory },
                          }))
                        }
                        className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm transition-all ${
                          isSelected
                            ? 'bg-orange-light/10 border-orange-light text-white'
                            : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{opt.name}</span>
                        <span className="text-xs opacity-80">({opt.rangeLabel})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-white/60">Time cap (min):</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={parameters.timeDomain.timeCapMinutes ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === '' ? undefined : parseInt(v, 10);
                      setParameters((p) => ({
                        ...p,
                        timeDomain: {
                          ...p.timeDomain,
                          timeCapMinutes: num !== undefined && !Number.isNaN(num) ? num : undefined,
                        },
                      }));
                    }}
                    placeholder="Optional"
                    className="w-20 rounded border border-white/10 bg-black/20 px-2 py-1 text-sm text-white"
                  />
                </div>
              </div>

              {/* Workout Format (multi-select) */}
              <div className="mb-6">
                <label className="mb-2 block font-heading text-sm font-bold text-white">
                  Format (select allowed; AI picks one)
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {getAllWorkoutFormats().map((opt) => {
                    const Icon =
                      opt.icon === 'repeat'
                        ? Repeat
                        : opt.icon === 'timer'
                          ? Timer
                          : opt.icon === 'list'
                            ? List
                            : opt.icon === 'trending-up'
                              ? TrendingUp
                              : Activity;
                    const isSelected = parameters.allowedFormats.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                          isSelected
                            ? 'border-orange-light/50 bg-orange-light/10'
                            : 'border-white/10 bg-black/20 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setParameters((p) => ({
                              ...p,
                              allowedFormats: e.target.checked
                                ? [...p.allowedFormats, opt.id]
                                : p.allowedFormats.filter((f) => f !== opt.id),
                            }));
                          }}
                          className="h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light"
                        />
                        <Icon className="h-4 w-4 text-white/70" />
                        <span className="text-sm text-white">{opt.shortName}</span>
                      </label>
                    );
                  })}
                </div>
                {parameters.allowedFormats.length === 0 && (
                  <p className="mt-1 text-xs text-amber-400">
                    Select at least one format (or all). Default: all allowed.
                  </p>
                )}
              </div>

              {/* Bias: Movement, Modality, Target Area */}
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-heading text-sm font-bold text-white">
                    Movement Bias
                  </label>
                  <select
                    value={parameters.movementBias}
                    onChange={(e) =>
                      setParameters((p) => ({
                        ...p,
                        movementBias: e.target.value as MovementBias,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  >
                    {Object.values(MOVEMENT_BIAS_OPTIONS).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-heading text-sm font-bold text-white">
                    Modality Bias
                  </label>
                  <select
                    value={parameters.modalityBias}
                    onChange={(e) =>
                      setParameters((p) => ({
                        ...p,
                        modalityBias: e.target.value as ModalityBias,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  >
                    {Object.values(MODALITY_BIAS_OPTIONS).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-heading text-sm font-bold text-white">
                    Target Area
                  </label>
                  <select
                    value={parameters.targetArea}
                    onChange={(e) =>
                      setParameters((p) => ({
                        ...p,
                        targetArea: e.target.value as TargetArea,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  >
                    {Object.values(TARGET_AREA_OPTIONS).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Load Profile */}
              <div className="mb-6">
                <label className="mb-2 block font-heading text-sm font-bold text-white">
                  Load Profile
                </label>
                <div className="flex flex-wrap gap-2">
                  {getAllLoadProfileOptions().map((opt) => {
                    const Icon =
                      opt.icon === 'dumbbell' ? Dumbbell : opt.icon === 'scale' ? Scale : Wind;
                    const isSelected = parameters.loadProfile === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setParameters((p) => ({ ...p, loadProfile: opt.id }))}
                        className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm transition-all ${
                          isSelected
                            ? 'bg-orange-light/10 border-orange-light text-white'
                            : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Social Config */}
              <div>
                <label className="mb-2 block font-heading text-sm font-bold text-white">
                  Social Configuration
                </label>
                <div className="flex flex-wrap gap-2">
                  {getAllSocialConfigOptions().map((opt) => {
                    const Icon =
                      opt.icon === 'user' ? User : opt.icon === 'users-two' ? UsersRound : Users;
                    const isSelected = parameters.socialConfig === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setParameters((p) => ({ ...p, socialConfig: opt.id }))}
                        className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm transition-all ${
                          isSelected
                            ? 'bg-orange-light/10 border-orange-light text-white'
                            : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 3: Safety Checks — Exclusions */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <h2 className="mb-1 font-heading text-sm font-medium text-white/60">
                Step 3: Safety Checks
              </h2>
              <p className="mb-4 text-sm text-white/60">
                Blacklist equipment or movements (e.g., rower broken, no running).
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={exclusionInput}
                  onChange={(e) => setExclusionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = exclusionInput.trim();
                      if (trimmed && !parameters.exclusions.includes(trimmed)) {
                        setParameters((p) => ({
                          ...p,
                          exclusions: [...p.exclusions, trimmed],
                        }));
                        setExclusionInput('');
                      }
                    }
                  }}
                  placeholder="Add exclusion (e.g. Rower, Running)"
                  className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = exclusionInput.trim();
                    if (trimmed && !parameters.exclusions.includes(trimmed)) {
                      setParameters((p) => ({
                        ...p,
                        exclusions: [...p.exclusions, trimmed],
                      }));
                      setExclusionInput('');
                    }
                  }}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
                >
                  Add
                </button>
              </div>
              {parameters.exclusions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {parameters.exclusions.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-200"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() =>
                          setParameters((p) => ({
                            ...p,
                            exclusions: p.exclusions.filter((x) => x !== item),
                          }))
                        }
                        className="rounded-full p-0.5 hover:bg-amber-500/30"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Iteration Mode: WOD Selection */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <h2 className="mb-4 font-heading text-lg font-bold text-white">Select Source WOD</h2>
              <p className="mb-4 text-sm text-white/60">
                Choose a published WOD to iterate from. The new workout will be a progressive
                version based on the selected overload protocol.
              </p>
              <select
                value={selectedSourceWOD?.id ?? ''}
                onChange={(e) => handleSourceWODSelect(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Select a WOD to iterate...</option>
                {approvedWODs.map((wod) => (
                  <option key={wod.id} value={wod.id}>
                    {wod.name} — {wod.level} — {formatDate(wod.createdAt)}
                    {wod.iteration ? ` (Iteration #${wod.iteration.iteration_number})` : ''}
                  </option>
                ))}
              </select>

              {/* Source WOD Preview */}
              {selectedSourceWOD && (
                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-white">
                        {selectedSourceWOD.name}
                      </h3>
                      <p className="text-xs capitalize text-white/60">
                        {selectedSourceWOD.level}
                        {selectedSourceWOD.iteration && (
                          <span className="ml-2 text-amber-400">
                            Iteration #{selectedSourceWOD.iteration.iteration_number}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="mb-3 text-sm text-white/60">{selectedSourceWOD.description}</p>
                  {selectedSourceWOD.workoutDetail && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(['warmup', 'main', 'finisher', 'cooldown'] as const).map((blockKey) => {
                        const block = selectedSourceWOD.workoutDetail[blockKey];
                        if (!block) return null;
                        return (
                          <div
                            key={blockKey}
                            className="rounded border border-white/10 bg-black/20 p-2"
                          >
                            <p className="text-xs font-medium text-amber-400">{block.title}</p>
                            <p className="text-xs text-white/40">
                              {block.exercises.length} exercises
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Parameters inherited from source WOD (read-only preview) */}
              {selectedSourceWOD && (
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <h4 className="mb-2 font-heading text-sm font-bold text-white/90">
                    Parameters (inherited — used for this iteration)
                  </h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                    <span>
                      Time: {TIME_DOMAIN_OPTIONS[parameters.timeDomain.category].shortName}
                      {parameters.timeDomain.timeCapMinutes != null &&
                        `, cap ${parameters.timeDomain.timeCapMinutes} min`}
                    </span>
                    <span>
                      Formats:{' '}
                      {parameters.allowedFormats
                        .map((f) => WORKOUT_FORMAT_OPTIONS[f]?.shortName ?? f)
                        .join(', ')}
                    </span>
                    <span>Load: {LOAD_PROFILE_OPTIONS[parameters.loadProfile].shortName}</span>
                    <span>Social: {SOCIAL_CONFIG_OPTIONS[parameters.socialConfig].name}</span>
                    {parameters.exclusions.length > 0 && (
                      <span>Exclude: {parameters.exclusions.join(', ')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Iteration Mode: Protocol Selection */}
            {selectedSourceWOD && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
                <h2 className="mb-4 font-heading text-lg font-bold text-white">
                  Select Overload Protocol
                </h2>
                <p className="mb-4 text-sm text-white/60">
                  Choose how the workout should progress. The recommended protocol is based on the
                  exercises in the source WOD.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {getAllProtocols().map((protocol) => {
                    const isSelected = selectedProtocol === protocol.id;
                    const isRecommended = recommendedProtocol === protocol.id;
                    const IconComponent =
                      protocol.icon === 'weight'
                        ? Dumbbell
                        : protocol.icon === 'trending-up'
                          ? TrendingUp
                          : Zap;
                    return (
                      <button
                        key={protocol.id}
                        type="button"
                        onClick={() => setSelectedProtocol(protocol.id)}
                        className={`relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-white/10 bg-black/20 hover:border-white/30'
                        }`}
                      >
                        {isRecommended && (
                          <span className="absolute -top-2 right-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-medium text-black">
                            Recommended
                          </span>
                        )}
                        <div
                          className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${
                            isSelected ? 'bg-amber-500/20' : 'bg-white/10'
                          }`}
                        >
                          <IconComponent
                            className={`h-5 w-5 ${isSelected ? 'text-amber-500' : 'text-white/60'}`}
                          />
                        </div>
                        <h3 className="font-heading text-sm font-bold text-white">
                          {protocol.name}
                        </h3>
                        <p className="mt-1 text-xs text-white/60">{protocol.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {protocol.bestFor.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/40"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={loading || (mode === 'iterate' && (!selectedSourceWOD || !selectedProtocol))}
          className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black"></span>
              <span>{loadingMessage || 'Generating...'}</span>
            </>
          ) : mode === 'iterate' ? (
            <>
              <RefreshCw className="h-5 w-5" />
              <span>Generate Iteration</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span>Generate WOD</span>
            </>
          )}
        </button>
      </form>

      {/* Generated WOD preview */}
      {generatedWOD && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-heading text-xl font-bold text-white">{generatedWOD.name} WOD</h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-orange-light transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save as draft'}</span>
            </button>
          </div>
          {saveSuccess && (
            <p className="mb-4 text-sm text-green-400">
              WOD saved. It appears in Saved WODs below.
            </p>
          )}
          {saveError && <p className="mb-4 text-sm text-red-400">{saveError}</p>}
          <p className="mb-4 text-sm text-white/60">{generatedWOD.description}</p>
          {generatedWOD.workoutDetail && (
            <div className="space-y-4">
              {(
                [
                  'warmup',
                  'main',
                  'finisher',
                  'cooldown',
                ] as (keyof typeof generatedWOD.workoutDetail)[]
              ).map((blockKey) => {
                const block = generatedWOD.workoutDetail![blockKey];
                if (!block) return null;
                return (
                  <div key={blockKey} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="font-heading font-bold text-orange-light">{block.title}</h3>
                    <p className="text-xs text-white/60">{block.duration}</p>
                    <ul className="mt-2 list-inside list-disc text-sm text-white/90">
                      {block.exercises.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Saved WODs */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <h2 className="mb-4 font-heading text-lg font-bold text-white">Saved WODs</h2>
        {saveError && !generatedWOD && <p className="mb-4 text-sm text-red-400">{saveError}</p>}
        {savedWODsLoading ? (
          <p className="text-white/60">Loading saved WODs...</p>
        ) : savedWODs.length === 0 ? (
          <p className="text-white/60">
            No saved WODs yet. Generate a WOD and click Save as draft.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedWODs.map((wod) => (
              <div key={wod.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading font-bold text-white">{wod.name} WOD</h3>
                    <p className="text-xs capitalize text-white/60">{wod.level}</p>
                    <p className="mt-1 text-xs text-white/50">
                      {formatDate(wod.createdAt)}
                      {' · '}
                      <span
                        className={wod.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}
                      >
                        {wod.status === 'approved' ? 'Published' : 'Draft'}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenSavedWOD(wod)}
                      className="rounded p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      title="View WOD"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {wod.status === 'approved' ? (
                      <button
                        type="button"
                        onClick={() => handleUnpublish(wod.id)}
                        disabled={publishingId === wod.id}
                        className="rounded p-2 text-white/70 transition-colors hover:bg-yellow-500/20 hover:text-yellow-300 disabled:opacity-50"
                        title="Unpublish WOD"
                      >
                        {publishingId === wod.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePublish(wod.id)}
                        disabled={publishingId === wod.id}
                        className="rounded p-2 text-white/70 transition-colors hover:bg-green-500/20 hover:text-green-300 disabled:opacity-50"
                        title="Publish WOD"
                      >
                        {publishingId === wod.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved WOD detail modal */}
      <AnimatePresence>
        {selectedSavedWOD && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
            onClick={handleCloseSavedWODModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)]"
            >
              {/* Header: editable title, Suggest with AI, Save name */}
              <div className="border-b border-white/10 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setEditingWODName(e.target.value)}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full min-w-[120px] max-w-md rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 font-heading text-xl font-bold text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="WOD title"
                      />
                      <span className="shrink-0 font-heading text-xl font-bold text-white/70">
                        WOD
                      </span>
                    </div>
                    <p className="mt-1 text-sm capitalize text-white/60">
                      {selectedSavedWOD.level}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      {formatDate(selectedSavedWOD.createdAt)}
                      {' · '}
                      <span
                        className={
                          selectedSavedWOD.status === 'approved'
                            ? 'text-green-400'
                            : 'text-yellow-400'
                        }
                      >
                        {selectedSavedWOD.status === 'approved' ? 'Published' : 'Draft'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseSavedWODModal}
                    className="shrink-0 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSuggestWODName}
                    disabled={suggestingWODName}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                  >
                    {suggestingWODName ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Suggesting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-orange-light" />
                        Suggest with AI
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWODName}
                    disabled={!canSaveName}
                    className="hover:bg-orange-light/90 flex items-center gap-1.5 rounded-lg bg-orange-light px-3 py-1.5 text-sm font-medium text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingWODName ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save name'
                    )}
                  </button>
                </div>
              </div>

              {/* Body: workout blocks (same layout as Generated WOD preview) */}
              <div className="max-h-[60vh] overflow-y-auto p-6">
                {selectedSavedWOD.description && (
                  <p className="mb-4 text-sm text-white/60">{selectedSavedWOD.description}</p>
                )}
                <p className="mb-4 text-xs text-white/50">
                  Exercises with a <span className="text-blue-400">blue</span> indicator are
                  auto-matched to published exercises. Click the eye icon to preview, or use the
                  sparkle/swap icons to customize.
                </p>
                {selectedSavedWOD.workoutDetail ? (
                  <div className="space-y-4">
                    {(
                      [
                        'warmup',
                        'main',
                        'finisher',
                        'cooldown',
                      ] as (keyof typeof selectedSavedWOD.workoutDetail)[]
                    ).map((blockKey) => {
                      const block = selectedSavedWOD.workoutDetail[blockKey];
                      if (!block) return null;
                      return (
                        <div
                          key={blockKey}
                          className="rounded-lg border border-white/10 bg-black/20 p-4"
                        >
                          <h3 className="font-heading font-bold text-orange-light">
                            {block.title}
                          </h3>
                          <p className="text-xs text-white/60">{block.duration}</p>
                          <ul className="mt-2 space-y-1">
                            {block.exercises.map((ex, i) => {
                              const hasOverride = !!selectedSavedWOD.exerciseOverrides?.[ex];
                              const matchedExercise = getMatchedExercise(ex);
                              const hasMatch = !!matchedExercise && !hasOverride;
                              return (
                                <li key={i}>
                                  <div className="flex items-center justify-between rounded px-2 py-1 transition-colors hover:bg-white/5">
                                    {/* Exercise name with status indicator */}
                                    <div className="flex items-center gap-2">
                                      {hasOverride ? (
                                        <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                                      ) : hasMatch ? (
                                        <CheckCircle className="h-4 w-4 shrink-0 text-blue-400" />
                                      ) : (
                                        <span className="h-4 w-4 shrink-0 rounded-full border border-white/30" />
                                      )}
                                      <span
                                        className={`text-sm ${
                                          hasOverride
                                            ? 'text-white'
                                            : hasMatch
                                              ? 'text-blue-300'
                                              : 'text-white/90'
                                        }`}
                                      >
                                        {ex}
                                      </span>
                                      {hasMatch && (
                                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">
                                          matched
                                        </span>
                                      )}
                                    </div>
                                    {/* Action buttons */}
                                    <div className="flex gap-1">
                                      {/* Eye icon - only show if auto-matched */}
                                      {hasMatch && matchedExercise && (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewExercise(matchedExercise)}
                                          className="rounded p-1.5 text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
                                          title="View matched exercise"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenLab(ex)}
                                        className="rounded p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-orange-light"
                                        title="Generate with Visualization Lab"
                                      >
                                        <Sparkles className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSwap(ex)}
                                        className="rounded p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-amber-400"
                                        title="Swap with existing exercise"
                                      >
                                        <ArrowLeftRight className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/50">No workout detail available.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise Visualization Lab Modal */}
      {labExercise && (
        <ExerciseVisualizationLabModal
          isOpen={!!labExercise}
          onClose={handleCloseLab}
          exerciseName={labExercise}
          onSave={handleSaveExerciseToWOD}
        />
      )}

      {/* Exercise Swap Modal */}
      {swapExercise && (
        <ExerciseSwapModal
          isOpen={!!swapExercise}
          onClose={handleCloseSwap}
          originalExerciseName={swapExercise}
          onSwap={handleSwapExercise}
        />
      )}

      {/* Exercise Preview Modal (for auto-matched exercises) */}
      {previewExercise && (
        <ExercisePreviewModal
          isOpen={!!previewExercise}
          onClose={() => setPreviewExercise(null)}
          exercise={previewExercise}
        />
      )}
    </div>
  );
};

export default WODEngine;
