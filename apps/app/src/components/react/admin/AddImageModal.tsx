/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AddImageModal Component
 * Modal for adding images to the exercise gallery via upload or AI generation.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, Sparkles, Send, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/supabase-instance';
import { uploadExerciseImage } from '@/lib/supabase/client/storage';
import {
  addExerciseImageWithShift,
  getExerciseImages,
} from '@/lib/supabase/client/exercise-gallery';
import type { ExerciseImageRole } from '@/types/generated-exercise';
import { stripHtml } from '@/lib/sanitize-paragraph-html';
import { dataUrlToBlob } from '@/lib/data-url-to-blob';

/** One item in the "images from this exercise" list (primary or gallery) */
interface ExerciseImageOption {
  id: string;
  imageUrl: string;
  roleLabel: string;
}

interface BiomechanicsContext {
  biomechanicalChain: string;
  pivotPoints: string;
  stabilizationNeeds: string;
}

interface AddImageModalProps {
  exerciseId: string;
  exerciseName: string;
  /** Primary image URL for the current exercise (enables "Use as reference" list) */
  primaryImageUrl?: string;
  /** Incremented when gallery changes so we refetch the "images from this exercise" list; omit to always refetch on open */
  galleryKey?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When set, adds "Anatomical Diagram" mode using biomechanics section text */
  biomechanicsContext?: BiomechanicsContext;
  /** When true, open directly in anatomical mode (e.g. from Biomechanical Analysis button) */
  initialMode?: 'upload' | 'generate' | 'anatomical';
}

type AddMode = 'upload' | 'generate' | 'anatomical';

const ANATOMICAL_SECTIONS: {
  key: keyof BiomechanicsContext;
  label: string;
  sectionType: 'chain' | 'pivot' | 'stabilization';
}[] = [
  { key: 'biomechanicalChain', label: 'The Chain', sectionType: 'chain' },
  { key: 'pivotPoints', label: 'Pivot Points', sectionType: 'pivot' },
  { key: 'stabilizationNeeds', label: 'Stabilization', sectionType: 'stabilization' },
];

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

const ROLE_DESCRIPTIONS: Record<Exclude<ExerciseImageRole, 'primary'>, string> = {
  secondary: 'Alternative angle or emphasis',
  tertiary: 'Supporting view',
  ghosted: 'Stylized/ghost effect version',
  illustration: 'Illustrated/diagram version',
  multiplicity: 'Sequence/multi-frame view',
  sequenceStart: 'Sequence start phase',
  sequenceMid: 'Sequence mid phase',
  sequenceEnd: 'Sequence end phase',
};

const AddImageModal: React.FC<AddImageModalProps> = ({
  exerciseId,
  exerciseName,
  primaryImageUrl,
  galleryKey,
  isOpen,
  onClose,
  onSuccess,
  biomechanicsContext,
  initialMode,
}) => {
  // Mode state - use anatomical when initialMode is anatomical and context exists
  const [mode, setMode] = useState<AddMode>(
    initialMode === 'anatomical' && biomechanicsContext ? 'anatomical' : 'upload'
  );

  // Anatomical mode state
  const [selectedSection, setSelectedSection] = useState<{
    key: keyof BiomechanicsContext;
    sectionType: 'chain' | 'pivot' | 'stabilization';
  } | null>(null);

  // Shared state
  const [role, setRole] = useState<Exclude<ExerciseImageRole, 'primary'>>('secondary');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate mode state
  const [exerciseTopic, setExerciseTopic] = useState(exerciseName);
  const [complexityLevel, setComplexityLevel] = useState('intermediate');
  const [visualStyle, setVisualStyle] = useState('photorealistic');
  const [demographics, setDemographics] = useState('');
  const [movementPhase, setMovementPhase] = useState('');
  const [bodySide, setBodySide] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [referenceImageData, setReferenceImageData] = useState<string | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);
  /** Which exercise image is currently loading as reference ('primary' or gallery image id) */
  const [loadingReferenceId, setLoadingReferenceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);

  // Images from this exercise (primary + gallery) for "Use as reference"
  const [exerciseImagesList, setExerciseImagesList] = useState<ExerciseImageOption[]>([]);
  const [loadingExerciseImages, setLoadingExerciseImages] = useState(false);
  // Cache by (exerciseId, galleryKey, primaryImageUrl) to avoid refetch when reopening without change
  const imagesCacheRef = useRef<{
    exerciseId: string;
    galleryKey: number | undefined;
    primaryImageUrl: string | undefined;
    list: ExerciseImageOption[];
  } | null>(null);

  // When opened with initialMode anatomical, switch to anatomical tab and default role
  useEffect(() => {
    if (isOpen && initialMode === 'anatomical' && biomechanicsContext) {
      setMode('anatomical');
      setRole('illustration');
    }
  }, [isOpen, initialMode, biomechanicsContext]);

  // Fetch primary + gallery when modal opens on Generate tab; use cache when same exercise, galleryKey, and primary
  useEffect(() => {
    if (!isOpen || mode !== 'generate') return;

    if (
      imagesCacheRef.current &&
      imagesCacheRef.current.exerciseId === exerciseId &&
      imagesCacheRef.current.galleryKey === galleryKey &&
      imagesCacheRef.current.primaryImageUrl === primaryImageUrl
    ) {
      setExerciseImagesList(imagesCacheRef.current.list);
      return;
    }

    const build = async () => {
      setLoadingExerciseImages(true);
      try {
        const list: ExerciseImageOption[] = [];
        if (primaryImageUrl) {
          list.push({ id: 'primary', imageUrl: primaryImageUrl, roleLabel: 'Primary' });
        }
        const gallery = await getExerciseImages(exerciseId);
        for (const img of gallery) {
          list.push({
            id: img.id,
            imageUrl: img.imageUrl,
            roleLabel: img.role.charAt(0).toUpperCase() + img.role.slice(1),
          });
        }
        setExerciseImagesList(list);
        imagesCacheRef.current = { exerciseId, galleryKey, primaryImageUrl, list };
      } catch {
        const fallback = primaryImageUrl
          ? [{ id: 'primary', imageUrl: primaryImageUrl, roleLabel: 'Primary' }]
          : [];
        setExerciseImagesList(fallback);
        imagesCacheRef.current = { exerciseId, galleryKey, primaryImageUrl, list: fallback };
      } finally {
        setLoadingExerciseImages(false);
      }
    };
    build();
  }, [isOpen, mode, exerciseId, primaryImageUrl, galleryKey]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Load reference image via same-origin proxy (avoids CORS with Firebase Storage)
  const loadReferenceImage = async () => {
    if (!referenceImageUrl.trim()) return;

    setLoadingReference(true);
    setError(null);

    try {
      const proxyUrl = `/api/load-reference-image?url=${encodeURIComponent(referenceImageUrl.trim())}`;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reference');
      setReferenceImageData(null);
    } finally {
      setLoadingReference(false);
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

  const handleGenerate = async () => {
    if (!exerciseTopic.trim()) {
      setError('Please enter an exercise name');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setGeneratedPrompt(null);

    try {
      const response = await fetch('/api/generate-exercise-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTopic: exerciseTopic.trim(),
          complexityLevel,
          visualStyle,
          demographics: demographics.trim() || undefined,
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

      const data = await response.json();
      setGeneratedImage(data.image);
      setGeneratedPrompt(data.imagePrompt || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAnatomical = async () => {
    if (!selectedSection || !biomechanicsContext) return;
    const raw = biomechanicsContext[selectedSection.key];
    const sectionText = stripHtml(raw).trim();
    if (!sectionText) {
      setError('Selected section has no content');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setGeneratedPrompt(null);

    try {
      const response = await fetch('/api/generate-anatomical-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: selectedSection.sectionType,
          sectionText,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate anatomical image');
      }

      const data = await response.json();
      setGeneratedImage(data.image);
      setGeneratedPrompt(data.imagePrompt || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    // Validate based on mode
    if (mode === 'upload' && !selectedFile) return;
    if ((mode === 'generate' || mode === 'anatomical') && !generatedImage) return;

    setSaving(true);
    setError(null);

    try {
      let imageUrl: string;
      let storagePath: string;

      if (mode === 'upload' && selectedFile) {
        // Upload mode: use the selected file
        const ext = selectedFile.name.split('.').pop() || 'png';
        const filename = `${exerciseId}-${role}-${Date.now()}.${ext}`;
        storagePath = `generated-exercises/${userId}/gallery/${filename}`;

        const { downloadUrl, storagePath: savedPath } = await uploadExerciseImage(
          selectedFile,
          storagePath,
          selectedFile.type || 'image/png'
        );
        imageUrl = downloadUrl;
        storagePath = savedPath;

        await addExerciseImageWithShift(exerciseId, {
          role,
          imageUrl,
          storagePath,
          createdBy: userId,
        });
      } else if ((mode === 'generate' || mode === 'anatomical') && generatedImage) {
        // Generate or anatomical mode: convert data URL to blob and upload
        const blob = dataUrlToBlob(generatedImage);
        const filename = `${exerciseId}-${role}-${Date.now()}.png`;
        storagePath = `generated-exercises/${userId}/gallery/${filename}`;

        const { downloadUrl, storagePath: savedPath } = await uploadExerciseImage(
          blob,
          storagePath,
          'image/png'
        );
        imageUrl = downloadUrl;
        storagePath = savedPath;

        await addExerciseImageWithShift(exerciseId, {
          role,
          imageUrl,
          storagePath,
          createdBy: userId,
          ...(generatedPrompt ? { imagePrompt: generatedPrompt } : {}),
          ...(mode === 'anatomical'
            ? { visualStyle: 'illustration' as const }
            : visualStyle
              ? { visualStyle }
              : {}),
          ...(mode === 'anatomical' && selectedSection?.sectionType
            ? { anatomicalSection: selectedSection.sectionType }
            : {}),
        });
      }

      // Success - show toast, close modal and refresh gallery
      toast.success(`Image added to gallery as ${role}`, {
        duration: 3000,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('[AddImageModal] Save error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save image';
      setError(errorMessage);
      toast.error('Failed to add image to gallery', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Reset all state
    setMode('upload');
    setRole('secondary');
    setError(null);
    // Anatomical state
    setSelectedSection(null);
    // Upload state
    setSelectedFile(null);
    setPreview(null);
    // Generate state
    setExerciseTopic(exerciseName);
    setComplexityLevel('intermediate');
    setVisualStyle('photorealistic');
    setDemographics('');
    setMovementPhase('');
    setBodySide('');
    setReferenceImageUrl('');
    setReferenceImageData(null);
    setGeneratedImage(null);
    setGeneratedPrompt(null);
    onClose();
  };

  const handleModeChange = (newMode: AddMode) => {
    setMode(newMode);
    setError(null);
    if (newMode === 'anatomical') setRole('illustration');
  };

  if (!isOpen) return null;

  const canSave =
    mode === 'upload'
      ? selectedFile !== null
      : (mode === 'generate' || mode === 'anatomical') && generatedImage !== null;

  const hasBiomechanicsContext = !!biomechanicsContext;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ImageIcon className="h-5 w-5 text-purple-400" />
            Add Gallery Image
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 px-4 pt-4">
          <button
            onClick={() => handleModeChange('upload')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload Image
          </button>
          <button
            onClick={() => handleModeChange('generate')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'generate'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </button>
          {hasBiomechanicsContext && (
            <button
              onClick={() => handleModeChange('anatomical')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'anatomical'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Activity className="h-4 w-4" />
              Anatomical Diagram
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-slate-400">
            Add an image to the gallery for{' '}
            <span className="font-medium text-white">{exerciseName}</span>
          </p>

          {/* Upload Mode Content */}
          {mode === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                preview
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
              }`}
            >
              {preview ? (
                <div className="space-y-3">
                  <img
                    src={preview}
                    alt="Preview"
                    className="mx-auto max-h-48 rounded-lg object-contain"
                  />
                  <p className="text-sm text-slate-400">{selectedFile?.name}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setPreview(null);
                    }}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto h-10 w-10 text-slate-500" />
                  <p className="text-sm text-slate-400">Click to select an image</p>
                  <p className="text-xs text-slate-500">PNG, JPG, WebP up to 10MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Generate Mode Content */}
          {mode === 'generate' && (
            <div className="space-y-4">
              {/* Generation Form (show when no image yet) */}
              {!generatedImage && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">
                      Exercise Name
                    </label>
                    <input
                      type="text"
                      value={exerciseTopic}
                      onChange={(e) => setExerciseTopic(e.target.value)}
                      placeholder="e.g. Barbell Squat, Push Up"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white placeholder-slate-500 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-300">
                        Complexity
                      </label>
                      <select
                        value={complexityLevel}
                        onChange={(e) => setComplexityLevel(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-purple-500"
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
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-purple-500"
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
                      placeholder="e.g. Female athlete, 30s"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white placeholder-slate-500 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-300">
                        Movement Phase
                      </label>
                      <select
                        value={movementPhase}
                        onChange={(e) => setMovementPhase(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Not specified</option>
                        <option value="bottom">Bottom</option>
                        <option value="midway">Midway</option>
                        <option value="top">Top</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-300">
                        Body Side
                      </label>
                      <select
                        value={bodySide}
                        onChange={(e) => setBodySide(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Not specified</option>
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                      </select>
                    </div>
                  </div>

                  {/* Reference Image */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <label className="mb-1 block text-sm font-medium text-slate-300">
                      Reference Image (Optional)
                    </label>
                    <p className="mb-2 text-xs text-slate-500">
                      Use an image from this exercise or paste a URL for subject consistency
                    </p>

                    {/* Images from this exercise */}
                    {(primaryImageUrl ||
                      loadingExerciseImages ||
                      exerciseImagesList.length > 0) && (
                      <div className="mb-3">
                        <p className="mb-2 text-xs font-medium text-slate-400">
                          Images from this exercise
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

                    <p className="mb-2 text-xs text-slate-500">Or paste image URL:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={referenceImageUrl}
                        onChange={(e) => setReferenceImageUrl(e.target.value)}
                        placeholder="Paste image URL..."
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={loadReferenceImage}
                        disabled={loadingReference || !referenceImageUrl.trim()}
                        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        {loadingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load'}
                      </button>
                    </div>
                    {referenceImageData && (
                      <div className="mt-2 flex items-center gap-2">
                        <img
                          src={referenceImageData}
                          alt="Reference"
                          className="h-12 w-12 rounded border border-slate-600 object-cover"
                        />
                        <span className="text-xs text-purple-400">Reference loaded</span>
                        <button
                          type="button"
                          onClick={() => {
                            setReferenceImageUrl('');
                            setReferenceImageData(null);
                          }}
                          className="ml-auto text-xs text-slate-400 hover:text-white"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={generating || !exerciseTopic.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Generate Image
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Generated Image Preview */}
              {generatedImage && (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                    <img
                      src={generatedImage}
                      alt="Generated preview"
                      className="h-48 w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">Image generated successfully</p>
                    <button
                      onClick={() => {
                        setGeneratedImage(null);
                        setGeneratedPrompt(null);
                      }}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      Generate another
                    </button>
                  </div>
                  {generatedPrompt && (
                    <details className="cursor-pointer text-xs text-slate-500">
                      <summary>View image prompt</summary>
                      <p className="mt-1 rounded border border-slate-700 bg-slate-900 p-2 text-slate-400">
                        {generatedPrompt}
                      </p>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Anatomical Mode Content */}
          {mode === 'anatomical' && hasBiomechanicsContext && biomechanicsContext && (
            <div className="space-y-4">
              {!generatedImage ? (
                <>
                  <p className="text-sm text-slate-400">
                    Select a biomechanics section. Its text will be used to generate an anatomical
                    diagram (kinetic chain, joints, muscle groups).
                  </p>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Section to illustrate
                    </label>
                    <div className="flex flex-col gap-2">
                      {ANATOMICAL_SECTIONS.map(({ key, label, sectionType }) => {
                        const raw = biomechanicsContext[key];
                        const plain = stripHtml(raw).trim();
                        const isEmpty = !plain;
                        const preview = isEmpty
                          ? 'No content'
                          : plain.length > 60
                            ? `${plain.slice(0, 60)}…`
                            : plain;
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={isEmpty}
                            onClick={() => setSelectedSection({ key, sectionType })}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              selectedSection?.key === key
                                ? 'border-purple-500 bg-purple-500/20 text-white'
                                : isEmpty
                                  ? 'cursor-not-allowed border-slate-700 bg-slate-900/50 text-slate-500'
                                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                            }`}
                          >
                            <span className="block font-medium">{label}</span>
                            <span className="mt-1 block text-xs opacity-80">{preview}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateAnatomical}
                    disabled={
                      generating ||
                      !selectedSection ||
                      !stripHtml(biomechanicsContext[selectedSection.key]).trim()
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Generate Anatomical Image
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                    <img
                      src={generatedImage}
                      alt="Generated anatomical preview"
                      className="h-48 w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">Anatomical image generated</p>
                    <button
                      onClick={() => {
                        setGeneratedImage(null);
                        setGeneratedPrompt(null);
                      }}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      Generate another
                    </button>
                  </div>
                  {generatedPrompt && (
                    <details className="cursor-pointer text-xs text-slate-500">
                      <summary>View image prompt</summary>
                      <p className="mt-1 rounded border border-slate-700 bg-slate-900 p-2 text-slate-400">
                        {generatedPrompt}
                      </p>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Role Selector (shown for all modes when image is ready) */}
          {((mode === 'upload' && preview) ||
            ((mode === 'generate' || mode === 'anatomical') && generatedImage)) && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Image Role</label>
              <div className="grid grid-cols-2 gap-2">
                {GALLERY_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-lg p-3 text-left transition-colors ${
                      role === r
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <span className="block text-sm font-medium capitalize">{r}</span>
                    <span
                      className={`mt-0.5 block text-xs ${role === r ? 'text-purple-200' : 'text-slate-400'}`}
                    >
                      {ROLE_DESCRIPTIONS[r]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-900/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-700 p-4">
          <button
            onClick={handleClose}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                Add to Gallery
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddImageModal;
