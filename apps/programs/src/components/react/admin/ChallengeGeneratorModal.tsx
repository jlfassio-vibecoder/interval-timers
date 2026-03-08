/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, AlertTriangle, LayoutList } from 'lucide-react';
import { toast } from 'sonner';
import type { ArchitectBlueprint, PromptChainMetadata } from '@/types/ai-program';
import type {
  ChallengeConfig,
  ChallengeTemplate,
  ChallengePersona,
  ChallengeMilestone,
} from '@/types/ai-challenge';
import {
  getAllZones,
  getZoneById,
  getAllEquipmentItems,
  type Zone,
} from '@/lib/supabase/client/equipment';
import ChallengeBlueprintEditor from './ChallengeBlueprintEditor';
import ArchitectBlueprintPreview from './ArchitectBlueprintPreview';
import ChainDebugPanel from './ChainDebugPanel';
import {
  saveChallengeToLibrary,
  updateChallenge,
} from '@/lib/supabase/client/challenge-persistence';
import { useAppContext } from '@/contexts/AppContext';

interface ChallengeChainResponse {
  challenge: ChallengeTemplate;
  chain_metadata: PromptChainMetadata;
}

type GenerationStep = 'config' | 'architect' | 'preview';

interface ChallengeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
  existingChallenge?: ChallengeTemplate;
  challengeConfig?: ChallengeConfig;
  editingChallengeId?: string;
  editingChainMetadata?: PromptChainMetadata;
  editingHeroImageUrl?: string;
  editingSectionImages?: Record<string, string>;
  onImagesUpdate?: () => void;
}

const DURATION_OPTIONS = [2, 3, 4, 5, 6] as const;

const ChallengeGeneratorModal: React.FC<ChallengeGeneratorModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  existingChallenge,
  challengeConfig: providedChallengeConfig,
  editingChallengeId,
  editingChainMetadata,
  editingHeroImageUrl,
  editingSectionImages,
  onImagesUpdate,
}) => {
  const { user } = useAppContext();
  const isEditMode = !!existingChallenge;

  const defaultConfig: ChallengeConfig = {
    challengeInfo: {
      title: '',
      description: '',
    },
    targetAudience: {
      ageRange: '26-35',
      sex: 'Male',
      weight: 180,
      experienceLevel: 'intermediate',
    },
    requirements: {
      durationWeeks: 4,
      theme: '',
    },
    medicalContext: {
      includeInjuries: false,
      includeConditions: false,
    },
    goals: {
      primary: 'Muscle Gain',
      secondary: 'Strength',
    },
  };

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [equipmentItems, setEquipmentItems] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig>(
    providedChallengeConfig || defaultConfig
  );

  const [generatedChallenge, setGeneratedChallenge] = useState<ChallengeTemplate | null>(
    existingChallenge || null
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [step, setStep] = useState<GenerationStep>(existingChallenge ? 'preview' : 'config');
  const [architectBlueprint, setArchitectBlueprint] = useState<ArchitectBlueprint | null>(null);
  const [architectMilestones, setArchitectMilestones] = useState<ChallengeMilestone[]>([]);

  const [chainMetadata, setChainMetadata] = useState<PromptChainMetadata | null>(null);
  const [chainStep, setChainStep] = useState(0);

  const [hasUnsavedBlueprintChanges, setHasUnsavedBlueprintChanges] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState<'modal' | 'cancel' | null>(null);

  useEffect(() => {
    if (existingChallenge) {
      setGeneratedChallenge(existingChallenge);
      setStep('preview');
      setChainMetadata(editingChainMetadata ?? null);
      if (providedChallengeConfig) {
        setChallengeConfig(providedChallengeConfig);
      } else {
        setChallengeConfig((prev) => ({
          ...prev,
          challengeInfo: {
            title: existingChallenge.title,
            description: existingChallenge.description,
          },
        }));
      }
    } else if (!isOpen) {
      setGeneratedChallenge(null);
      setChallengeConfig(defaultConfig);
      setStep('config');
      setArchitectBlueprint(null);
      setArchitectMilestones([]);
      setChainMetadata(null);
      setChainStep(0);
      setHasUnsavedBlueprintChanges(false);
      setPendingCloseAction(null);
    }
  }, [existingChallenge, providedChallengeConfig, editingChainMetadata, isOpen]);

  useEffect(() => {
    if (!isOpen || !hasUnsavedBlueprintChanges || step !== 'preview') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isOpen, hasUnsavedBlueprintChanges, step]);

  const handleRequestClose = () => {
    if (step === 'preview' && hasUnsavedBlueprintChanges) {
      setPendingCloseAction('modal');
    } else {
      onClose();
    }
  };

  const handleRequestCancel = () => {
    if (hasUnsavedBlueprintChanges) {
      setPendingCloseAction('cancel');
    } else {
      setStep('config');
      setChainMetadata(null);
    }
  };

  const handleConfirmLeave = () => {
    if (pendingCloseAction === 'modal') {
      setPendingCloseAction(null);
      setHasUnsavedBlueprintChanges(false);
      onClose();
    } else if (pendingCloseAction === 'cancel') {
      setPendingCloseAction(null);
      setHasUnsavedBlueprintChanges(false);
      setStep('config');
      setChainMetadata(null);
    }
  };

  const handleStay = useCallback(() => {
    setPendingCloseAction(null);
  }, []);

  useEffect(() => {
    if (pendingCloseAction == null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleStay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingCloseAction, handleStay]);

  const chainLoadingMessages = [
    'Step 1/4: Designing challenge structure...',
    'Step 2/4: Mapping movement patterns...',
    'Step 3/4: Selecting exercises...',
    'Step 4/4: Calculating progression...',
  ];

  const buildPersona = (): ChallengePersona => ({
    title: challengeConfig.challengeInfo.title.trim(),
    description: challengeConfig.challengeInfo.description.trim(),
    theme: challengeConfig.requirements.theme?.trim() || undefined,
    demographics: challengeConfig.targetAudience,
    medical: {
      injuries: challengeConfig.medicalContext?.includeInjuries
        ? challengeConfig.medicalContext.injuries || ''
        : '',
      conditions: challengeConfig.medicalContext?.includeConditions
        ? challengeConfig.medicalContext.conditions || ''
        : '',
    },
    goals: challengeConfig.goals,
    zoneId: selectedZone?.id ?? challengeConfig.zoneId,
    selectedEquipmentIds:
      selectedEquipmentIds.length > 0 ? selectedEquipmentIds : challengeConfig.selectedEquipmentIds,
    durationWeeks: challengeConfig.requirements.durationWeeks,
  });

  const handleGenerateArchitect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!challengeConfig.challengeInfo.title.trim()) {
      setError('Challenge title is required');
      return;
    }
    if (!challengeConfig.challengeInfo.description.trim()) {
      setError('Challenge description is required');
      return;
    }

    setLoading(true);
    setLoadingMessage('Designing challenge structure...');

    try {
      const payload = buildPersona();
      const response = await fetch('/api/ai/generate-challenge-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to generate structure';
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            errorMessage = parsed.error;
          }
        } catch {
          if (raw.trim().length > 0) {
            errorMessage = raw.length > 200 ? raw.slice(0, 200) + '…' : raw.trim();
          }
        }
        throw new Error(errorMessage);
      }

      const { architect, milestones } = await response.json();
      setArchitectBlueprint(architect);
      setArchitectMilestones(milestones || []);
      setStep('architect');
      toast.success('Structure generated', {
        description: 'Review and edit below, then generate detailed workouts.',
      });
    } catch (err) {
      console.error('[ChallengeGeneratorModal] Architect error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate structure';
      const lower = message.toLowerCase();
      if (
        lower.includes('fetch failed') ||
        lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('network error')
      ) {
        message = 'Network error. Check your connection and try again.';
      }
      setError(message);
      toast.error('Failed to generate structure', { description: message });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleGenerateChain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!challengeConfig.challengeInfo.title.trim()) {
      setError('Challenge title is required');
      return;
    }
    if (!challengeConfig.challengeInfo.description.trim()) {
      setError('Challenge description is required');
      return;
    }

    setLoading(true);
    setChainStep(0);
    setLoadingMessage(chainLoadingMessages[0]);

    const progressInterval = setInterval(() => {
      setChainStep((prev) => {
        const next = Math.min(prev + 1, 2);
        setLoadingMessage(chainLoadingMessages[next]);
        return next;
      });
    }, 5000);

    try {
      const payload = buildPersona();
      const response = await fetch('/api/ai/generate-challenge-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to generate challenge';
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            errorMessage = parsed.error;
          }
        } catch {
          if (raw.trim().length > 0) {
            errorMessage = raw.length > 200 ? raw.slice(0, 200) + '…' : raw.trim();
          }
        }
        throw new Error(errorMessage);
      }

      const chainResponse: ChallengeChainResponse = await response.json();

      setGeneratedChallenge(chainResponse.challenge);
      setChainMetadata(chainResponse.chain_metadata);
      setStep('preview');
      setLoading(false);
      setLoadingMessage('');
      setChainStep(4);

      toast.success('Challenge generated successfully!', {
        description: 'Review the challenge below, then save to library.',
      });
    } catch (err) {
      clearInterval(progressInterval);
      console.error('[ChallengeGeneratorModal] Chain error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate challenge';
      const lower = message.toLowerCase();
      if (
        lower.includes('fetch failed') ||
        lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('network error')
      ) {
        message = 'Network error. Check your connection and try again.';
      }
      setError(message);
      setLoading(false);
      setLoadingMessage('');
      setChainStep(0);
      toast.error('Failed to generate challenge', { description: message });
    }
  };

  const handleGenerateFromArchitect = async () => {
    if (!architectBlueprint || !architectMilestones.length) return;

    setError(null);
    setLoading(true);
    setChainStep(0);
    setLoadingMessage(chainLoadingMessages[0]);

    const progressInterval = setInterval(() => {
      setChainStep((prev) => {
        const next = Math.min(prev + 1, 2);
        setLoadingMessage(chainLoadingMessages[next]);
        return next;
      });
    }, 5000);

    try {
      const payload = {
        ...buildPersona(),
        architectBlueprint,
        milestones: architectMilestones,
      };

      const response = await fetch('/api/ai/generate-challenge-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to generate challenge';
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            errorMessage = parsed.error;
          }
        } catch {
          if (raw.trim().length > 0) {
            errorMessage = raw.length > 200 ? raw.slice(0, 200) + '…' : raw.trim();
          }
        }
        throw new Error(errorMessage);
      }

      const chainResponse: ChallengeChainResponse = await response.json();
      setGeneratedChallenge(chainResponse.challenge);
      setChainMetadata(chainResponse.chain_metadata);
      setStep('preview');
      setChainStep(4);
      toast.success('Challenge generated successfully!', {
        description: 'Review the challenge below, then save to library.',
      });
    } catch (err) {
      clearInterval(progressInterval);
      console.error('[ChallengeGeneratorModal] Chain from architect error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate challenge';
      const lower = message.toLowerCase();
      if (
        lower.includes('fetch failed') ||
        lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('network error')
      ) {
        message = 'Network error. Check your connection and try again.';
      }
      setError(message);
      toast.error('Failed to generate challenge', { description: message });
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setChainStep(0);
    }
  };

  const handleSaveToLibrary = async (editedChallenge: ChallengeTemplate) => {
    try {
      if (!user?.uid) {
        throw new Error('User must be authenticated to save challenges');
      }

      const config: ChallengeConfig = {
        challengeInfo: {
          title: editedChallenge.title,
          description: editedChallenge.description,
        },
        targetAudience: challengeConfig.targetAudience,
        requirements: {
          durationWeeks: editedChallenge.durationWeeks as 2 | 3 | 4 | 5 | 6,
          theme: editedChallenge.theme,
        },
        goals: challengeConfig.goals,
        zoneId: challengeConfig.zoneId,
        selectedEquipmentIds: challengeConfig.selectedEquipmentIds,
      };

      if (editingChallengeId) {
        await updateChallenge(editingChallengeId, editedChallenge, config);
      } else {
        await saveChallengeToLibrary(editedChallenge, config, user.uid, chainMetadata || undefined);
      }

      toast.success('Challenge saved to library!', {
        description: 'You can find it in the Challenge Factory.',
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      onGenerate();

      setTimeout(() => {
        onClose();
        setChallengeConfig(defaultConfig);
        setGeneratedChallenge(null);
        setStep('config');
        setSelectedZone(null);
        setSelectedEquipmentIds([]);
        setSaveSuccess(false);
        setChainMetadata(null);
        setChainStep(0);
      }, 2000);
    } catch (err) {
      console.error('[ChallengeGeneratorModal] Error saving to library:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save challenge to library';
      setError(errorMessage);

      toast.error('Failed to save challenge', {
        description: errorMessage,
        action: {
          label: 'Retry',
          onClick: () => handleSaveToLibrary(editedChallenge),
        },
      });
    }
  };

  useEffect(() => {
    const fetchZonesAndEquipment = async () => {
      try {
        const [zonesData, equipmentData] = await Promise.all([
          getAllZones(),
          getAllEquipmentItems(),
        ]);
        setZones(zonesData);
        setEquipmentItems(equipmentData);
      } catch (err) {
        console.error('[ChallengeGeneratorModal] Failed to fetch zones/equipment:', err);
      }
    };
    fetchZonesAndEquipment();
  }, []);

  const handleTargetAudienceChange = (field: string, value: string | number) => {
    setChallengeConfig((prev) => ({
      ...prev,
      targetAudience: {
        ...prev.targetAudience,
        [field]: value,
      },
    }));
  };

  const handleGoalChange = (field: 'primary' | 'secondary', value: string) => {
    setChallengeConfig((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [field]: value,
      },
    }));
  };

  const handleMedicalContextChange = (
    field: 'includeInjuries' | 'includeConditions' | 'injuries' | 'conditions',
    value: boolean | string
  ) => {
    setChallengeConfig((prev) => {
      const current = prev.medicalContext || {
        includeInjuries: false,
        includeConditions: false,
      };
      return {
        ...prev,
        medicalContext: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
          onClick={handleRequestClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)] ${
              step === 'preview' ? 'max-w-6xl' : step === 'architect' ? 'max-w-4xl' : 'max-w-3xl'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-orange-light" />
                <div>
                  <h2 className="font-heading text-2xl font-bold">
                    {isEditMode
                      ? 'Edit Challenge'
                      : step === 'architect'
                        ? 'Challenge Structure'
                        : step === 'preview'
                          ? 'Review Challenge'
                          : 'Challenge Factory'}
                  </h2>
                  <p className="text-sm text-white/60">
                    {isEditMode
                      ? 'Edit and update challenge details'
                      : step === 'architect'
                        ? 'Review structure, then generate detailed workouts'
                        : step === 'preview'
                          ? 'Review and save workouts'
                          : 'Create 2-6 week fitness challenges'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRequestClose}
                className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="border-orange-light/20 mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-orange-light"></div>
                  <p className="text-lg font-medium text-white">{loadingMessage}</p>
                  <div className="mt-4 flex gap-2">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        className={`h-2 w-8 rounded-full transition-colors ${
                          s <= chainStep + 1 ? 'bg-orange-light' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-white/60">This may take 30-60 seconds...</p>
                </div>
              ) : step === 'architect' && architectBlueprint ? (
                <>
                  {error && (
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                      <div className="flex-1">
                        <p className="font-medium text-red-300">Error</p>
                        <p className="mt-1 text-sm text-red-200">{error}</p>
                      </div>
                    </div>
                  )}
                  <ArchitectBlueprintPreview
                    architect={architectBlueprint}
                    onUpdate={(updated) => setArchitectBlueprint(updated)}
                    onGenerateWorkouts={handleGenerateFromArchitect}
                    onBack={() => {
                      setStep('config');
                      setArchitectBlueprint(null);
                      setArchitectMilestones([]);
                    }}
                    loading={loading}
                  />
                  {architectMilestones.length > 0 && (
                    <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                      <h4 className="mb-2 font-medium text-white">Milestones</h4>
                      <ul className="space-y-1 text-sm text-white/80">
                        {architectMilestones.map((m, i) => (
                          <li key={i}>
                            Week {m.week}: {m.label}
                            {m.checkInPrompt && ` — ${m.checkInPrompt}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : step === 'preview' && generatedChallenge ? (
                <>
                  {saveSuccess && (
                    <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-300">
                      {isEditMode
                        ? 'Challenge updated successfully!'
                        : 'Challenge saved to library successfully!'}
                    </div>
                  )}
                  {error && (
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                      <div className="flex-1">
                        <p className="font-medium text-red-300">Error</p>
                        <p className="mt-1 text-sm text-red-200">{error}</p>
                      </div>
                    </div>
                  )}
                  <ChallengeBlueprintEditor
                    initialData={generatedChallenge}
                    onSave={handleSaveToLibrary}
                    onCancel={handleRequestCancel}
                    onDirtyChange={setHasUnsavedBlueprintChanges}
                    challengeId={editingChallengeId}
                    heroImageUrl={editingHeroImageUrl}
                    sectionImages={editingSectionImages}
                    onImagesUpdate={onImagesUpdate}
                  />
                  {chainMetadata && <ChainDebugPanel metadata={chainMetadata} />}
                </>
              ) : (
                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                  {error && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                      <div className="flex-1">
                        <p className="font-medium text-red-300">Error</p>
                        <p className="mt-1 text-sm text-red-200">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Challenge Information
                    </h3>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={challengeConfig.challengeInfo.title}
                        onChange={(e) =>
                          setChallengeConfig((prev) => ({
                            ...prev,
                            challengeInfo: {
                              ...prev.challengeInfo,
                              title: e.target.value,
                            },
                          }))
                        }
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="Challenge title"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Description *
                      </label>
                      <textarea
                        value={challengeConfig.challengeInfo.description}
                        onChange={(e) =>
                          setChallengeConfig((prev) => ({
                            ...prev,
                            challengeInfo: {
                              ...prev.challengeInfo,
                              description: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="Challenge description"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Theme (optional)
                      </label>
                      <input
                        type="text"
                        value={challengeConfig.requirements.theme || ''}
                        onChange={(e) =>
                          setChallengeConfig((prev) => ({
                            ...prev,
                            requirements: {
                              ...prev.requirements,
                              theme: e.target.value || undefined,
                            },
                          }))
                        }
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="e.g. 30-Day Core, Sprint to Summer"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Challenge Parameters
                    </h3>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Duration *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DURATION_OPTIONS.map((weeks) => (
                          <button
                            key={weeks}
                            type="button"
                            onClick={() =>
                              setChallengeConfig((prev) => ({
                                ...prev,
                                requirements: {
                                  ...prev.requirements,
                                  durationWeeks: weeks,
                                },
                              }))
                            }
                            className={`rounded-lg border px-4 py-3 font-medium transition-colors ${
                              challengeConfig.requirements.durationWeeks === weeks
                                ? 'bg-orange-light/20 border-orange-light text-orange-light'
                                : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            {weeks} Weeks
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Equipment Profile
                      </label>
                      <select
                        value={selectedZone?.id || ''}
                        onChange={async (e) => {
                          const zoneId = e.target.value;
                          if (zoneId) {
                            try {
                              const zone = await getZoneById(zoneId);
                              if (zone) {
                                setSelectedZone(zone);
                                setSelectedEquipmentIds(zone.equipmentIds || []);
                                setChallengeConfig((prev) => ({
                                  ...prev,
                                  zoneId: zone.id,
                                  selectedEquipmentIds: zone.equipmentIds || [],
                                }));
                              }
                            } catch (err) {
                              console.error('[ChallengeGeneratorModal] Failed to fetch zone:', err);
                              setSelectedZone(null);
                              setSelectedEquipmentIds([]);
                            }
                          } else {
                            setSelectedZone(null);
                            setSelectedEquipmentIds([]);
                            setChallengeConfig((prev) => ({
                              ...prev,
                              zoneId: undefined,
                              selectedEquipmentIds: undefined,
                            }));
                          }
                        }}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                      >
                        <option value="">None - Generate without zone context</option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name} (
                            {zone.category.charAt(0).toUpperCase() + zone.category.slice(1)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedZone && (
                      <div className="border-orange-light/20 bg-orange-light/10 rounded-lg border p-4">
                        <div className="mb-2 font-medium text-white">{selectedZone.name}</div>
                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Equipment ({selectedEquipmentIds.length} selected)
                          </label>
                          <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
                            {selectedZone.equipmentIds.map((equipmentId) => {
                              const equipment = equipmentItems.find(
                                (item) => item.id === equipmentId
                              );
                              const isSelected = selectedEquipmentIds.includes(equipmentId);
                              return (
                                <label
                                  key={equipmentId}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-colors hover:bg-white/5"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const newIds = [...selectedEquipmentIds, equipmentId];
                                        setSelectedEquipmentIds(newIds);
                                        setChallengeConfig((prev) => ({
                                          ...prev,
                                          selectedEquipmentIds: newIds,
                                        }));
                                      } else {
                                        const newIds = selectedEquipmentIds.filter(
                                          (id) => id !== equipmentId
                                        );
                                        setSelectedEquipmentIds(newIds);
                                        setChallengeConfig((prev) => ({
                                          ...prev,
                                          selectedEquipmentIds: newIds,
                                        }));
                                      }
                                    }}
                                    className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                                  />
                                  <span
                                    className={`text-sm ${isSelected ? 'text-white' : 'text-white/50'}`}
                                  >
                                    {equipment?.name || `Equipment ${equipmentId}`}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedZone(null);
                            setSelectedEquipmentIds([]);
                            setChallengeConfig((prev) => ({
                              ...prev,
                              zoneId: undefined,
                              selectedEquipmentIds: undefined,
                            }));
                          }}
                          className="hover:text-orange-light/80 mt-3 text-sm text-orange-light underline"
                        >
                          Clear Zone
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">Target Persona</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Age Range *
                        </label>
                        <select
                          value={challengeConfig.targetAudience.ageRange}
                          onChange={(e) => handleTargetAudienceChange('ageRange', e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          <option value="18-25">18-25</option>
                          <option value="26-35">26-35</option>
                          <option value="36-45">36-45</option>
                          <option value="46-55">46-55</option>
                          <option value="56-65">56-65</option>
                          <option value="65+">65+</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Sex *
                        </label>
                        <select
                          value={challengeConfig.targetAudience.sex}
                          onChange={(e) => handleTargetAudienceChange('sex', e.target.value)}
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
                          min="50"
                          max="500"
                          value={challengeConfig.targetAudience.weight}
                          onChange={(e) =>
                            handleTargetAudienceChange('weight', parseInt(e.target.value) || 0)
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Skill Level *
                        </label>
                        <select
                          value={challengeConfig.targetAudience.experienceLevel}
                          onChange={(e) =>
                            handleTargetAudienceChange(
                              'experienceLevel',
                              e.target.value as 'beginner' | 'intermediate' | 'advanced'
                            )
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
                    <h3 className="font-heading text-lg font-bold text-white">
                      Medical Context (Optional)
                    </h3>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={challengeConfig.medicalContext?.includeInjuries || false}
                        onChange={(e) =>
                          handleMedicalContextChange('includeInjuries', e.target.checked)
                        }
                        className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                      />
                      <span className="text-sm font-medium text-white/80">
                        Include Injury Constraints?
                      </span>
                    </label>
                    {challengeConfig.medicalContext?.includeInjuries && (
                      <textarea
                        value={challengeConfig.medicalContext?.injuries || ''}
                        onChange={(e) => handleMedicalContextChange('injuries', e.target.value)}
                        rows={2}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="e.g., Right shoulder impingement"
                      />
                    )}
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={challengeConfig.medicalContext?.includeConditions || false}
                        onChange={(e) =>
                          handleMedicalContextChange('includeConditions', e.target.checked)
                        }
                        className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                      />
                      <span className="text-sm font-medium text-white/80">
                        Include Medical Conditions?
                      </span>
                    </label>
                    {challengeConfig.medicalContext?.includeConditions && (
                      <textarea
                        value={challengeConfig.medicalContext?.conditions || ''}
                        onChange={(e) => handleMedicalContextChange('conditions', e.target.value)}
                        rows={2}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="e.g., Non-Alcoholic Fatty Liver Disease (mild)"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">Goals</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Primary Goal *
                        </label>
                        <select
                          value={challengeConfig.goals.primary}
                          onChange={(e) => handleGoalChange('primary', e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          <option value="Fat Loss">Fat Loss</option>
                          <option value="Strength">Strength</option>
                          <option value="Muscle Gain">Muscle Gain</option>
                          <option value="Endurance">Endurance</option>
                          <option value="General Fitness">General Fitness</option>
                          <option value="Rehabilitation">Rehabilitation</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Secondary Goal *
                        </label>
                        <select
                          value={challengeConfig.goals.secondary}
                          onChange={(e) => handleGoalChange('secondary', e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          <option value="Fat Loss">Fat Loss</option>
                          <option value="Strength">Strength</option>
                          <option value="Muscle Gain">Muscle Gain</option>
                          <option value="Endurance">Endurance</option>
                          <option value="General Fitness">General Fitness</option>
                          <option value="Rehabilitation">Rehabilitation</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="order-2 rounded-lg border border-white/10 bg-black/20 px-6 py-2 text-white transition-colors hover:bg-white/5 disabled:opacity-50 sm:order-1"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={(e) => handleGenerateArchitect(e)}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/20 px-6 py-2 font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-50"
                      >
                        <LayoutList className="h-5 w-5" />
                        <span>{loading ? 'Generating...' : 'Review Structure First'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleGenerateChain(e)}
                        disabled={loading}
                        className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 font-medium text-black transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="h-5 w-5" />
                        <span>{loading ? 'Generating...' : 'Generate Challenge'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {pendingCloseAction != null && (
              <div
                className="border-orange-light/30 absolute inset-0 z-10 flex items-center justify-center rounded-2xl border bg-black/90 p-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="unsaved-changes-title"
              >
                <div className="w-full max-w-sm rounded-xl border border-white/10 bg-bg-dark p-6 shadow-xl">
                  <div className="mb-4 flex justify-center">
                    <div className="bg-orange-light/20 flex h-12 w-12 items-center justify-center rounded-full">
                      <AlertTriangle className="h-6 w-6 text-orange-light" />
                    </div>
                  </div>
                  <h3
                    id="unsaved-changes-title"
                    className="mb-2 text-center font-heading text-lg font-bold text-white"
                  >
                    Unsaved Changes
                  </h3>
                  <p className="mb-6 text-center text-sm text-white/70">
                    You have unsaved changes. Leave anyway?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleStay}
                      className="flex-1 rounded-lg border border-white/20 bg-white/5 py-2.5 font-medium text-white transition-colors hover:bg-white/10"
                    >
                      Stay
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmLeave}
                      className="hover:bg-orange-light/90 flex-1 rounded-lg bg-orange-light py-2.5 font-medium text-black transition-colors"
                    >
                      Leave anyway
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChallengeGeneratorModal;
