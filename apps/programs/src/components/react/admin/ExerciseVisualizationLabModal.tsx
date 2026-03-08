/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Exercise Visualization Lab Modal: Generate images and instructions for WOD exercises.
 * Modal version of ExerciseImageGenerator that returns Exercise object to parent.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Send,
  CheckCircle,
  Info,
  Save,
  X,
  ImageIcon,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { uploadExerciseImage } from '@/lib/supabase/client/storage';
import type { Exercise } from '@/types';
import {
  createGeneratedExercise,
  generateUniqueSlug,
} from '@/lib/supabase/client/generated-exercises';
import { addExerciseImage } from '@/lib/supabase/client/exercise-gallery';
import {
  parseBiomechanicalPoints,
  transformSearchResultsToSources,
  generateSlug,
} from '@/lib/parse-biomechanics';
import { useVisualizationLab } from '@/hooks/useVisualizationLab';
import type { SearchChunk } from '@/lib/visualization-lab/types';
import { dataUrlToBlob } from '@/lib/data-url-to-blob';
import {
  buildSaveExercisePreview,
  type SaveExercisePreviewPayload,
} from '@/lib/visualization-lab/preview-payload';
import {
  DEMOGRAPHICS_PRESETS,
  getPresetTextById,
} from '@/lib/visualization-lab/demographics-presets';

interface ExerciseVisualizationLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-filled exercise name/topic. */
  exerciseName: string;
  /** Called when admin saves the generated exercise. */
  onSave: (exercise: Exercise) => void;
  /** Label for the save button (default: "Save to WOD"). */
  saveButtonLabel?: string;
}

const ExerciseVisualizationLabModal: React.FC<ExerciseVisualizationLabModalProps> = ({
  isOpen,
  onClose,
  exerciseName,
  onSave,
  saveButtonLabel = 'Save to WOD',
}) => {
  const { form, reference, generation, user } = useVisualizationLab({
    initialTopic: exerciseName,
    topicKey: isOpen ? exerciseName : '',
  });
  const {
    exerciseTopic,
    setExerciseTopic,
    complexityLevel,
    setComplexityLevel,
    visualStyle,
    setVisualStyle,
    outputMode,
    setOutputMode,
    demographics,
    setDemographics,
    movementPhase,
    setMovementPhase,
    bodySide,
    setBodySide,
    bodySideStart,
    setBodySideStart,
    bodySideEnd,
    setBodySideEnd,
    formCuesToEmphasize,
    setFormCuesToEmphasize,
    misrenderingsToAvoid,
    setMisrenderingsToAvoid,
    domainContext,
    setDomainContext,
  } = form;
  const {
    referenceImageUrl,
    setReferenceImageUrl,
    referenceImageData,
    loadingReference,
    referenceError,
    loadReferenceImage,
    clearReferenceImage,
  } = reference;
  const {
    loading,
    result,
    error,
    handleSubmit,
    reviewPromptsBeforeGenerate,
    setReviewPromptsBeforeGenerate,
    researchResult,
    promptStep,
    handleGenerateFromPrompts,
    cancelPromptReview,
  } = generation;

  const [saving, setSaving] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [editedPrompts, setEditedPrompts] = useState<[string, string, string]>(['', '', '']);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<SaveExercisePreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSavedImageUrl(null);
      setSaveError(null);
      setPreviewMode(false);
      setPreviewPayload(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setPreviewMode(false);
    setPreviewPayload(null);
  }, [result]);

  useEffect(() => {
    if (researchResult) {
      if (outputMode === 'sequence' && researchResult.imagePrompts?.length === 3) {
        setEditedPrompts([
          researchResult.imagePrompts[0],
          researchResult.imagePrompts[1],
          researchResult.imagePrompts[2],
        ]);
      } else {
        setEditedPrompt(researchResult.imagePrompt ?? '');
      }
    }
  }, [researchResult, outputMode]);

  const handleOpenPreview = async () => {
    if (!result?.image) {
      setSaveError('Generate an image first.');
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setSaveError('You must be signed in to save the exercise.');
      return;
    }
    if (previewPayload) {
      setPreviewMode(true);
      return;
    }
    setPreviewLoading(true);
    setSaveError(null);
    try {
      const payload = await buildSaveExercisePreview(
        result,
        exerciseTopic,
        complexityLevel,
        visualStyle
      );
      setPreviewPayload(payload);
      setPreviewMode(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to prepare preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewMode(false);
    // Keep previewPayload so subsequent Save can reuse the slug without re-querying the backend
  };

  const handleSaveToWOD = async (precomputedSlug?: string) => {
    if (!result?.image) {
      setSaveError('Generate an image first.');
      if (import.meta.env.DEV) {
        console.warn('[ExerciseVisualizationLabModal] Save skipped: no generated image');
      }
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUser = session?.user;
    if (!currentUser) {
      setSaveError('You must be signed in to save the exercise.');
      if (import.meta.env.DEV) {
        console.warn('[ExerciseVisualizationLabModal] Save skipped: user not signed in');
      }
      return;
    }
    setSaving(true);
    setSaveError(null);
    setPreviewMode(false);
    setPreviewPayload(null);

    try {
      const baseSlug = generateSlug(exerciseTopic);
      const uniqueSlug = precomputedSlug ?? (await generateUniqueSlug(baseSlug));
      const ts = Date.now();

      // 1. Upload primary image to Storage (Supabase)
      const storagePath = `generated-exercises/${currentUser.id}/${uniqueSlug}-${ts}.png`;
      const blob = dataUrlToBlob(result.image);
      const { downloadUrl, storagePath: savedPath } = await uploadExerciseImage(
        blob,
        storagePath,
        'image/png'
      );

      setSavedImageUrl(downloadUrl);

      // 2. Parse biomechanics into structured format
      const { biomechanics, kineticChainType } = parseBiomechanicalPoints(
        result.biomechanicalPoints
      );

      // 3. Transform search results to source verification objects
      const sources = transformSearchResultsToSources(
        result.searchResults ?? [],
        exerciseTopic.trim()
      );

      // 4. Create GeneratedExercise document (Supabase)
      const imagePromptToSave = result.imagePrompts?.[0] ?? result.imagePrompt ?? '';
      const exerciseId = await createGeneratedExercise({
        slug: uniqueSlug,
        exerciseName: exerciseTopic.trim(),
        imageUrl: downloadUrl,
        storagePath: savedPath,
        kineticChainType,
        biomechanics,
        imagePrompt: imagePromptToSave,
        complexityLevel,
        visualStyle,
        sources,
        status: 'pending',
        generatedBy: currentUser.id,
      });

      // 5. If 3-image sequence, add all 3 to gallery with sequence roles for consistent carousel display
      const imageUrls: string[] = [downloadUrl];
      if (result.images && result.images.length === 3) {
        await addExerciseImage(exerciseId, {
          role: 'sequenceStart',
          imageUrl: downloadUrl,
          storagePath: savedPath,
          visualStyle,
          imagePrompt: result.imagePrompts?.[0] ?? imagePromptToSave,
          createdBy: currentUser.id,
        });
        const roles: ('sequenceMid' | 'sequenceEnd')[] = ['sequenceMid', 'sequenceEnd'];
        for (let i = 1; i < 3; i++) {
          const galleryPath = `generated-exercises/${currentUser.id}/${uniqueSlug}-${ts}-${roles[i - 1]}.png`;
          const galleryBlob = dataUrlToBlob(result.images[i]);
          const { downloadUrl: galleryUrl, storagePath: gallerySavedPath } =
            await uploadExerciseImage(galleryBlob, galleryPath, 'image/png');
          imageUrls.push(galleryUrl);
          await addExerciseImage(exerciseId, {
            role: roles[i - 1],
            imageUrl: galleryUrl,
            storagePath: gallerySavedPath,
            visualStyle,
            imagePrompt: result.imagePrompts?.[i] ?? imagePromptToSave,
            createdBy: currentUser.id,
          });
        }
      }

      // 6. Build Exercise object and call onSave
      const exercise: Exercise = {
        name: exerciseTopic.trim(),
        images: imageUrls,
        instructions: biomechanics.performanceCues,
      };

      onSave(exercise);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save exercise');
    } finally {
      setSaving(false);
    }
  };

  const saveTarget = saveButtonLabel.replace(/^Save to /, '') || 'WOD';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <div className="flex items-center gap-3">
                <Info className="h-6 w-6 text-orange-light" />
                <div>
                  <h2 className="font-heading text-xl font-bold text-white">
                    Exercise Visualization Lab
                  </h2>
                  <p className="text-sm text-white/60">
                    Generate image and instructions for "{exerciseName}"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[calc(90vh-100px)] overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="mb-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Exercise Topic
                  </label>
                  <input
                    type="text"
                    value={exerciseTopic}
                    onChange={(e) => setExerciseTopic(e.target.value)}
                    placeholder="e.g. Barbell Squat, Push Up"
                    required
                    className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Complexity Level
                    </label>
                    <select
                      value={complexityLevel}
                      onChange={(e) => setComplexityLevel(e.target.value)}
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Visual Style
                    </label>
                    <select
                      value={visualStyle}
                      onChange={(e) => setVisualStyle(e.target.value)}
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                    >
                      <option value="photorealistic">Photorealistic</option>
                      <option value="illustration">Illustration</option>
                      <option value="schematic">Schematic (Blueprint)</option>
                      <option value="minimalist">Minimalist</option>
                      <option value="multiplicity">Multiplicity (Sequence)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">Output</label>
                    <select
                      value={outputMode}
                      onChange={(e) => setOutputMode(e.target.value as 'single' | 'sequence')}
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                    >
                      <option value="single">Single image</option>
                      <option value="sequence">3 image sequence</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      id="modal-review-prompts"
                      checked={reviewPromptsBeforeGenerate}
                      onChange={(e) => setReviewPromptsBeforeGenerate(e.target.checked)}
                      className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light"
                    />
                    <label
                      htmlFor="modal-review-prompts"
                      className="text-sm font-medium text-white/80"
                    >
                      Review prompts before generating
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Movement Phase (Optional)
                    </label>
                    <select
                      value={movementPhase}
                      onChange={(e) => setMovementPhase(e.target.value)}
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                    >
                      <option value="">Not specified</option>
                      <option value="bottom">Bottom</option>
                      <option value="midway">Midway</option>
                      <option value="top">Top</option>
                    </select>
                  </div>

                  {outputMode === 'sequence' ? (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-white/80">
                          Start view (Optional)
                        </label>
                        <select
                          value={bodySideStart}
                          onChange={(e) => setBodySideStart(e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          <option value="">Not specified</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-white/80">
                          End view (Optional)
                        </label>
                        <select
                          value={bodySideEnd}
                          onChange={(e) => setBodySideEnd(e.target.value)}
                          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                        >
                          <option value="">Not specified</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-white/80">
                        Body Side (Optional)
                      </label>
                      <select
                        value={bodySide}
                        onChange={(e) => setBodySide(e.target.value)}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                      >
                        <option value="">Not specified</option>
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Demographics (Optional)
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const text = getPresetTextById(e.target.value);
                      if (text != null) setDemographics(text);
                    }}
                    className="focus:border-orange-light/50 focus:ring-orange-light/20 mb-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                  >
                    <option value="">Select a preset...</option>
                    {DEMOGRAPHICS_PRESETS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <textarea
                    value={demographics}
                    onChange={(e) => setDemographics(e.target.value)}
                    placeholder="e.g. Female athlete, 30s"
                    rows={3}
                    className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                  />
                </div>

                <details className="rounded-lg border border-white/10 bg-black/10">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-white/80">
                    Context (Optional)
                  </summary>
                  <div className="space-y-3 p-4 pt-0">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/70">
                        Form cues to emphasize
                      </label>
                      <textarea
                        value={formCuesToEmphasize}
                        onChange={(e) => setFormCuesToEmphasize(e.target.value)}
                        placeholder="e.g. Arms pumping by hips, low curl, legs at 45°"
                        rows={2}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/70">
                        Misrenderings to avoid
                      </label>
                      <textarea
                        value={misrenderingsToAvoid}
                        onChange={(e) => setMisrenderingsToAvoid(e.target.value)}
                        placeholder="e.g. Do NOT show V-up or jackknife"
                        rows={2}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/70">
                        Domain / style context
                      </label>
                      <textarea
                        value={domainContext}
                        onChange={(e) => setDomainContext(e.target.value)}
                        placeholder="e.g. Pilates: control, precision. Avoid maximal effort aesthetic."
                        rows={2}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                      />
                    </div>
                  </div>
                </details>

                {/* Reference Image Section */}
                <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Reference Image (Optional)
                  </label>
                  <p className="mb-3 text-xs text-white/50">
                    Use a saved image URL to maintain subject consistency
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referenceImageUrl}
                      onChange={(e) => setReferenceImageUrl(e.target.value)}
                      placeholder="https://firebasestorage.googleapis.com/..."
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 flex-1 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={loadReferenceImage}
                      disabled={loadingReference || !referenceImageUrl.trim()}
                      className="hover:border-orange-light/30 hover:bg-orange-light/20 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                    >
                      {loadingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load'}
                    </button>
                  </div>

                  {referenceError && <p className="mt-2 text-xs text-red-400">{referenceError}</p>}

                  {referenceImageData && (
                    <div className="mt-3 flex items-start gap-3">
                      <img
                        src={referenceImageData}
                        alt="Reference"
                        className="h-20 w-20 rounded-lg border border-white/20 object-cover"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs text-orange-light">
                          <ImageIcon className="h-3 w-3" />
                          Reference loaded
                        </span>
                        <button
                          type="button"
                          onClick={clearReferenceImage}
                          className="flex items-center gap-1 text-xs text-white/60 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || promptStep === 'review'}
                  className="hover:bg-orange-light/90 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-light px-4 py-3 font-bold text-black transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {promptStep === 'research'
                        ? 'Researching...'
                        : promptStep === 'generating'
                          ? 'Generating images...'
                          : 'Generating Research & Image...'}
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Generate
                    </>
                  )}
                </button>
              </form>

              {promptStep === 'review' && researchResult && (
                <div className="border-orange-light/30 mb-6 rounded-lg border bg-black/30 p-6">
                  <h3 className="mb-2 text-lg font-semibold text-white">Review image prompts</h3>
                  <p className="mb-4 text-sm text-white/70">
                    Edit the prompts below before generating. Changes will be used for image
                    generation.
                  </p>
                  {outputMode === 'sequence' && researchResult.imagePrompts?.length === 3 ? (
                    <div className="mb-4 space-y-4">
                      {(['Start', 'Mid', 'End'] as const).map((label, i) => (
                        <div key={i}>
                          <label className="mb-1 block text-sm font-medium text-white/80">
                            {label}
                          </label>
                          <textarea
                            value={editedPrompts[i]}
                            onChange={(e) => {
                              const next = [...editedPrompts] as [string, string, string];
                              next[i] = e.target.value;
                              setEditedPrompts(next);
                            }}
                            rows={3}
                            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-4">
                      <label className="mb-1 block text-sm font-medium text-white/80">
                        Image prompt
                      </label>
                      <textarea
                        value={editedPrompt}
                        onChange={(e) => setEditedPrompt(e.target.value)}
                        rows={5}
                        className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                      />
                    </div>
                  )}
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-medium text-white/80">
                      Biomechanical analysis (read-only)
                    </h4>
                    <ul className="space-y-2">
                      {researchResult.biomechanicalPoints.map((point, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-white/90"
                        >
                          <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-light" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={cancelPromptReview}
                      className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleGenerateFromPrompts(
                          outputMode === 'sequence' && researchResult.imagePrompts?.length === 3
                            ? { imagePrompts: editedPrompts }
                            : { imagePrompt: editedPrompt }
                        )
                      }
                      disabled={loading}
                      className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-bold text-black transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Generate images
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {result && (
                <div className="animate-fade-in space-y-6">
                  {previewMode && previewPayload && (
                    <div className="border-orange-light/30 rounded-lg border bg-black/30 p-6">
                      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                        <BookOpen className="h-5 w-5 text-orange-light" />
                        Preview before save
                      </h3>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                          <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
                            <img
                              src={previewPayload.image}
                              alt={previewPayload.exerciseName}
                              className="h-auto max-h-48 w-full object-contain"
                            />
                          </div>
                          <p className="text-sm font-medium text-white">
                            {previewPayload.exerciseName}
                          </p>
                          <p className="mt-1 text-xs text-white/60">
                            Slug (URL path):{' '}
                            <code className="rounded bg-white/10 px-1">{previewPayload.slug}</code>
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="border-orange-light/50 bg-orange-light/10 rounded-full border px-2 py-0.5 text-xs text-orange-light">
                              {previewPayload.kineticChainType}
                            </span>
                            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-xs text-white/80">
                              {previewPayload.complexityLevel}
                            </span>
                            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-xs text-white/80">
                              {previewPayload.visualStyle}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                              Biomechanical Chain
                            </h4>
                            <p className="text-sm text-white/90">
                              {previewPayload.biomechanics.biomechanicalChain || '—'}
                            </p>
                          </div>
                          <div>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                              Pivot Points
                            </h4>
                            <p className="text-sm text-white/90">
                              {previewPayload.biomechanics.pivotPoints || '—'}
                            </p>
                          </div>
                          <div>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                              Stabilization Needs
                            </h4>
                            <p className="text-sm text-white/90">
                              {previewPayload.biomechanics.stabilizationNeeds || '—'}
                            </p>
                          </div>
                          {previewPayload.biomechanics.commonMistakes.length > 0 && (
                            <div>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                                Common Mistakes
                              </h4>
                              <ul className="list-inside list-disc text-sm text-white/90">
                                {previewPayload.biomechanics.commonMistakes.map((m, i) => (
                                  <li key={i}>{m}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {previewPayload.biomechanics.performanceCues.length > 0 && (
                            <div>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                                Performance Cues
                              </h4>
                              <ul className="list-inside list-disc text-sm text-white/90">
                                {previewPayload.biomechanics.performanceCues.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {previewPayload.sources.length > 0 && (
                            <div>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                                Sources
                              </h4>
                              <ul className="space-y-0.5 text-xs text-orange-light">
                                {previewPayload.sources.map((s, i) => (
                                  <li key={i}>
                                    {s.title} ({s.domain}) — {s.searchQuery}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleSaveToWOD(previewPayload.slug)}
                          disabled={saving}
                          className="hover:bg-orange-light/90 inline-flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 text-sm font-medium text-black transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Confirm & Save
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleClosePreview}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-white">
                        {result.images && result.images.length === 3
                          ? 'Generated Images'
                          : 'Generated Image'}
                      </h3>
                      {result.images && result.images.length === 3 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {(['Start', 'Mid', 'End'] as const).map((label, i) => (
                            <div key={label} className="space-y-0.5">
                              <p className="text-center text-xs font-medium text-white/70">
                                {label}
                              </p>
                              <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                                <img
                                  src={result.images![i]}
                                  alt={`${label} position for ${exerciseTopic}`}
                                  className="h-auto w-full object-contain"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                          <img
                            src={result.image}
                            alt={`Generated infographic for ${exerciseTopic}`}
                            className="h-auto w-full object-contain"
                          />
                        </div>
                      )}
                      <div className="mt-3">
                        {!user ? (
                          <p className="text-sm text-orange-light">Sign in to save.</p>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenPreview}
                            disabled={saving || !!savedImageUrl || previewLoading}
                            className="hover:bg-orange-light/90 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors disabled:opacity-50"
                          >
                            {previewLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Preparing preview...
                              </>
                            ) : saving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {`Saving to ${saveTarget}...`}
                              </>
                            ) : savedImageUrl ? (
                              <>
                                <CheckCircle className="h-4 w-4" />
                                {`Saved to ${saveTarget} & Exercises`}
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4" />
                                {saveButtonLabel}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {saveError && <p className="mt-2 text-sm text-red-300">{saveError}</p>}
                      {savedImageUrl && (
                        <p className="mt-2 text-xs text-white/60">
                          Also added to Admin Exercises → Generated Exercises (pending). Edit or
                          publish there.
                        </p>
                      )}
                      {result.imagePrompt && (
                        <details className="mt-2 cursor-pointer text-xs text-white/60">
                          <summary>View Image Prompt</summary>
                          <p className="mt-1 rounded-lg border border-white/10 bg-black/20 p-2 text-white/80">
                            {result.imagePrompt}
                          </p>
                        </details>
                      )}
                    </div>

                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-white">
                        Instructions (Biomechanical Analysis)
                      </h3>
                      <p className="mb-3 text-xs text-white/50">
                        These will replace the default exercise instructions.
                      </p>
                      <ul className="space-y-2">
                        {result.biomechanicalPoints.map((point, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3"
                          >
                            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-light" />
                            <span className="text-sm text-white/90">{point}</span>
                          </li>
                        ))}
                      </ul>

                      {result.searchResults && result.searchResults.length > 0 && (
                        <div className="mt-4">
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                            Sources
                          </h4>
                          <ul className="space-y-1 text-xs text-orange-light">
                            {result.searchResults.map(
                              (chunk: SearchChunk, i: number) =>
                                chunk.web && (
                                  <li key={i}>
                                    <a
                                      href={chunk.web.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block truncate hover:underline"
                                    >
                                      {chunk.web.title || chunk.web.uri}
                                    </a>
                                  </li>
                                )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExerciseVisualizationLabModal;
