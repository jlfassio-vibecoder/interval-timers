/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, AlertTriangle, LayoutList } from 'lucide-react';
import { toast } from 'sonner';
import type {
  ProgramConfig,
  ProgramTemplate,
  ProgramPersona,
  ProgramBlueprint,
  ArchitectBlueprint,
  ChainGenerationResponse,
  PromptChainMetadata,
} from '@/types/ai-program';
import {
  getAllZones,
  getZoneById,
  getAllEquipmentItems,
  type Zone,
} from '@/lib/supabase/client/equipment';
import ProgramBlueprintEditor from './ProgramBlueprintEditor';
import BlueprintPreview from './BlueprintPreview';
import ArchitectBlueprintPreview from './ArchitectBlueprintPreview';
import ChainDebugPanel from './ChainDebugPanel';
import { saveProgramToLibrary, updateProgram } from '@/lib/supabase/client/program-persistence';
import { supabase } from '@/lib/supabase/client';

/** The steps of program generation (simplified: config → generating → preview) */
type GenerationStep = 'config' | 'blueprint' | 'architect' | 'preview';

interface ProgramGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (programData: Omit<ProgramTemplate, 'id' | 'createdAt'>) => void;
  existingProgram?: ProgramTemplate; // For edit mode
  programConfig?: ProgramConfig; // For edit mode - needed to reconstruct config
  editingProgramId?: string; // Program ID when editing
  editingChainMetadata?: PromptChainMetadata; // Chain metadata when editing - for admin visibility
}

const ProgramGeneratorModal: React.FC<ProgramGeneratorModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  existingProgram,
  programConfig: providedProgramConfig,
  editingProgramId,
  editingChainMetadata,
}) => {
  // Determine if we're in edit mode
  const isEditMode = !!existingProgram;
  // Default program configuration
  const defaultConfig: ProgramConfig = {
    programInfo: {
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
      durationWeeks: 12, // Default to 12 weeks
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
  // Initialize programConfig from provided config or use default
  const [programConfig, setProgramConfig] = useState<ProgramConfig>(
    providedProgramConfig || defaultConfig
  );

  const [generatedProgram, setGeneratedProgram] = useState<ProgramTemplate | null>(
    existingProgram || null
  );
  // Preview visibility is driven by step state ('preview' | 'config' | 'blueprint'); no separate showPreview state
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Two-phase generation state
  const [step, setStep] = useState<GenerationStep>(existingProgram ? 'preview' : 'config');
  const [blueprint, setBlueprint] = useState<ProgramBlueprint | null>(null);
  const [architectBlueprint, setArchitectBlueprint] = useState<ArchitectBlueprint | null>(null);

  // Chain metadata for debugging (saved with program)
  const [chainMetadata, setChainMetadata] = useState<PromptChainMetadata | null>(null);
  const [chainStep, setChainStep] = useState<number>(0); // 0-4 for progress display

  // Unsaved changes guard (Program Blueprint Editor)
  const [hasUnsavedBlueprintChanges, setHasUnsavedBlueprintChanges] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState<'modal' | 'cancel' | null>(null);

  // Initialize state when existingProgram or providedProgramConfig changes (for edit mode)
  useEffect(() => {
    if (existingProgram) {
      setGeneratedProgram(existingProgram);
      setStep('preview');
      setChainMetadata(editingChainMetadata ?? null);
      // Update programConfig with title/description from existing program if not already set
      if (providedProgramConfig && providedProgramConfig.programInfo) {
        setProgramConfig(providedProgramConfig);
      } else if (existingProgram) {
        setProgramConfig((prev) => ({
          ...prev,
          programInfo: {
            title: existingProgram.title,
            description: existingProgram.description,
          },
        }));
      }
    } else if (!isOpen) {
      // Reset when modal closes
      setGeneratedProgram(null);
      setProgramConfig(defaultConfig);
      setStep('config');
      setBlueprint(null);
      setArchitectBlueprint(null);
      setChainMetadata(null);
      setChainStep(0);
      setHasUnsavedBlueprintChanges(false);
      setPendingCloseAction(null);
    }
  }, [existingProgram, providedProgramConfig, editingChainMetadata, isOpen]);

  // Browser beforeunload when blueprint has unsaved changes
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

  // Escape key closes confirm dialog when shown
  useEffect(() => {
    if (pendingCloseAction == null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleStay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingCloseAction, handleStay]);

  // Loading messages will be generated dynamically based on duration
  const getLoadingMessages = (durationWeeks: number): string[] => {
    return [
      `Generating ${durationWeeks}-week Periodization...`,
      'Analyzing Biomechanics...',
      'Designing Program Structure...',
    ];
  };

  // Fetch zones and equipment on mount
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
        console.error('[ProgramGeneratorModal] Failed to fetch zones/equipment:', err);
        setZones([]);
        setEquipmentItems([]);
        // Don't block UI if zones fail to load
      }
    };
    fetchZonesAndEquipment();
  }, []);

  // Build the request payload from programConfig (shared by both phases)
  const buildRequestPayload = (): ProgramPersona => ({
    title: programConfig.programInfo.title.trim(),
    description: programConfig.programInfo.description.trim(),
    demographics: programConfig.targetAudience,
    medical: {
      injuries: programConfig.medicalContext?.includeInjuries
        ? programConfig.medicalContext.injuries || ''
        : '',
      conditions: programConfig.medicalContext?.includeConditions
        ? programConfig.medicalContext.conditions || ''
        : '',
    },
    goals: programConfig.goals,
    zoneId: selectedZone ? selectedZone.id : programConfig.zoneId,
    selectedEquipmentIds:
      selectedEquipmentIds.length > 0 ? selectedEquipmentIds : programConfig.selectedEquipmentIds,
    durationWeeks: programConfig.requirements.durationWeeks,
  });

  // Phase 1: Generate Blueprint (kept for two-phase flow; main flow uses handleGenerateChain)
  const _handleGenerateBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!programConfig.programInfo.title.trim()) {
      setError('Program title is required');
      return;
    }

    if (!programConfig.programInfo.description.trim()) {
      setError('Program description is required');
      return;
    }

    setLoading(true);
    setLoadingMessage('Generating Program Blueprint...');

    try {
      const requestPayload = buildRequestPayload();

      const response = await fetch('/api/ai/generate-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to generate blueprint';
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

      const blueprintData: ProgramBlueprint = await response.json();

      // Store blueprint and move to blueprint step
      setBlueprint(blueprintData);
      setStep('blueprint');
      setLoading(false);
      setLoadingMessage('');
    } catch (err) {
      console.error('[ProgramGeneratorModal] Blueprint error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate blueprint';
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
    }
  };

  // Phase 2: Generate Detailed Workouts using Blueprint
  const handleGenerateWorkouts = async () => {
    if (!blueprint) {
      setError('Blueprint is required to generate workouts');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadingMessages = getLoadingMessages(programConfig.requirements.durationWeeks);

      // Simulate progress messages
      for (let i = 0; i < loadingMessages.length; i++) {
        setLoadingMessage(loadingMessages[i]);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const requestPayload = {
        ...buildRequestPayload(),
        blueprint, // Include the blueprint for Phase 2
      };

      const response = await fetch('/api/ai/generate-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to generate program';
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

      const programData: ProgramTemplate = await response.json();

      // Store generated program and show preview
      setGeneratedProgram(programData);
      setStep('preview');
      setLoading(false);
      setLoadingMessage('');
    } catch (err) {
      console.error('[ProgramGeneratorModal] Workouts error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate program';
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
    }
  };

  // Chain loading messages for 4-step process
  const chainLoadingMessages = [
    'Step 1/4: Designing program structure...',
    'Step 2/4: Mapping movement patterns...',
    'Step 3/4: Selecting exercises...',
    'Step 4/4: Calculating progression...',
  ];

  // NEW: 4-Step Chain Generation (unified endpoint)
  const handleGenerateChain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!programConfig.programInfo.title.trim()) {
      setError('Program title is required');
      return;
    }

    if (!programConfig.programInfo.description.trim()) {
      setError('Program description is required');
      return;
    }

    setLoading(true);
    setChainStep(0);
    setLoadingMessage(chainLoadingMessages[0]);

    // Simulate progress while waiting; cap at step 3/4 so we never show "complete" before the API returns
    const progressInterval = setInterval(() => {
      setChainStep((prev) => {
        const next = Math.min(prev + 1, 2);
        setLoadingMessage(chainLoadingMessages[next]);
        return next;
      });
    }, 5000);

    try {
      const requestPayload = buildRequestPayload();

      const response = await fetch('/api/ai/generate-program-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to generate program';
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

      const chainResponse: ChainGenerationResponse = await response.json();

      // Store program and chain metadata
      setGeneratedProgram(chainResponse.program);
      setChainMetadata(chainResponse.chain_metadata);
      setStep('preview');
      setLoading(false);
      setLoadingMessage('');
      setChainStep(4);

      // Show success toast
      toast.success('Program generated successfully!', {
        description: 'Review the program below, then save to library.',
      });
    } catch (err) {
      clearInterval(progressInterval);
      console.error('[ProgramGeneratorModal] Chain error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate program';
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

      // Show error toast
      toast.error('Failed to generate program', {
        description: message,
      });
    }
  };

  // Two-phase: Generate architect blueprint only (Step 1)
  const handleGenerateArchitect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!programConfig.programInfo.title.trim()) {
      setError('Program title is required');
      return;
    }
    if (!programConfig.programInfo.description.trim()) {
      setError('Program description is required');
      return;
    }

    setLoading(true);
    setLoadingMessage('Designing program structure...');

    try {
      const requestPayload = buildRequestPayload();
      const response = await fetch('/api/ai/generate-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
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

      const { architect } = await response.json();
      setArchitectBlueprint(architect);
      setStep('architect');
      toast.success('Structure generated', {
        description: 'Review and edit below, then generate detailed workouts.',
      });
    } catch (err) {
      console.error('[ProgramGeneratorModal] Architect error:', err);
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

  // Two-phase: Generate full program from architect blueprint (Steps 2-4)
  const handleGenerateFromArchitect = async () => {
    if (!architectBlueprint) return;

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
      const requestPayload = {
        ...buildRequestPayload(),
        architectBlueprint,
      };

      const response = await fetch('/api/ai/generate-program-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to generate program';
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

      const chainResponse: ChainGenerationResponse = await response.json();
      setGeneratedProgram(chainResponse.program);
      setChainMetadata(chainResponse.chain_metadata);
      setStep('preview');
      setChainStep(4);
      toast.success('Program generated successfully!', {
        description: 'Review the program below, then save to library.',
      });
    } catch (err) {
      clearInterval(progressInterval);
      console.error('[ProgramGeneratorModal] Chain from architect error:', err);
      let message = err instanceof Error ? err.message : 'Failed to generate program';
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
      toast.error('Failed to generate program', { description: message });
    } finally {
      setLoading(false);
      setLoadingMessage('');
      setChainStep(0);
    }
  };

  const handleTargetAudienceChange = (field: string, value: string | number) => {
    setProgramConfig((prev) => ({
      ...prev,
      targetAudience: {
        ...prev.targetAudience,
        [field]: value,
      },
    }));
  };

  const handleGoalChange = (field: 'primary' | 'secondary', value: string) => {
    setProgramConfig((prev) => ({
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
    setProgramConfig((prev) => {
      const currentMedical = prev.medicalContext || {
        includeInjuries: false,
        includeConditions: false,
      };
      return {
        ...prev,
        medicalContext: {
          ...currentMedical,
          [field]: value,
        },
      };
    });
  };

  const handleSaveToLibrary = async (editedProgram: ProgramTemplate) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        throw new Error('User must be authenticated to save programs');
      }

      // Validate programConfig has required fields
      if (!programConfig.targetAudience) {
        throw new Error(
          'Program configuration is incomplete. Please ensure target audience is set.'
        );
      }

      // Save to library: update existing or create new (persistence uses Supabase auth)
      if (editingProgramId) {
        await updateProgram(editingProgramId, editedProgram, programConfig, userId);
      } else {
        // Chain metadata should always be passed for chain-generated programs (admin visibility, SEO, content generation)
        await saveProgramToLibrary(
          editedProgram,
          programConfig,
          userId,
          chainMetadata || undefined
        );
      }

      // Show success toast
      toast.success('Program saved to library!', {
        description: 'You can find it in the Program Library.',
      });

      // Show inline success notification too
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      // Call onGenerate callback (for compatibility with existing code)
      onGenerate(editedProgram);

      // Reset and close after a brief delay (only on success)
      setTimeout(() => {
        onClose();
        setProgramConfig(defaultConfig);
        setGeneratedProgram(null);
        setStep('config');
        setSelectedZone(null);
        setSelectedEquipmentIds([]);
        setSaveSuccess(false);
        setChainMetadata(null);
        setChainStep(0);
      }, 2000);
    } catch (err) {
      console.error('[ProgramGeneratorModal] Error saving to library:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save program to library';
      setError(errorMessage);

      // Show error toast with retry action
      toast.error('Failed to save program', {
        description: errorMessage,
        action: {
          label: 'Retry',
          onClick: () => handleSaveToLibrary(editedProgram),
        },
      });
    }
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
              step === 'preview'
                ? 'max-w-6xl'
                : step === 'blueprint' || step === 'architect'
                  ? 'max-w-4xl'
                  : 'max-w-3xl'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-orange-light" />
                <div>
                  <h2 className="font-heading text-2xl font-bold">
                    {isEditMode
                      ? 'Edit Program'
                      : step === 'blueprint'
                        ? 'Program Blueprint'
                        : step === 'architect'
                          ? 'Program Structure'
                          : step === 'preview'
                            ? 'Review Workouts'
                            : 'Program Factory'}
                  </h2>
                  <p className="text-sm text-white/60">
                    {isEditMode
                      ? 'Edit and update program details'
                      : step === 'blueprint'
                        ? 'Phase 1: Review structure before generating workouts'
                        : step === 'architect'
                          ? 'Review and edit structure, then generate detailed workouts'
                          : step === 'preview'
                            ? 'Phase 2: Review and save detailed workouts'
                            : 'Create pre-made program SKUs for the storefront'}
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

            {/* Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="border-orange-light/20 mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-orange-light"></div>
                  <p className="text-lg font-medium text-white">{loadingMessage}</p>
                  {/* Chain step progress indicator */}
                  <div className="mt-4 flex gap-2">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-2 w-8 rounded-full transition-colors ${
                          step <= chainStep + 1 ? 'bg-orange-light' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    This may take 30-60 seconds for the full chain...
                  </p>
                </div>
              ) : step === 'blueprint' && blueprint ? (
                /* Phase 1: Blueprint Preview */
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
                  <BlueprintPreview
                    blueprint={blueprint}
                    onUpdate={(updated) => setBlueprint(updated)}
                    onGenerateWorkouts={handleGenerateWorkouts}
                    onBack={() => {
                      setStep('config');
                      setBlueprint(null);
                    }}
                    loading={loading}
                  />
                </>
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
                    }}
                    loading={loading}
                  />
                </>
              ) : step === 'preview' && generatedProgram ? (
                /* Phase 2: Program Blueprint Editor (detailed workouts) */
                <>
                  {saveSuccess && (
                    <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-300">
                      {isEditMode
                        ? 'Program updated successfully!'
                        : 'Program saved to library successfully!'}
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
                  <ProgramBlueprintEditor
                    initialData={generatedProgram}
                    onSave={handleSaveToLibrary}
                    onCancel={handleRequestCancel}
                    onDirtyChange={setHasUnsavedBlueprintChanges}
                  />
                  {/* Chain Debug Panel - shows intermediate outputs */}
                  {chainMetadata && <ChainDebugPanel metadata={chainMetadata} />}
                </>
              ) : (
                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                  {/* Error Message */}
                  {error && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                      <div className="flex-1">
                        <p className="font-medium text-red-300">Error</p>
                        <p className="mt-1 text-sm text-red-200">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Section 1: Program Information */}
                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Program Information
                    </h3>

                    {/* Title Input */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={programConfig.programInfo.title}
                        onChange={(e) =>
                          setProgramConfig((prev) => ({
                            ...prev,
                            programInfo: {
                              ...prev.programInfo,
                              title: e.target.value,
                            },
                          }))
                        }
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="Program title"
                        required
                      />
                    </div>

                    {/* Description Textarea */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Description *
                      </label>
                      <textarea
                        value={programConfig.programInfo.description}
                        onChange={(e) =>
                          setProgramConfig((prev) => ({
                            ...prev,
                            programInfo: {
                              ...prev.programInfo,
                              description: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                        placeholder="Program description"
                        required
                      />
                    </div>
                  </div>

                  {/* Section 2: Program Parameters */}
                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Program Parameters
                    </h3>

                    {/* Duration Selector */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80">
                        Duration *
                      </label>
                      <div className="flex gap-2">
                        {[6, 8, 12].map((weeks) => (
                          <button
                            key={weeks}
                            type="button"
                            onClick={() =>
                              setProgramConfig((prev) => ({
                                ...prev,
                                requirements: {
                                  ...prev.requirements,
                                  durationWeeks: weeks as 6 | 8 | 12,
                                },
                              }))
                            }
                            className={`flex-1 rounded-lg border px-4 py-3 font-medium transition-colors ${
                              programConfig.requirements.durationWeeks === weeks
                                ? 'bg-orange-light/20 border-orange-light text-orange-light'
                                : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            {weeks} Weeks
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Equipment Profile */}
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
                                setProgramConfig((prev) => ({
                                  ...prev,
                                  zoneId: zone.id,
                                  selectedEquipmentIds: zone.equipmentIds || [],
                                }));
                              } else {
                                setSelectedZone(null);
                                setSelectedEquipmentIds([]);
                              }
                            } catch (err) {
                              console.error('[ProgramGeneratorModal] Failed to fetch zone:', err);
                              setSelectedZone(null);
                              setSelectedEquipmentIds([]);
                            }
                          } else {
                            setSelectedZone(null);
                            setSelectedEquipmentIds([]);
                            setProgramConfig((prev) => ({
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

                    {/* Zone Info Display with Equipment Selection */}
                    {selectedZone && (
                      <div className="border-orange-light/20 bg-orange-light/10 rounded-lg border p-4">
                        <div className="mb-2 font-medium text-white">{selectedZone.name}</div>
                        {selectedZone.biomechanicalConstraints.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1">
                            {selectedZone.biomechanicalConstraints
                              .slice(0, 4)
                              .map((constraint, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80"
                                >
                                  {constraint}
                                </span>
                              ))}
                            {selectedZone.biomechanicalConstraints.length > 4 && (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                                +{selectedZone.biomechanicalConstraints.length - 4} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Equipment Selection */}
                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Available Equipment ({selectedEquipmentIds.length} selected)
                          </label>
                          <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
                            {selectedZone.equipmentIds.length === 0 ? (
                              <p className="text-sm text-white/60">
                                No equipment items in this zone
                              </p>
                            ) : (
                              selectedZone.equipmentIds.map((equipmentId) => {
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
                                          setProgramConfig((prev) => ({
                                            ...prev,
                                            selectedEquipmentIds: newIds,
                                          }));
                                        } else {
                                          const newIds = selectedEquipmentIds.filter(
                                            (id) => id !== equipmentId
                                          );
                                          setSelectedEquipmentIds(newIds);
                                          setProgramConfig((prev) => ({
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
                              })
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedZone(null);
                            setSelectedEquipmentIds([]);
                            setProgramConfig((prev) => ({
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

                  {/* Section 2: Target Persona */}
                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">Target Persona</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Target Age Range *
                        </label>
                        <select
                          value={programConfig.targetAudience.ageRange}
                          onChange={(e) => handleTargetAudienceChange('ageRange', e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          required
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
                          Target Sex *
                        </label>
                        <select
                          value={programConfig.targetAudience.sex}
                          onChange={(e) => handleTargetAudienceChange('sex', e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          required
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Target Weight (lbs) *
                        </label>
                        <input
                          type="number"
                          min="50"
                          max="500"
                          value={programConfig.targetAudience.weight}
                          onChange={(e) =>
                            handleTargetAudienceChange('weight', parseInt(e.target.value) || 0)
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Target Skill Level *
                        </label>
                        <select
                          value={programConfig.targetAudience.experienceLevel}
                          onChange={(e) =>
                            handleTargetAudienceChange(
                              'experienceLevel',
                              e.target.value as 'beginner' | 'intermediate' | 'advanced'
                            )
                          }
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          required
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Medical Context (Optional) */}
                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Medical Context (Optional)
                    </h3>

                    <div className="space-y-4">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={programConfig.medicalContext?.includeInjuries || false}
                          onChange={(e) =>
                            handleMedicalContextChange('includeInjuries', e.target.checked)
                          }
                          className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                        />
                        <span className="text-sm font-medium text-white/80">
                          Include Injury Constraints?
                        </span>
                      </label>

                      {programConfig.medicalContext?.includeInjuries && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Simulate Injuries (e.g., "Right shoulder impingement")
                          </label>
                          <textarea
                            value={programConfig.medicalContext?.injuries || ''}
                            onChange={(e) => handleMedicalContextChange('injuries', e.target.value)}
                            rows={3}
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                            placeholder="e.g., Right shoulder impingement"
                          />
                        </div>
                      )}

                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={programConfig.medicalContext?.includeConditions || false}
                          onChange={(e) =>
                            handleMedicalContextChange('includeConditions', e.target.checked)
                          }
                          className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light focus:ring-2"
                        />
                        <span className="text-sm font-medium text-white/80">
                          Include Medical Conditions?
                        </span>
                      </label>

                      {programConfig.medicalContext?.includeConditions && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/80">
                            Simulate Conditions (e.g., "Non-Alcoholic Fatty Liver Disease (mild)")
                          </label>
                          <textarea
                            value={programConfig.medicalContext?.conditions || ''}
                            onChange={(e) =>
                              handleMedicalContextChange('conditions', e.target.value)
                            }
                            rows={3}
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                            placeholder="e.g., Non-Alcoholic Fatty Liver Disease (mild)"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 3: Goals */}
                  <div className="space-y-4">
                    <h3 className="font-heading text-lg font-bold text-white">
                      Target Persona Goals
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Primary Goal *
                        </label>
                        <select
                          value={programConfig.goals.primary}
                          onChange={(e) => handleGoalChange('primary', e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          required
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
                          value={programConfig.goals.secondary}
                          onChange={(e) => handleGoalChange('secondary', e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                          required
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

                  {/* Actions */}
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
                        onClick={(e) => {
                          e.preventDefault();
                          handleGenerateArchitect(e);
                        }}
                        disabled={loading || programConfig.requirements.durationWeeks < 12}
                        title={
                          programConfig.requirements.durationWeeks < 12
                            ? 'Available for 12-week programs'
                            : undefined
                        }
                        className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/20 px-6 py-2 font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-50"
                      >
                        <LayoutList className="h-5 w-5" />
                        <span>{loading ? 'Generating...' : 'Review Structure First'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleGenerateChain(e);
                        }}
                        disabled={loading}
                        className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 font-medium text-black transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="h-5 w-5" />
                        <span>{loading ? 'Generating...' : 'Generate Program'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Unsaved changes confirmation overlay */}
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

export default ProgramGeneratorModal;
