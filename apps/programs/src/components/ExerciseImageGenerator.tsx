import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Loader2,
  Send,
  CheckCircle,
  Info,
  Save,
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  RefreshCw,
  FileDown,
  FileText,
  Download,
  Trash2,
  X,
  ImagePlus,
} from 'lucide-react';
import { uploadExerciseImage } from '@/lib/supabase/client/storage';
import {
  createGeneratedExercise,
  generateUniqueSlug,
  getGeneratedExerciseBySlug,
  updateGeneratedExercise,
} from '@/lib/supabase/client/generated-exercises';
import { addExerciseImage } from '@/lib/supabase/client/exercise-gallery';
import {
  parseBiomechanicalPoints,
  transformSearchResultsToSources,
  generateSlug,
} from '@/lib/parse-biomechanics';
import { useVisualizationLab } from '@/hooks/useVisualizationLab';
import type { SearchChunk } from '@/lib/visualization-lab/types';
import {
  buildSaveExercisePreview,
  type SaveExercisePreviewPayload,
} from '@/lib/visualization-lab/preview-payload';
import { dataUrlToBlob } from '@/lib/data-url-to-blob';
import ReferenceImagePicker from '@/components/react/ReferenceImagePicker';
import {
  loadTemplates,
  saveTemplate,
  deleteTemplate,
  type VizLabTemplate,
  type VizLabTemplateInput,
} from '@/lib/visualization-lab/templates';
import { downloadBlob, buildExportMetadata } from '@/lib/visualization-lab/export';
import {
  DEMOGRAPHICS_PRESETS,
  getPresetTextById,
} from '@/lib/visualization-lab/demographics-presets';
import { toast } from 'sonner';

const RECENT_TOPICS_KEY = 'vizlab-recent-topics';
const RECENT_TOPICS_MAX = 15;
const RECENT_TOPICS_DISPLAY = 10;

function loadRecentTopics(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TOPICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .slice(0, RECENT_TOPICS_MAX)
      : [];
  } catch {
    return [];
  }
}

function saveRecentTopics(topics: string[]): void {
  try {
    localStorage.setItem(RECENT_TOPICS_KEY, JSON.stringify(topics));
  } catch {
    /* ignore */
  }
}

export default function ExerciseImageGenerator() {
  const [searchParams] = useSearchParams();
  const slugFromUrl = searchParams.get('slug');
  const [editingExercise, setEditingExercise] = useState<{
    id: string;
    slug: string;
    exerciseName: string;
    visualStyle?: string;
    complexityLevel?: string;
  } | null>(null);
  const [editingExerciseLoading, setEditingExerciseLoading] = useState(false);

  useEffect(() => {
    if (!slugFromUrl) {
      setEditingExercise(null);
      setEditingExerciseLoading(false);
      return;
    }
    let cancelled = false;
    setEditingExerciseLoading(true);
    getGeneratedExerciseBySlug(slugFromUrl)
      .then((data) => {
        if (cancelled || !data) return;
        setEditingExercise({
          id: data.id,
          slug: data.slug,
          exerciseName: data.exerciseName,
          visualStyle: data.visualStyle,
          complexityLevel: data.complexityLevel,
        });
      })
      .finally(() => {
        if (!cancelled) setEditingExerciseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slugFromUrl]);

  const { form, reference, generation, user } = useVisualizationLab({
    initialTopic: editingExercise?.exerciseName ?? '',
    initialExercise: editingExercise ?? undefined,
    topicKey: editingExercise?.slug,
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
    loadReferenceFromUrl,
    setReferenceFromDataUrl,
    clearReferenceImage,
  } = reference;
  const {
    loading,
    result,
    error,
    handleSubmit,
    clearResult,
    reviewPromptsBeforeGenerate,
    setReviewPromptsBeforeGenerate,
    researchResult,
    promptStep,
    handleGenerateFromPrompts,
    cancelPromptReview,
  } = generation;

  const [saving, setSaving] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingExercise, setSavingExercise] = useState(false);
  const [savedExerciseSlug, setSavedExerciseSlug] = useState<string | null>(null);
  const [saveExerciseError, setSaveExerciseError] = useState<string | null>(null);
  const [recentTopics, setRecentTopics] = useState<string[]>(() => loadRecentTopics());
  const [templates, setTemplates] = useState<VizLabTemplate[]>(() => loadTemplates());
  const [showTemplateNameInput, setShowTemplateNameInput] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [previewMode, setPreviewMode] = useState<'save-exercise' | null>(null);
  const [previewPayload, setPreviewPayload] = useState<SaveExercisePreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [editedPrompts, setEditedPrompts] = useState<[string, string, string]>(['', '', '']);

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

  useEffect(() => {
    if (result) {
      setSavedImageUrl(null);
      setSaveError(null);
      setSavedExerciseSlug(null);
      setSaveExerciseError(null);
      setPreviewMode(null);
      setPreviewPayload(null);
    }
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const t = exerciseTopic.trim();
    if (!t) return;
    setRecentTopics((prev) => {
      const filtered = prev.filter((x) => x.toLowerCase() !== t.toLowerCase());
      const next = [t, ...filtered].slice(0, RECENT_TOPICS_MAX);
      saveRecentTopics(next);
      return next;
    });
  }, [result, exerciseTopic]);

  const applyTemplate = (t: VizLabTemplate) => {
    setExerciseTopic(t.exerciseTopic);
    setComplexityLevel(t.complexityLevel);
    setVisualStyle(t.visualStyle);
    setOutputMode(t.outputMode === 'sequence' ? 'sequence' : 'single');
    setDemographics(t.demographics ?? '');
    setMovementPhase(t.movementPhase ?? '');
    setBodySide(
      t.outputMode === 'sequence'
        ? ''
        : t.bodySide === 'right' || t.bodySide === 'left'
          ? t.bodySide
          : ''
    );
    setBodySideStart(
      t.outputMode === 'sequence' && (t.bodySideStart === 'left' || t.bodySideStart === 'right')
        ? t.bodySideStart
        : ''
    );
    setBodySideEnd(
      t.outputMode === 'sequence' && (t.bodySideEnd === 'left' || t.bodySideEnd === 'right')
        ? t.bodySideEnd
        : ''
    );
    setFormCuesToEmphasize(t.formCuesToEmphasize ?? '');
    setMisrenderingsToAvoid(t.misrenderingsToAvoid ?? '');
    setDomainContext(t.domainContext ?? '');
    if (t.referenceImageUrl) {
      setReferenceImageUrl(t.referenceImageUrl);
    }
  };

  const handleSaveTemplate = () => {
    const name = templateNameInput.trim();
    if (!name || !exerciseTopic.trim()) return;
    const templateInput: VizLabTemplateInput = {
      name,
      exerciseTopic: exerciseTopic.trim(),
      complexityLevel,
      visualStyle,
      outputMode,
      demographics,
      movementPhase,
      bodySide: outputMode === 'sequence' ? '' : bodySide,
      bodySideStart: outputMode === 'sequence' ? bodySideStart : undefined,
      bodySideEnd: outputMode === 'sequence' ? bodySideEnd : undefined,
      formCuesToEmphasize: formCuesToEmphasize || '',
      misrenderingsToAvoid: misrenderingsToAvoid || '',
      domainContext: domainContext || '',
      referenceImageUrl: referenceImageUrl || '',
    };
    try {
      saveTemplate(templateInput);
      setTemplates(loadTemplates());
      setTemplateNameInput('');
      setShowTemplateNameInput(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save template (storage may be full)');
    }
  };

  const handleDeleteTemplate = (id: string) => {
    try {
      deleteTemplate(id);
      setTemplates(loadTemplates());
      toast.success('Template deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete template');
    }
  };

  const handleSaveToStorage = async () => {
    if (!result?.image || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      const baseSlug = generateSlug(exerciseTopic) || 'exercise';
      const uniqueSlug = await generateUniqueSlug(baseSlug);
      const ts = Date.now();
      const imgs = result.images && result.images.length === 3 ? result.images : [result.image];
      const imagePromptToSave = result.imagePrompts?.[0] ?? result.imagePrompt ?? '';

      // Upload first image and create generated exercise (Supabase)
      const firstPath = `generated-exercises/${user.id}/${uniqueSlug}-${ts}.png`;
      const firstBlob = dataUrlToBlob(imgs[0]);
      const { downloadUrl: firstDownloadUrl, storagePath: firstSavedPath } =
        await uploadExerciseImage(firstBlob, firstPath, 'image/png');
      const { biomechanics, kineticChainType } = parseBiomechanicalPoints(
        result.biomechanicalPoints
      );
      const sources = transformSearchResultsToSources(
        result.searchResults ?? [],
        exerciseTopic.trim()
      );
      const exerciseId = await createGeneratedExercise({
        slug: uniqueSlug,
        exerciseName: exerciseTopic.trim(),
        imageUrl: firstDownloadUrl,
        storagePath: firstSavedPath,
        kineticChainType,
        biomechanics,
        imagePrompt: imagePromptToSave,
        complexityLevel,
        visualStyle,
        sources,
        status: 'pending',
        generatedBy: user.id,
      });
      setSavedImageUrl(firstDownloadUrl);

      // If 3-image sequence, add sequence Start/Mid/End to gallery (match handleSaveExercise carousel)
      if (imgs.length === 3) {
        await addExerciseImage(exerciseId, {
          role: 'sequenceStart',
          imageUrl: firstDownloadUrl,
          storagePath: firstSavedPath,
          visualStyle,
          imagePrompt: result.imagePrompts?.[0] ?? imagePromptToSave,
          createdBy: user.id,
        });
        const roles: ('sequenceMid' | 'sequenceEnd')[] = ['sequenceMid', 'sequenceEnd'];
        for (let i = 1; i < 3; i++) {
          const galleryPath = `generated-exercises/${user.id}/${uniqueSlug}-${ts}-${roles[i - 1]}.png`;
          const galleryBlob = dataUrlToBlob(imgs[i]);
          const { downloadUrl: galleryUrl, storagePath: gallerySavedPath } =
            await uploadExerciseImage(galleryBlob, galleryPath, 'image/png');
          await addExerciseImage(exerciseId, {
            role: roles[i - 1],
            imageUrl: galleryUrl,
            storagePath: gallerySavedPath,
            visualStyle,
            imagePrompt: result.imagePrompts?.[i] ?? imagePromptToSave,
            createdBy: user.id,
          });
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save image');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = async () => {
    if (!result?.image) return;
    setPreviewLoading(true);
    setSaveExerciseError(null);
    try {
      const payload = await buildSaveExercisePreview(
        result,
        exerciseTopic,
        complexityLevel,
        visualStyle
      );
      setPreviewPayload(payload);
      setPreviewMode('save-exercise');
    } catch (err) {
      setSaveExerciseError(err instanceof Error ? err.message : 'Failed to prepare preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewMode(null);
    setPreviewPayload(null);
  };

  const handleSaveExercise = async (precomputedSlug?: string) => {
    if (!result?.image || !user) return;
    setSavingExercise(true);
    setSaveExerciseError(null);
    setPreviewMode(null);
    setPreviewPayload(null);

    try {
      const baseSlug = generateSlug(exerciseTopic);
      const uniqueSlug = precomputedSlug ?? (await generateUniqueSlug(baseSlug));
      const ts = Date.now();

      // 1. Upload primary image to Storage (Supabase)
      const storagePath = `generated-exercises/${user.id}/${uniqueSlug}-${ts}.png`;
      const blob = dataUrlToBlob(result.image);
      const { downloadUrl, storagePath: savedPath } = await uploadExerciseImage(
        blob,
        storagePath,
        'image/png'
      );

      // 2. Parse biomechanics into structured format
      const { biomechanics, kineticChainType } = parseBiomechanicalPoints(
        result.biomechanicalPoints
      );

      // 3. Transform search results to source verification objects
      const sources = transformSearchResultsToSources(
        result.searchResults ?? [],
        exerciseTopic.trim()
      );

      // 4. Create document in generated_exercises (Supabase)
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
        generatedBy: user.id,
      });

      // 5. If 3-image sequence, add all 3 to gallery with sequence roles for consistent carousel display
      if (result.images && result.images.length === 3) {
        await addExerciseImage(exerciseId, {
          role: 'sequenceStart',
          imageUrl: downloadUrl,
          storagePath: savedPath,
          visualStyle,
          imagePrompt: result.imagePrompts?.[0] ?? imagePromptToSave,
          createdBy: user.id,
        });
        const roles: ('sequenceMid' | 'sequenceEnd')[] = ['sequenceMid', 'sequenceEnd'];
        for (let i = 1; i < 3; i++) {
          const galleryPath = `generated-exercises/${user.id}/${uniqueSlug}-${ts}-${roles[i - 1]}.png`;
          const galleryBlob = dataUrlToBlob(result.images[i]);
          const { downloadUrl: galleryUrl, storagePath: gallerySavedPath } =
            await uploadExerciseImage(galleryBlob, galleryPath, 'image/png');
          await addExerciseImage(exerciseId, {
            role: roles[i - 1],
            imageUrl: galleryUrl,
            storagePath: gallerySavedPath,
            visualStyle,
            imagePrompt: result.imagePrompts?.[i] ?? imagePromptToSave,
            createdBy: user.id,
          });
        }
      }

      setSavedExerciseSlug(uniqueSlug);
    } catch (err) {
      setSaveExerciseError(err instanceof Error ? err.message : 'Failed to save exercise');
    } finally {
      setSavingExercise(false);
    }
  };

  /** Edit mode: replace primary image on existing exercise */
  const handleReplacePrimary = async () => {
    if (!result?.image || !user || !editingExercise) return;
    setSavingExercise(true);
    setSaveExerciseError(null);
    try {
      const ts = Date.now();
      const storagePath = `generated-exercises/${user.id}/${editingExercise.slug}-${ts}.png`;
      const blob = dataUrlToBlob(result.image);
      const { downloadUrl, storagePath: savedPath } = await uploadExerciseImage(
        blob,
        storagePath,
        'image/png'
      );
      const { biomechanics, kineticChainType } = parseBiomechanicalPoints(
        result.biomechanicalPoints
      );
      const sources = transformSearchResultsToSources(
        result.searchResults ?? [],
        exerciseTopic.trim()
      );
      const imagePromptToSave = result.imagePrompts?.[0] ?? result.imagePrompt ?? '';
      await updateGeneratedExercise(editingExercise.id, {
        imageUrl: downloadUrl,
        storagePath: savedPath,
        imagePrompt: imagePromptToSave,
        biomechanics,
        kineticChainType,
        sources,
      });
      toast.success('Primary image updated');
    } catch (err) {
      setSaveExerciseError(err instanceof Error ? err.message : 'Failed to update primary image');
    } finally {
      setSavingExercise(false);
    }
  };

  /** Edit mode: add current image to exercise gallery (carousel) */
  const handleAddToCarousel = async () => {
    if (!result?.image || !user || !editingExercise) return;
    setSavingExercise(true);
    setSaveExerciseError(null);
    try {
      const ts = Date.now();
      const storagePath = `generated-exercises/${user.id}/${editingExercise.slug}-gallery-${ts}.png`;
      const blob = dataUrlToBlob(result.image);
      const { downloadUrl, storagePath: savedPath } = await uploadExerciseImage(
        blob,
        storagePath,
        'image/png'
      );
      const imagePromptToSave = result.imagePrompts?.[0] ?? result.imagePrompt ?? '';
      await addExerciseImage(editingExercise.id, {
        role: 'sequenceMid',
        imageUrl: downloadUrl,
        storagePath: savedPath,
        visualStyle,
        imagePrompt: imagePromptToSave,
        createdBy: user.id,
      });
      toast.success('Image added to carousel');
    } catch (err) {
      setSaveExerciseError(err instanceof Error ? err.message : 'Failed to add to carousel');
    } finally {
      setSavingExercise(false);
    }
  };

  const handleDownloadImage = () => {
    if (!result?.image) return;
    const slug = generateSlug(exerciseTopic) || 'exercise';
    const dateStr = new Date().toISOString().slice(0, 10);
    if (result.images && result.images.length === 3) {
      (['start', 'mid', 'end'] as const).forEach((phase, i) => {
        const blob = dataUrlToBlob(result.images![i]);
        downloadBlob(blob, `${slug}-${phase}-${dateStr}.png`);
      });
    } else {
      const blob = dataUrlToBlob(result.image);
      downloadBlob(blob, `${slug}-${dateStr}.png`);
    }
  };

  const handleDownloadMetadata = () => {
    if (!result) return;
    const exportParams: Parameters<typeof buildExportMetadata>[0] = {
      exerciseTopic,
      complexityLevel,
      visualStyle,
      outputMode,
      demographics,
      movementPhase,
      bodySide: outputMode === 'sequence' ? '' : bodySide,
      bodySideStart: outputMode === 'sequence' ? bodySideStart : undefined,
      bodySideEnd: outputMode === 'sequence' ? bodySideEnd : undefined,
      result,
    };
    const fc = formCuesToEmphasize.trim();
    const ma = misrenderingsToAvoid.trim();
    const dc = domainContext.trim();
    if (fc) exportParams.formCuesToEmphasize = fc;
    if (ma) exportParams.misrenderingsToAvoid = ma;
    if (dc) exportParams.domainContext = dc;
    const metadata = buildExportMetadata(exportParams);
    const slug = generateSlug(exerciseTopic) || 'exercise';
    const dateStr = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify(metadata, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `${slug}-metadata-${dateStr}.json`);
  };

  return (
    <div className="mx-auto max-w-4xl rounded-lg border border-white/10 bg-black/20 p-6 text-white backdrop-blur-sm">
      {editingExerciseLoading && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-white/80">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading exercise...
        </div>
      )}
      {editingExercise && !editingExerciseLoading && (
        <div className="border-orange-light/30 bg-orange-light/10 mb-4 rounded-lg border px-4 py-3 text-sm text-white">
          <span className="font-medium text-orange-light">Editing:</span>{' '}
          {editingExercise.exerciseName} — Regenerate primary or add to carousel
        </div>
      )}

      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white">
        <Info className="h-6 w-6 text-orange-light" />
        Exercise Biomechanics & Image Generator
      </h2>

      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-white/80">Exercise Topic</label>
          {recentTopics.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {recentTopics.slice(0, RECENT_TOPICS_DISPLAY).map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setExerciseTopic(topic)}
                  className="hover:border-orange-light/50 hover:bg-orange-light/20 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          )}
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
            <label className="mb-1 block text-sm font-medium text-white/80">Complexity Level</label>
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
            <label className="mb-1 block text-sm font-medium text-white/80">Visual Style</label>
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
              id="review-prompts"
              checked={reviewPromptsBeforeGenerate}
              onChange={(e) => setReviewPromptsBeforeGenerate(e.target.checked)}
              className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 bg-black/20 text-orange-light"
            />
            <label htmlFor="review-prompts" className="text-sm font-medium text-white/80">
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
                rows={3}
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
                rows={3}
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
                rows={3}
                className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
              />
            </div>
          </div>
        </details>

        {/* Templates: Save as / Load */}
        <div className="rounded-lg border border-white/10 bg-black/10 p-4">
          <p className="mb-2 text-xs font-medium text-white/70">Templates</p>
          <div className="flex flex-wrap items-center gap-3">
            {showTemplateNameInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  placeholder="Template name"
                  className="focus:border-orange-light/50 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTemplate();
                    if (e.key === 'Escape') {
                      setShowTemplateNameInput(false);
                      setTemplateNameInput('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!templateNameInput.trim() || !exerciseTopic.trim()}
                  className="bg-orange-light/20 hover:bg-orange-light/30 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateNameInput(false);
                    setTemplateNameInput('');
                  }}
                  className="rounded-lg p-2 text-white/60 transition-colors hover:text-white"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTemplateNameInput(true)}
                disabled={!exerciseTopic.trim()}
                className="hover:border-orange-light/30 hover:bg-orange-light/20 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" />
                Save as template
              </button>
            )}
            {templates.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <label htmlFor="load-template" className="sr-only">
                    Load template
                  </label>
                  <select
                    id="load-template"
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      const t = templates.find((x) => x.id === id);
                      if (t) applyTemplate(t);
                    }}
                    className="focus:border-orange-light/50 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">Load template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs"
                    >
                      {t.name}
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="rounded p-0.5 text-white/60 transition-colors hover:bg-red-500/20 hover:text-red-300"
                        aria-label={`Delete template ${t.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <ReferenceImagePicker
          referenceImageData={referenceImageData}
          loadingReference={loadingReference}
          referenceError={referenceError}
          loadReferenceFromUrl={loadReferenceFromUrl}
          setReferenceFromDataUrl={setReferenceFromDataUrl}
          clearReferenceImage={clearReferenceImage}
          referenceImageUrl={referenceImageUrl}
          setReferenceImageUrl={setReferenceImageUrl}
          loadReferenceImage={loadReferenceImage}
          recentGeneratedDataUrl={result?.image ?? null}
        />

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
        <div className="border-orange-light/30 mb-8 rounded-lg border bg-black/30 p-6">
          <h3 className="mb-2 text-lg font-semibold text-white">Review image prompts</h3>
          <p className="mb-4 text-sm text-white/70">
            Edit the prompts below before generating. Changes will be used for image generation.
          </p>
          {outputMode === 'sequence' && researchResult.imagePrompts?.length === 3 ? (
            <div className="mb-4 space-y-4">
              {(['Start', 'Mid', 'End'] as const).map((label, i) => (
                <div key={i}>
                  <label className="mb-1 block text-sm font-medium text-white/80">{label}</label>
                  <textarea
                    value={editedPrompts[i]}
                    onChange={(e) => {
                      const next = [...editedPrompts] as [string, string, string];
                      next[i] = e.target.value;
                      setEditedPrompts(next);
                    }}
                    rows={4}
                    className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-white/80">Image prompt</label>
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={6}
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
          {previewMode === 'save-exercise' && previewPayload && (
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
                  <p className="text-sm font-medium text-white">{previewPayload.exerciseName}</p>
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
                  onClick={() => handleSaveExercise(previewPayload.slug)}
                  disabled={savingExercise}
                  className="hover:bg-orange-light/90 inline-flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 text-sm font-medium text-black transition-colors disabled:opacity-50"
                >
                  {savingExercise ? (
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
                  disabled={savingExercise}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-xl font-semibold text-white">
                {result.images ? 'Generated Images' : 'Generated Image'}
              </h3>
              {result.images && result.images.length === 3 ? (
                <div className="grid grid-cols-3 gap-3">
                  {(['Start', 'Mid', 'End'] as const).map((label, i) => (
                    <div key={label} className="space-y-1">
                      <p className="text-center text-xs font-medium text-white/70">{label}</p>
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!user ? (
                  <p className="text-sm text-orange-light">Sign in to save images.</p>
                ) : editingExercise ? (
                  <>
                    <button
                      type="button"
                      onClick={handleReplacePrimary}
                      disabled={savingExercise}
                      className="hover:bg-orange-light/90 inline-flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 text-sm font-medium text-black transition-colors disabled:opacity-50"
                    >
                      {savingExercise ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Replace primary image
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddToCarousel}
                      disabled={savingExercise}
                      className="hover:border-orange-light/30 hover:bg-orange-light/20 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                    >
                      {savingExercise ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          Add to carousel
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveToStorage}
                      disabled={saving}
                      className="hover:border-orange-light/30 hover:bg-orange-light/20 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Image
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      disabled={savingExercise || !!savedExerciseSlug || previewLoading}
                      className="hover:bg-orange-light/90 inline-flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 text-sm font-medium text-black transition-colors disabled:opacity-50"
                    >
                      {previewLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Preparing preview...
                        </>
                      ) : savingExercise ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving Exercise...
                        </>
                      ) : savedExerciseSlug ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Exercise Saved
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4" />
                          Save Exercise
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
              {/* Status messages and quick actions */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="hover:border-orange-light/30 hover:bg-orange-light/20 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-medium text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Image
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMetadata}
                  className="hover:border-orange-light/30 hover:bg-orange-light/20 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-medium text-white transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Download Metadata
                </button>
                <button
                  type="button"
                  onClick={clearResult}
                  className="hover:border-orange-light/30 hover:bg-orange-light/20 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-medium text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate another
                </button>
                {savedImageUrl && (
                  <a
                    href={savedImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-orange-light hover:underline"
                  >
                    Image saved <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
                {(savedExerciseSlug || editingExercise?.slug) && (
                  <Link
                    to={`/exercises/${savedExerciseSlug ?? editingExercise!.slug}`}
                    className="inline-flex items-center gap-1 text-sm text-orange-light hover:underline"
                  >
                    View Exercise (Admin) <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
                {saveError && <p className="text-sm text-red-300">{saveError}</p>}
                {saveExerciseError && <p className="text-sm text-red-300">{saveExerciseError}</p>}
              </div>
              {(result.imagePrompt ||
                (result.imagePrompts && result.imagePrompts.length === 3)) && (
                <details className="mt-2 cursor-pointer text-xs text-white/60">
                  <summary>View Image Prompt{result.imagePrompts?.length === 3 ? 's' : ''}</summary>
                  {result.imagePrompts?.length === 3 ? (
                    <div className="mt-1 space-y-2">
                      {(['Start', 'Mid', 'End'] as const).map((label, i) => (
                        <div key={i}>
                          <span className="font-medium text-white/70">{label}:</span>
                          <p className="mt-0.5 rounded-lg border border-white/10 bg-black/20 p-2 text-white/80">
                            {result.imagePrompts![i]}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 rounded-lg border border-white/10 bg-black/20 p-2 text-white/80">
                      {result.imagePrompt}
                    </p>
                  )}
                </details>
              )}
            </div>

            <div>
              <h3 className="mb-4 text-xl font-semibold text-white">Biomechanical Analysis</h3>
              <ul className="space-y-3">
                {result.biomechanicalPoints.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                  >
                    <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-light" />
                    <span className="text-white/90">{point}</span>
                  </li>
                ))}
              </ul>

              {result.searchResults && result.searchResults.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">
                    Sources (Google Search)
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
  );
}
