/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin wrapper for GeneratedExerciseDetail that handles status updates.
 * Uses Supabase auth and storage (Phase 3).
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/supabase-instance';
import { uploadExerciseImage } from '@/lib/supabase/client/storage';
import {
  getGeneratedExerciseBySlug,
  updateGeneratedExerciseStatus,
  updateGeneratedExercise,
  generateUniqueSlug,
  searchExercisesForCommonMistakes,
  searchExercisesForBiomechanicalAnalysis,
  type CommonMistakesCandidate,
  type BiomechanicalAnalysisCandidate,
} from '@/lib/supabase/client/generated-exercises';
import { generateSlug } from '@/lib/parse-biomechanics';
import { addExerciseImage } from '@/lib/supabase/client/exercise-gallery';
import GeneratedExerciseDetail from '../GeneratedExerciseDetail';
import RegenerateImageModal, {
  type RegenerateUpdates,
  type GalleryImageData,
} from './RegenerateImageModal';
import CommonMistakesSelectModal from './CommonMistakesSelectModal';
import BiomechanicalAnalysisSelectModal from './BiomechanicalAnalysisSelectModal';
import BiomechanicsAIEditor from './BiomechanicsAIEditor';
import DeepDiveEditor from './DeepDiveEditor';
import AddImageModal from './AddImageModal';
import AddVideoModal from './AddVideoModal';
import { addExerciseImageWithShift } from '@/lib/supabase/client/exercise-gallery';
import type {
  GeneratedExercise,
  GeneratedExerciseStatus,
  ParsedBiomechanics,
  SuitableBlock,
  MainWorkoutType,
} from '@/types/generated-exercise';
import {
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Save,
  Sparkles,
  ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { dataUrlToBlob } from '@/lib/data-url-to-blob';
import { EXERCISE_LABELS } from '@/lib/labels/exercises';

interface AdminExerciseDetailWrapperProps {
  /** Initial exercise data from SSR (may be stale). Omit for SPA client-only fetch. */
  initialExercise?: GeneratedExercise | null;
  /** Exercise slug. Omit to read from route params (SPA usage). */
  slug?: string;
}

const AdminExerciseDetailWrapper: React.FC<AdminExerciseDetailWrapperProps> = ({
  initialExercise = null,
  slug: slugProp,
}) => {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const slug = slugProp ?? slugParam ?? '';

  const [user, setUser] = useState<{ id: string } | null>(null);
  const [exercise, setExercise] = useState<GeneratedExercise | null>(initialExercise);
  const [loading, setLoading] = useState(!initialExercise);
  const [error, setError] = useState<string | null>(null);
  const [imageSavedAs, setImageSavedAs] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showAddImageModal, setShowAddImageModal] = useState(false);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [addImageModalVariant, setAddImageModalVariant] = useState<'gallery' | 'anatomical' | null>(
    null
  );
  const [galleryKey, setGalleryKey] = useState(0); // Force carousel refresh
  const [showDeepDiveEditor, setShowDeepDiveEditor] = useState(false);
  const [isGeneratingDeepDive, setIsGeneratingDeepDive] = useState(false);
  const [isSavingBlocks, setIsSavingBlocks] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isPullingCommonMistakes, setIsPullingCommonMistakes] = useState(false);
  const [showCommonMistakesModal, setShowCommonMistakesModal] = useState(false);
  const [commonMistakesCandidates, setCommonMistakesCandidates] = useState<
    CommonMistakesCandidate[]
  >([]);
  const [isPullingBiomechanicalAnalysis, setIsPullingBiomechanicalAnalysis] = useState(false);
  const [showBiomechanicalAnalysisModal, setShowBiomechanicalAnalysisModal] = useState(false);
  const [biomechanicalAnalysisCandidates, setBiomechanicalAnalysisCandidates] = useState<
    BiomechanicalAnalysisCandidate[]
  >([]);
  const [showBiomechanicsAIEditor, setShowBiomechanicsAIEditor] = useState(false);
  const [aiEditorFocus, setAiEditorFocus] = useState<
    'commonMistakes' | 'biomechanicalAnalysis' | 'all'
  >('commonMistakes');

  // Listen for auth changes (Supabase)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { id: session.user.id } : null);
      if (!session?.user) setError('Please sign in to access admin features.');
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
      if (!session?.user) setError('Please sign in to access admin features.');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch fresh exercise data client-side
  useEffect(() => {
    if (!slug) return;

    const fetchExercise = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const data = await getGeneratedExerciseBySlug(slug);
        if (data) {
          setExercise(data);
          setError(null);
        } else {
          setError('Exercise not found.');
        }
      } catch (err) {
        console.error('[AdminExerciseDetailWrapper] Error fetching exercise:', err);
        setError('Failed to load exercise data.');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we don't have initial data or user just signed in
    if (!initialExercise || user) {
      fetchExercise();
    }
  }, [user, slug, initialExercise]);

  const handleStatusUpdate = async (status: GeneratedExerciseStatus, reason?: string) => {
    if (!exercise || !user) return;

    try {
      await updateGeneratedExerciseStatus(
        exercise.id,
        status,
        status === 'rejected' && reason
          ? { rejectedBy: user.id, rejectionReason: reason }
          : undefined
      );

      // Refresh exercise data
      const updated = await getGeneratedExerciseBySlug(slug);
      if (updated) {
        setExercise(updated);
      }
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error updating status:', err);
      throw err;
    }
  };

  const handleSaveImageOnly = async (exerciseName: string) => {
    if (!exercise || !user) return;

    try {
      // Create exercise_image record (Supabase)
      await addExerciseImage(exercise.id, {
        role: 'primary',
        imageUrl: exercise.imageUrl,
        storagePath: exercise.storagePath,
        createdBy: user.id,
      });

      setImageSavedAs(exerciseName);
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error saving image:', err);
      throw err;
    }
  };

  const handleRegenerateSave = async (updates: RegenerateUpdates) => {
    if (!exercise || !user) return;

    try {
      // 1. Upload new image to Supabase Storage
      const blob = dataUrlToBlob(updates.imageDataUrl);
      const storagePath = `generated-exercises/${user.id}/${exercise.slug}-${Date.now()}.png`;
      const { downloadUrl: imageUrl, storagePath: savedPath } = await uploadExerciseImage(
        blob,
        storagePath,
        'image/png'
      );

      // 2. Build the update payload
      const updatePayload: Partial<GeneratedExercise> = {
        imageUrl,
        storagePath: savedPath,
        imagePrompt: updates.imagePrompt,
      };

      // Add kinetic chain type if provided
      if (updates.kineticChainType) {
        updatePayload.kineticChainType = updates.kineticChainType;
      }

      // Only replace sources if new ones were found (empty array would clear existing sources)
      if (updates.sources && updates.sources.length > 0) {
        updatePayload.sources = updates.sources;
      }

      // Merge biomechanics updates with existing data
      if (updates.biomechanics) {
        const mergedBiomechanics: ParsedBiomechanics = {
          ...exercise.biomechanics,
          ...updates.biomechanics,
        };
        updatePayload.biomechanics = mergedBiomechanics;
      }

      // 3. Update generated exercise record
      await updateGeneratedExercise(exercise.id, updatePayload);

      // 4. Refresh exercise data
      const updated = await getGeneratedExerciseBySlug(slug);
      if (updated) {
        setExercise(updated);
      }

      setShowRegenerateModal(false);
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error regenerating:', err);
      throw err;
    }
  };

  /** Handle adding generated image to gallery (instead of replacing primary) */
  const handleAddToGallery = async (data: GalleryImageData) => {
    if (!exercise || !user) return;

    try {
      // 1. Upload image to Supabase Storage
      const blob = dataUrlToBlob(data.imageDataUrl);
      const filename = `${exercise.slug}-${data.role}-${Date.now()}.png`;
      const requestPath = `generated-exercises/${user.id}/gallery/${filename}`;
      const { downloadUrl: imageUrl, storagePath: savedPath } = await uploadExerciseImage(
        blob,
        requestPath,
        'image/png'
      );

      // 2. Create exercise_image (shift existing images if slot is occupied)
      await addExerciseImageWithShift(exercise.id, {
        role: data.role,
        imageUrl,
        storagePath: savedPath,
        createdBy: user.id,
        ...(data.imagePrompt != null && data.imagePrompt !== ''
          ? { imagePrompt: data.imagePrompt }
          : {}),
        ...(data.visualStyle ? { visualStyle: data.visualStyle } : {}),
      });

      // 3. Show success toast and refresh gallery
      toast.success(`Image added to carousel as ${data.role}`, {
        duration: 3000,
      });
      setGalleryKey((prev) => prev + 1);
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error adding to gallery:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to carousel';
      toast.error('Failed to add image to carousel', {
        description: errorMessage,
        duration: 5000,
      });
      throw err;
    }
  };

  /** Handle gallery change (refresh carousel) */
  const handleGalleryChange = async () => {
    setGalleryKey((prev) => prev + 1);
    const updated = await getGeneratedExerciseBySlug(slug);
    if (updated) setExercise(updated);
  };

  const handleVideoSuccess = async () => {
    setGalleryKey((prev) => prev + 1);
    const updated = await getGeneratedExerciseBySlug(slug);
    if (updated) setExercise(updated);
  };

  const BLOCKS: { value: SuitableBlock; label: string }[] = [
    { value: 'warmup', label: 'Warmup' },
    { value: 'main', label: 'Main Workout' },
    { value: 'finisher', label: 'Finisher' },
    { value: 'core', label: 'Core' },
    { value: 'cooldown', label: 'Cooldown' },
  ];

  const MAIN_TYPES: { value: MainWorkoutType; label: string }[] = [
    { value: 'strength', label: 'Strength' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'hiit', label: 'HIIT' },
  ];

  const toggleBlock = (block: SuitableBlock) => {
    if (!exercise) return;
    const current = exercise.suitableBlocks ?? [];
    const next = current.includes(block) ? current.filter((b) => b !== block) : [...current, block];
    const mainWorkoutType =
      block === 'main' && !next.includes('main') ? undefined : exercise.mainWorkoutType;
    setExercise((prev) => (prev ? { ...prev, suitableBlocks: next, mainWorkoutType } : null));
  };

  const handleSaveBlocks = async () => {
    if (!exercise || !user) return;
    setIsSavingBlocks(true);
    try {
      await updateGeneratedExercise(exercise.id, {
        suitableBlocks: exercise.suitableBlocks ?? [],
        mainWorkoutType: exercise.mainWorkoutType,
      });
      toast.success('Workout blocks saved');
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error saving blocks:', err);
      toast.error('Failed to save workout blocks');
    } finally {
      setIsSavingBlocks(false);
    }
  };

  const runCommonMistakesSearch = async () => {
    if (!exercise || !user) return;
    setIsPullingCommonMistakes(true);
    try {
      const candidates = await searchExercisesForCommonMistakes(
        exercise.exerciseName ?? '',
        exercise.id
      );
      if (candidates.length === 0) {
        setCommonMistakesCandidates([]);
        if (!showCommonMistakesModal) {
          toast.error('No exercises with commonMistakes found');
        }
      } else {
        setCommonMistakesCandidates(candidates);
        setShowCommonMistakesModal(true);
      }
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error searching commonMistakes:', err);
      toast.error('Failed to search for commonMistakes');
    } finally {
      setIsPullingCommonMistakes(false);
    }
  };

  const handleCommonMistakesSelect = async (candidate: CommonMistakesCandidate) => {
    if (!exercise || !user) return;
    try {
      const mergedBiomechanics = {
        ...(exercise.biomechanics ?? {}),
        commonMistakes: candidate.commonMistakes,
      };
      await updateGeneratedExercise(exercise.id, {
        biomechanics: mergedBiomechanics,
      });
      setExercise((prev) => (prev ? { ...prev, biomechanics: mergedBiomechanics } : null));
      setShowCommonMistakesModal(false);
      setCommonMistakesCandidates([]);
      toast.success(`Pulled ${candidate.commonMistakes.length} common mistake(s) from database`);
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error applying commonMistakes:', err);
      toast.error('Failed to apply commonMistakes');
    }
  };

  const runBiomechanicalAnalysisSearch = async () => {
    if (!exercise || !user) return;
    setIsPullingBiomechanicalAnalysis(true);
    try {
      const candidates = await searchExercisesForBiomechanicalAnalysis(
        exercise.exerciseName ?? '',
        exercise.id
      );
      if (candidates.length === 0) {
        setBiomechanicalAnalysisCandidates([]);
        if (!showBiomechanicalAnalysisModal) {
          toast.error('No exercises with Biomechanical Analysis found');
        }
      } else {
        setBiomechanicalAnalysisCandidates(candidates);
        setShowBiomechanicalAnalysisModal(true);
      }
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error searching Biomechanical Analysis:', err);
      toast.error('Failed to search for Biomechanical Analysis');
    } finally {
      setIsPullingBiomechanicalAnalysis(false);
    }
  };

  const handleBiomechanicalAnalysisSelect = async (candidate: BiomechanicalAnalysisCandidate) => {
    if (!exercise || !user) return;
    try {
      const mergedBiomechanics = {
        ...(exercise.biomechanics ?? {}),
        biomechanicalChain:
          candidate.biomechanicalChain ?? candidate.biomechanics?.biomechanicalChain ?? '',
        pivotPoints: candidate.pivotPoints ?? candidate.biomechanics?.pivotPoints ?? '',
        stabilizationNeeds:
          candidate.stabilizationNeeds ?? candidate.biomechanics?.stabilizationNeeds ?? '',
      };
      await updateGeneratedExercise(exercise.id, {
        biomechanics: mergedBiomechanics,
      });
      setExercise((prev) => (prev ? { ...prev, biomechanics: mergedBiomechanics } : null));
      setShowBiomechanicalAnalysisModal(false);
      setBiomechanicalAnalysisCandidates([]);
      toast.success('Pulled Biomechanical Analysis from database');
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error applying Biomechanical Analysis:', err);
      toast.error('Failed to apply Biomechanical Analysis');
    }
  };

  const handleBiomechanicsAISave = async (updates: Partial<ParsedBiomechanics>) => {
    if (!exercise || !user) return;
    try {
      const mergedBiomechanics = {
        ...(exercise.biomechanics ?? {}),
        ...updates,
      };
      await updateGeneratedExercise(exercise.id, {
        biomechanics: mergedBiomechanics,
      });
      setExercise((prev) => (prev ? { ...prev, biomechanics: mergedBiomechanics } : null));
      setShowBiomechanicsAIEditor(false);
      toast.success('Biomechanics updated');
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error saving biomechanics:', err);
      toast.error('Failed to save biomechanics');
      throw err;
    }
  };

  const handleSaveName = async () => {
    if (!exercise || !user) return;
    const trimmed = exercise.exerciseName?.trim() ?? '';
    if (!trimmed) {
      toast.error('Exercise name cannot be empty');
      return;
    }
    const baseSlug = generateSlug(trimmed);
    if (!baseSlug) {
      toast.error('Exercise name must produce a valid URL slug');
      return;
    }
    setIsSavingName(true);
    try {
      const newSlug = await generateUniqueSlug(baseSlug, exercise.id);
      await updateGeneratedExercise(exercise.id, {
        exerciseName: trimmed,
        slug: newSlug,
      });
      setExercise((prev) => (prev ? { ...prev, exerciseName: trimmed, slug: newSlug } : null));
      toast.success('Exercise name and URL saved');
      if (newSlug !== exercise.slug) {
        navigate(`/exercises/${newSlug}`);
      }
    } catch (err) {
      console.error('[AdminExerciseDetailWrapper] Error saving name:', err);
      toast.error('Failed to save exercise name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleUpdateDeepDive = async (html: string) => {
    if (!exercise || !user) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const response = await fetch(`/api/admin/exercises/${exercise.id}/update-deep-dive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deepDiveHtmlContent: html }),
      });

      if (!response.ok) {
        throw new Error('Failed to update deep dive content');
      }

      // Update local state
      setExercise((prev) => (prev ? { ...prev, deepDiveHtmlContent: html } : null));
      setShowDeepDiveEditor(false);
    } catch {
      console.error('[AdminExerciseDetailWrapper] Error updating deep dive');
      throw new Error('Failed to update deep dive content');
    }
  };

  const handleGenerateDeepDive = async () => {
    if (!exercise || !user) return;
    setIsGeneratingDeepDive(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const response = await fetch(`/api/admin/exercises/${exercise.id}/generate-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate deep dive page');
      }

      const result = await response.json();

      // Update local state with new content
      setExercise((prev) => (prev ? { ...prev, deepDiveHtmlContent: result.html } : null));

      toast.success('Deep dive page generated successfully!');
    } catch {
      console.error('[AdminExerciseDetailWrapper] Error generating deep dive');
      toast.error('Failed to generate deep dive page');
    } finally {
      setIsGeneratingDeepDive(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0500]">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#ffbf00]" />
          <p className="text-white/60">Loading exercise...</p>
        </div>
      </div>
    );
  }

  if (error || !exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0500] p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <AlertTriangle className="h-12 w-12 text-[#ffbf00]" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">{error || 'Exercise not found'}</h1>
          <p className="mb-6 text-white/60">
            {!user
              ? 'Please sign in to access admin features.'
              : 'The exercise may have been deleted or the link is invalid.'}
          </p>
          <Link
            to="/exercises"
            className="inline-flex items-center gap-2 rounded-lg bg-black/40 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {EXERCISE_LABELS.backLink}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0500]">
      {/* Admin header */}
      <div className="border-b border-white/10 bg-black/40 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/exercises"
            className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-[#ffbf00]"
          >
            <ArrowLeft className="h-4 w-4" />
            {EXERCISE_LABELS.backLink}
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to={`/exercise-image-gen?slug=${exercise.slug}`}
              className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-[#ffbf00]"
              title="Edit in Visualization Lab"
            >
              <Sparkles className="h-4 w-4" />
              Edit in Visualization Lab
            </Link>
            <button
              onClick={() => {
                setLoading(true);
                getGeneratedExerciseBySlug(slug).then((data) => {
                  if (data) {
                    setExercise(data);
                    setGalleryKey((prev) => prev + 1);
                  }
                  setLoading(false);
                });
              }}
              className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-[#ffbf00]"
              title="Refresh Exercise Data"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <span className="font-mono text-xs text-white/50">ID: {exercise.id}</span>
          </div>
        </div>
      </div>

      {/* Success message for saved image */}
      {imageSavedAs && (
        <div className="border-b border-[#ffbf00]/30 bg-[#ffbf00]/10 px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm text-[#ffbf00]">
            <CheckCircle className="h-4 w-4" />
            Image saved as &quot;{imageSavedAs}&quot; to exercise library
          </div>
        </div>
      )}

      {/* Exercise Name */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-white/60">
            Exercise Name
          </h3>
          <p className="mb-3 text-sm text-white/50">
            The URL slug is derived from the name and will update when you save.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={exercise.exerciseName ?? ''}
              onChange={(e) =>
                setExercise((prev) => (prev ? { ...prev, exerciseName: e.target.value } : null))
              }
              className="max-w-md flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white/90 focus:border-[#ffbf00]/50 focus:outline-none focus:ring-2 focus:ring-[#ffbf00]/20"
              placeholder="e.g. High Knees"
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={isSavingName || !(exercise.exerciseName?.trim() ?? '')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
            >
              {isSavingName ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Name
            </button>
          </div>
        </div>
      </div>

      {/* Biomechanics Data - Pull commonMistakes */}
      {!(exercise.biomechanics?.commonMistakes?.length ?? 0) && (
        <div className="border-b border-white/10 px-4 py-4">
          <div className="mx-auto max-w-6xl">
            <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-white/60">
              Biomechanics Data
            </h3>
            <p className="mb-3 text-sm text-white/50">
              When commonMistakes is missing, pull from another exercise or generate with AI.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runCommonMistakesSearch}
                disabled={isPullingCommonMistakes}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
              >
                {isPullingCommonMistakes ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Pull from database
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiEditorFocus('commonMistakes');
                  setShowBiomechanicsAIEditor(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
              >
                <Sparkles className="h-4 w-4" />
                AI Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Biomechanical Analysis - Pull chain/pivot/stabilization */}
      {(() => {
        const chain = (exercise.biomechanics?.biomechanicalChain ?? '').trim();
        const pivot = (exercise.biomechanics?.pivotPoints ?? '').trim();
        const stab = (exercise.biomechanics?.stabilizationNeeds ?? '').trim();
        const needsAnalysis = !chain || !pivot || !stab;
        return needsAnalysis ? (
          <div className="border-b border-white/10 px-4 py-4">
            <div className="mx-auto max-w-6xl">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-white/60">
                Biomechanical Analysis
              </h3>
              <p className="mb-3 text-sm text-white/50">
                When Chain, Pivot Points, or Stabilization is missing, pull from another exercise or
                generate with AI.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runBiomechanicalAnalysisSearch}
                  disabled={isPullingBiomechanicalAnalysis}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
                >
                  {isPullingBiomechanicalAnalysis ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Pull from database
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiEditorFocus('biomechanicalAnalysis');
                    setShowBiomechanicsAIEditor(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
                >
                  <Sparkles className="h-4 w-4" />
                  AI Edit
                </button>
                <button
                  type="button"
                  title={
                    !chain && !pivot && !stab
                      ? 'Generate or pull biomechanics first'
                      : 'Add anatomical diagram from biomechanics text'
                  }
                  disabled={!chain && !pivot && !stab}
                  onClick={() => {
                    setAddImageModalVariant('anatomical');
                    setShowAddImageModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" />
                  Add anatomical image
                </button>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Workout Block tagging */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-white/60">
            Workout Block
          </h3>
          <p className="mb-3 text-sm text-white/50">
            Tag which workout phases this exercise fits. Used for filtering on /exercises.
          </p>
          <div className="mb-4 flex flex-wrap gap-3">
            {BLOCKS.map(({ value, label }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/30/50 px-3 py-2 text-sm transition-colors hover:bg-black/40/50"
              >
                <input
                  type="checkbox"
                  checked={(exercise.suitableBlocks ?? []).includes(value)}
                  onChange={() => toggleBlock(value)}
                  className="h-4 w-4 rounded border-white/20 accent-[#ffbf00]"
                />
                <span className="text-white/80">{label}</span>
              </label>
            ))}
          </div>
          {(exercise.suitableBlocks ?? []).includes('main') && (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium text-white/60">
                Main Workout Type
              </label>
              <select
                value={exercise.mainWorkoutType ?? ''}
                onChange={(e) =>
                  setExercise((prev) =>
                    prev
                      ? {
                          ...prev,
                          mainWorkoutType: (e.target.value as MainWorkoutType) || undefined,
                        }
                      : null
                  )
                }
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90"
              >
                <option value="">— Select —</option>
                {MAIN_TYPES.map(({ value: v, label: l }) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveBlocks}
            disabled={isSavingBlocks}
className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
              >
                {isSavingBlocks ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Workout Blocks
          </button>
        </div>
      </div>

      <GeneratedExerciseDetail
        key={galleryKey} // Force re-render when gallery changes
        exercise={exercise}
        isAdmin={true}
        onStatusUpdate={handleStatusUpdate}
        onSaveImageOnly={handleSaveImageOnly}
        onRegenerate={() => setShowRegenerateModal(true)}
        onAddImage={() => {
          setAddImageModalVariant(null);
          setShowAddImageModal(true);
        }}
        onAddVideo={() => setShowAddVideoModal(true)}
        onAddAnatomicalImage={() => {
          setAddImageModalVariant('anatomical');
          setShowAddImageModal(true);
        }}
        onGalleryChange={handleGalleryChange}
        onGenerateDeepDive={handleGenerateDeepDive}
        onEditDeepDive={() => setShowDeepDiveEditor(true)}
        isGeneratingDeepDive={isGeneratingDeepDive}
      />

      {/* Regenerate Image Modal */}
      <RegenerateImageModal
        exercise={exercise}
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        onSave={handleRegenerateSave}
        onAddToGallery={handleAddToGallery}
      />

      {/* Add Image Modal */}
      <AddImageModal
        exerciseId={exercise.id}
        exerciseName={exercise.exerciseName}
        primaryImageUrl={exercise.imageUrl}
        galleryKey={galleryKey}
        isOpen={showAddImageModal}
        onClose={() => {
          setShowAddImageModal(false);
          setAddImageModalVariant(null);
        }}
        onSuccess={handleGalleryChange}
        initialMode={addImageModalVariant === 'anatomical' ? 'anatomical' : undefined}
        biomechanicsContext={
          exercise?.biomechanics
            ? {
                biomechanicalChain: exercise.biomechanics.biomechanicalChain ?? '',
                pivotPoints: exercise.biomechanics.pivotPoints ?? '',
                stabilizationNeeds: exercise.biomechanics.stabilizationNeeds ?? '',
              }
            : undefined
        }
      />

      {/* Add Video Modal */}
      {exercise && (
        <AddVideoModal
          exerciseId={exercise.id}
          exerciseName={exercise.exerciseName}
          isOpen={showAddVideoModal}
          onClose={() => setShowAddVideoModal(false)}
          onSuccess={handleVideoSuccess}
          getAuthToken={async () => {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            return session?.access_token ?? '';
          }}
        />
      )}

      {/* Common Mistakes Selection Modal */}
      <CommonMistakesSelectModal
        isOpen={showCommonMistakesModal}
        onClose={() => {
          setShowCommonMistakesModal(false);
          setCommonMistakesCandidates([]);
        }}
        candidates={commonMistakesCandidates}
        onSelect={handleCommonMistakesSelect}
        onSearchAgain={runCommonMistakesSearch}
        isSearchingAgain={isPullingCommonMistakes}
      />

      {/* Biomechanical Analysis Selection Modal */}
      <BiomechanicalAnalysisSelectModal
        isOpen={showBiomechanicalAnalysisModal}
        onClose={() => {
          setShowBiomechanicalAnalysisModal(false);
          setBiomechanicalAnalysisCandidates([]);
        }}
        candidates={biomechanicalAnalysisCandidates}
        onSelect={handleBiomechanicalAnalysisSelect}
        onSearchAgain={runBiomechanicalAnalysisSearch}
        isSearchingAgain={isPullingBiomechanicalAnalysis}
      />

      {/* Biomechanics AI Editor */}
      <BiomechanicsAIEditor
        exercise={exercise}
        isOpen={showBiomechanicsAIEditor}
        onClose={() => setShowBiomechanicsAIEditor(false)}
        onSave={handleBiomechanicsAISave}
        focus={aiEditorFocus}
        getAuthToken={async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          return session?.access_token ?? '';
        }}
      />

      {/* Deep Dive Editor */}
      {showDeepDiveEditor && (
        <DeepDiveEditor
          exercise={exercise}
          onSave={handleUpdateDeepDive}
          onCancel={() => setShowDeepDiveEditor(false)}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
};

export default AdminExerciseDetailWrapper;
