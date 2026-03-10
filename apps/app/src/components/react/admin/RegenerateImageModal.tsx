/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RegenerateImageModal Component
 * Modal for regenerating exercise images with diff review for biomechanics sections.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw,
  ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  GeneratedExercise,
  ExerciseSource,
  ParsedBiomechanics,
  ExerciseImageRole,
} from '@/types/generated-exercise';
import { getExerciseImages } from '@/lib/supabase/client/exercise-gallery';
import {
  parseBiomechanicalPoints,
  transformSearchResultsToSources,
} from '@/lib/parse-biomechanics';
import { formatParagraphContent } from '@/lib/sanitize-paragraph-html';

/** One item in the "images from this exercise" list (primary or gallery) */
interface ExerciseImageOption {
  id: string;
  imageUrl: string;
  roleLabel: string;
}

/** Updates to apply after regeneration */
export interface RegenerateUpdates {
  /** New image data URL (base64) */
  imageDataUrl: string;
  /** New image prompt */
  imagePrompt: string;
  /** Biomechanics updates (only included if admin accepted the change) */
  biomechanics?: Partial<ParsedBiomechanics>;
  /** New kinetic chain type (if changed) */
  kineticChainType?: string;
  /** New sources (if accepted) */
  sources?: ExerciseSource[];
}

/** Data for adding image to gallery */
export interface GalleryImageData {
  imageDataUrl: string;
  imagePrompt: string;
  role: Exclude<ExerciseImageRole, 'primary'>;
  visualStyle: string;
}

interface RegenerateImageModalProps {
  exercise: GeneratedExercise;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: RegenerateUpdates) => Promise<void>;
  /** Optional: Handler for adding image to gallery instead of replacing */
  onAddToGallery?: (data: GalleryImageData) => Promise<void>;
}

/** Raw search result from API (grounding chunks) */
interface GroundingChunk {
  web?: { uri?: string; title?: string };
  uri?: string;
  title?: string;
}

interface GenerationResult {
  image: string;
  biomechanicalPoints: string[];
  imagePrompt?: string;
  searchResults?: GroundingChunk[];
}

interface SectionDiff {
  key: keyof ParsedBiomechanics | 'sources';
  label: string;
  hasChanged: boolean;
  oldValue: string | string[];
  newValue: string | string[];
  accepted: boolean;
}

/** Check if two values are different */
function hasChanged(oldVal: string | string[], newVal: string | string[]): boolean {
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (oldVal.length !== newVal.length) return true;
    return oldVal.some((v, i) => v !== newVal[i]);
  }
  return oldVal !== newVal;
}

/** Format value for display */
function formatValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join('\n• ') : '(empty)';
  }
  return value || '(empty)';
}

type SaveMode = 'replace' | 'gallery';
const GALLERY_ROLES: Exclude<ExerciseImageRole, 'primary'>[] = [
  'secondary',
  'tertiary',
  'ghosted',
  'illustration',
  'multiplicity',
  'sequenceStart',
  'sequenceMid',
  'sequenceEnd',
];

const RegenerateImageModal: React.FC<RegenerateImageModalProps> = ({
  exercise,
  isOpen,
  onClose,
  onSave,
  onAddToGallery,
}) => {
  // Form state
  const [exerciseTopic, setExerciseTopic] = useState(exercise.exerciseName);
  const [complexityLevel, setComplexityLevel] = useState(exercise.complexityLevel);
  const [visualStyle, setVisualStyle] = useState(exercise.visualStyle);
  const [demographics, setDemographics] = useState('');
  const [movementPhase, setMovementPhase] = useState('');
  const [bodySide, setBodySide] = useState('');
  // Reference image state
  const [useCurrentAsReference, setUseCurrentAsReference] = useState(false);
  const [referenceImageData, setReferenceImageData] = useState<string | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);
  /** Which exercise image is currently loading as reference ('primary' or gallery image id) */
  const [loadingReferenceId, setLoadingReferenceId] = useState<string | null>(null);

  // Images from this exercise (primary + gallery) for "Use as reference"
  const [exerciseImagesList, setExerciseImagesList] = useState<ExerciseImageOption[]>([]);
  const [loadingExerciseImages, setLoadingExerciseImages] = useState(false);

  // Fetch primary + gallery when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const build = async () => {
      setLoadingExerciseImages(true);
      try {
        const list: ExerciseImageOption[] = [];
        if (exercise.imageUrl) {
          list.push({ id: 'primary', imageUrl: exercise.imageUrl, roleLabel: 'Primary' });
        }
        const gallery = await getExerciseImages(exercise.id);
        for (const img of gallery) {
          list.push({
            id: img.id,
            imageUrl: img.imageUrl,
            roleLabel: img.role.charAt(0).toUpperCase() + img.role.slice(1),
          });
        }
        setExerciseImagesList(list);
      } catch {
        setExerciseImagesList(
          exercise.imageUrl
            ? [{ id: 'primary', imageUrl: exercise.imageUrl, roleLabel: 'Primary' }]
            : []
        );
      } finally {
        setLoadingExerciseImages(false);
      }
    };
    build();
  }, [isOpen, exercise.id, exercise.imageUrl]);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [parsedNew, setParsedNew] = useState<{
    biomechanics: ParsedBiomechanics;
    kineticChainType: string;
    sources: ExerciseSource[];
  } | null>(null);

  // Diff state
  const [sectionDiffs, setSectionDiffs] = useState<SectionDiff[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Save state
  const [saving, setSaving] = useState(false);
  // Gallery mode state
  const [saveMode, setSaveMode] = useState<SaveMode>('replace');
  const [galleryRole, setGalleryRole] =
    useState<Exclude<ExerciseImageRole, 'primary'>>('secondary');

  // Load current exercise image as reference (via proxy to avoid CORS with Firebase Storage)
  const loadCurrentImageAsReference = async () => {
    if (!exercise.imageUrl) return;

    setLoadingReference(true);
    try {
      const proxyUrl = `/api/load-reference-image?url=${encodeURIComponent(exercise.imageUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load image');
      }
      if (data.base64) {
        setReferenceImageData(data.base64);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch {
      setReferenceImageData(null);
    } finally {
      setLoadingReference(false);
    }
  };

  // Toggle using current image as reference
  const handleToggleReference = async (checked: boolean) => {
    setUseCurrentAsReference(checked);
    if (checked && !referenceImageData) {
      await loadCurrentImageAsReference();
    } else if (!checked) {
      setReferenceImageData(null);
    }
  };

  /** Load an exercise image as reference via proxy (for "Use as reference" from list) */
  const loadReferenceFromExerciseImage = async (item: ExerciseImageOption) => {
    setLoadingReferenceId(item.id);
    setError(null);
    try {
      const proxyUrl = `/api/load-reference-image?url=${encodeURIComponent(item.imageUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load image');
      }
      if (data.base64) {
        setReferenceImageData(data.base64);
        setUseCurrentAsReference(true);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reference');
      setReferenceImageData(null);
    } finally {
      setLoadingReferenceId(null);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setParsedNew(null);

    try {
      const response = await fetch('/api/generate-exercise-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTopic,
          complexityLevel,
          visualStyle,
          demographics,
          movementPhase: movementPhase || undefined,
          bodySide: bodySide || undefined,
          referenceImage: referenceImageData || undefined,
        }),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        console.error('generate-exercise-image error', response.status, errData.error ?? errData);
        throw new Error(errData.error || 'Failed to generate image');
      }

      const data: GenerationResult = await response.json();
      setResult(data);

      // Parse the new biomechanics
      const { biomechanics, kineticChainType } = parseBiomechanicalPoints(data.biomechanicalPoints);
      const sources = transformSearchResultsToSources(data.searchResults, exerciseTopic);

      setParsedNew({ biomechanics, kineticChainType, sources });

      // Build diffs
      const diffs: SectionDiff[] = [
        {
          key: 'performanceCues',
          label: 'Performance Cues',
          hasChanged: hasChanged(
            exercise.biomechanics.performanceCues,
            biomechanics.performanceCues
          ),
          oldValue: exercise.biomechanics.performanceCues,
          newValue: biomechanics.performanceCues,
          accepted: true, // Default to accepted
        },
        {
          key: 'commonMistakes',
          label: 'Common Mistakes',
          hasChanged: hasChanged(exercise.biomechanics.commonMistakes, biomechanics.commonMistakes),
          oldValue: exercise.biomechanics.commonMistakes,
          newValue: biomechanics.commonMistakes,
          accepted: true,
        },
        {
          key: 'biomechanicalChain',
          label: 'Biomechanical Chain',
          hasChanged: hasChanged(
            exercise.biomechanics.biomechanicalChain,
            biomechanics.biomechanicalChain
          ),
          oldValue: exercise.biomechanics.biomechanicalChain,
          newValue: biomechanics.biomechanicalChain,
          accepted: true,
        },
        {
          key: 'pivotPoints',
          label: 'Pivot Points',
          hasChanged: hasChanged(exercise.biomechanics.pivotPoints, biomechanics.pivotPoints),
          oldValue: exercise.biomechanics.pivotPoints,
          newValue: biomechanics.pivotPoints,
          accepted: true,
        },
        {
          key: 'stabilizationNeeds',
          label: 'Stabilization Needs',
          hasChanged: hasChanged(
            exercise.biomechanics.stabilizationNeeds,
            biomechanics.stabilizationNeeds
          ),
          oldValue: exercise.biomechanics.stabilizationNeeds,
          newValue: biomechanics.stabilizationNeeds,
          accepted: true,
        },
        {
          key: 'sources',
          label: 'Sources (Citations)',
          hasChanged: hasChanged(
            exercise.sources.map((s) => s.domain),
            sources.map((s) => s.domain)
          ),
          oldValue: exercise.sources.map((s) => s.title),
          newValue: sources.map((s) => s.title),
          // Only default to accepted if new sources exist
          accepted: sources.length > 0,
        },
      ];

      setSectionDiffs(diffs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAccepted = (key: string) => {
    setSectionDiffs((prev) =>
      prev.map((diff) => (diff.key === key ? { ...diff, accepted: !diff.accepted } : diff))
    );
  };

  const handleSave = async () => {
    if (!result || !parsedNew) return;
    setSaving(true);

    try {
      // If adding to gallery, use the gallery handler
      if (saveMode === 'gallery' && onAddToGallery) {
        await onAddToGallery({
          imageDataUrl: result.image,
          imagePrompt: result.imagePrompt || '',
          role: galleryRole,
          visualStyle,
        });
        toast.success(`Image added to gallery as ${galleryRole}`, {
          duration: 3000,
        });
        handleClose();
        return;
      }

      // Build updates based on accepted sections (replace primary mode)
      const biomechanicsUpdates: Partial<ParsedBiomechanics> = {};
      const setBiomechanicsUpdate = <K extends keyof ParsedBiomechanics>(
        key: K,
        value: ParsedBiomechanics[K]
      ) => {
        biomechanicsUpdates[key] = value;
      };

      for (const diff of sectionDiffs) {
        if (diff.accepted && diff.hasChanged && diff.key !== 'sources') {
          const bioKey = diff.key as keyof ParsedBiomechanics;
          const value = parsedNew.biomechanics[bioKey];
          setBiomechanicsUpdate(bioKey, value);
        }
      }

      const updates: RegenerateUpdates = {
        imageDataUrl: result.image,
        imagePrompt: result.imagePrompt || '',
        kineticChainType: parsedNew.kineticChainType,
      };

      // Only include sources if the diff is accepted and new sources exist
      const sourcesDiff = sectionDiffs.find((d) => d.key === 'sources');
      if (sourcesDiff?.accepted && parsedNew.sources.length > 0) {
        updates.sources = parsedNew.sources;
      }

      // Only include biomechanics if there are accepted changes
      if (Object.keys(biomechanicsUpdates).length > 0) {
        updates.biomechanics = biomechanicsUpdates;
      }

      await onSave(updates);
      toast.success('Primary image updated successfully', {
        duration: 3000,
      });
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save changes';
      setError(errorMessage);
      toast.error('Failed to save image', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Reset state on close
    setResult(null);
    setParsedNew(null);
    setSectionDiffs([]);
    setError(null);
    setSaveMode('replace');
    setGalleryRole('secondary');
    // Reset reference image and generation parameters so next open starts fresh
    setUseCurrentAsReference(false);
    setReferenceImageData(null);
    setMovementPhase('');
    setBodySide('');
    setLoadingReferenceId(null);
    onClose();
  };

  if (!isOpen) return null;

  const isPhase2 = result !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <RefreshCw className="h-5 w-5 text-blue-400" />
            Regenerate Image
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!isPhase2 ? (
            /* Phase 1: Generation Form */
            <form onSubmit={handleGenerate} className="space-y-4">
              <p className="mb-4 text-sm text-slate-400">
                Adjust the settings below and generate a new image. The image will always be
                replaced, but you can choose which biomechanics data to keep.
              </p>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Exercise Name
                </label>
                <input
                  type="text"
                  value={exerciseTopic}
                  onChange={(e) => setExerciseTopic(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white placeholder-slate-500 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">
                    Complexity Level
                  </label>
                  <select
                    value={complexityLevel}
                    onChange={(e) => setComplexityLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">
                    Visual Style
                  </label>
                  <select
                    value={visualStyle}
                    onChange={(e) => setVisualStyle(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="photorealistic">Photorealistic</option>
                    <option value="illustration">Illustration</option>
                    <option value="schematic">Schematic</option>
                    <option value="minimalist">Minimalist</option>
                    <option value="multiplicity">Multiplicity (Sequence)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Demographics (Optional)
                </label>
                <input
                  type="text"
                  value={demographics}
                  onChange={(e) => setDemographics(e.target.value)}
                  placeholder="e.g., Female athlete, 30s"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white placeholder-slate-500 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">
                    Movement Phase (Optional)
                  </label>
                  <select
                    value={movementPhase}
                    onChange={(e) => setMovementPhase(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Not specified</option>
                    <option value="bottom">Bottom</option>
                    <option value="midway">Midway</option>
                    <option value="top">Top</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">
                    Body Side (Optional)
                  </label>
                  <select
                    value={bodySide}
                    onChange={(e) => setBodySide(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Not specified</option>
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </div>
              </div>

              {/* Reference Image Toggle */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useCurrentAsReference}
                    onChange={(e) => handleToggleReference(e.target.checked)}
                    disabled={loadingReference}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-300">
                    Use current image as reference for subject consistency
                  </span>
                  {loadingReference && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                </label>
                {useCurrentAsReference && referenceImageData && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={referenceImageData}
                      alt="Reference"
                      className="h-12 w-12 rounded border border-slate-600 object-cover"
                    />
                    <span className="text-xs text-blue-400">
                      New image will maintain subject appearance from current image
                    </span>
                  </div>
                )}
              </div>

              {/* Or choose another image from this exercise */}
              {(exercise.imageUrl || loadingExerciseImages || exerciseImagesList.length > 0) && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-300">
                    Or choose another image from this exercise
                  </p>
                  {loadingExerciseImages ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {exerciseImagesList.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col items-center gap-1 rounded border border-slate-600 bg-slate-900 p-1"
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.roleLabel}
                            className="h-14 w-14 rounded object-cover"
                          />
                          <span className="text-xs text-slate-400">{item.roleLabel}</span>
                          <button
                            type="button"
                            onClick={() => loadReferenceFromExerciseImage(item)}
                            disabled={loadingReferenceId !== null}
                            className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            {loadingReferenceId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Use as reference'
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-900/50 bg-red-900/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Generate New Image
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Phase 2: Diff Review */
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Review the changes below. The image will be replaced. Check/uncheck sections to
                accept or reject biomechanics changes.
              </p>

              {/* New Image Preview */}
              <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                <div className="flex items-center gap-2 border-b border-slate-700 p-3">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">New Image (will replace)</span>
                </div>
                <img
                  src={result.image}
                  alt="New generated image"
                  className="h-64 w-full bg-black object-contain"
                />
              </div>

              {/* Section Diffs */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium uppercase tracking-wider text-slate-300">
                  Biomechanics Sections
                </h3>

                {sectionDiffs.map((diff) => (
                  <div
                    key={diff.key}
                    className={`rounded-lg border ${
                      diff.hasChanged
                        ? 'border-amber-900/50 bg-amber-900/10'
                        : 'border-slate-700 bg-slate-900/50'
                    }`}
                  >
                    <button
                      onClick={() => toggleSection(diff.key)}
                      className="flex w-full items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={diff.accepted}
                          onChange={() => toggleAccepted(diff.key)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!diff.hasChanged}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="font-medium text-white">{diff.label}</span>
                        {diff.hasChanged ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                            changed
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                            unchanged
                          </span>
                        )}
                      </div>
                      {expandedSections.has(diff.key) ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    {expandedSections.has(diff.key) && (
                      <div className="space-y-2 border-t border-slate-700/50 px-3 pb-3 pt-3">
                        <div>
                          <span className="text-xs font-medium uppercase text-red-400">Old:</span>
                          <div
                            className="mt-1 text-sm text-slate-400 [&_p:last-child]:mb-0 [&_p]:mb-0"
                            dangerouslySetInnerHTML={{
                              __html: formatParagraphContent(formatValue(diff.oldValue)),
                            }}
                          />
                        </div>
                        <div>
                          <span className="text-xs font-medium uppercase text-emerald-400">
                            New:
                          </span>
                          <div
                            className="mt-1 text-sm text-slate-300 [&_p:last-child]:mb-0 [&_p]:mb-0"
                            dangerouslySetInnerHTML={{
                              __html: formatParagraphContent(formatValue(diff.newValue)),
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div className="rounded-lg border border-red-900/50 bg-red-900/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4">
          {/* Save Mode Options (only in Phase 2 when gallery handler is available) */}
          {isPhase2 && onAddToGallery && (
            <div className="mb-4 rounded-lg bg-slate-900 p-3">
              <p className="mb-2 text-xs text-slate-400">Save as:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSaveMode('replace')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    saveMode === 'replace'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Replace Primary
                </button>
                <button
                  onClick={() => setSaveMode('gallery')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    saveMode === 'gallery'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Add to Gallery
                </button>
              </div>

              {/* Gallery Role Selector */}
              {saveMode === 'gallery' && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs text-slate-400">Image Role:</label>
                  <div className="flex flex-wrap gap-2">
                    {GALLERY_ROLES.map((role) => (
                      <button
                        key={role}
                        onClick={() => setGalleryRole(role)}
                        className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                          galleryRole === role
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
            >
              Cancel
            </button>
            {isPhase2 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  saveMode === 'gallery'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : saveMode === 'gallery' ? (
                  <>
                    <ImagePlus className="h-4 w-4" />
                    Add to Gallery
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegenerateImageModal;
