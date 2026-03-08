/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DeepDiveEditor Component
 * Admin interface for editing the generated Deep Dive HTML content.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Copy,
  Check,
  Image as ImageIcon,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Star,
  RefreshCw,
} from 'lucide-react';
import type { GeneratedExercise, ExerciseImage } from '@/types/generated-exercise';
import {
  getExerciseImages,
  reorderGalleryImages,
  promoteToPrimary,
} from '@/lib/supabase/client/exercise-gallery';
import { toast } from 'sonner';
import { extractExecutionProtocolFromDeepDiveHtml } from '@/lib/parse-execution-protocol';
import ExecutionProtocolSteps from '@/components/react/ExecutionProtocolSteps';

interface DeepDiveEditorProps {
  exercise: GeneratedExercise;
  onSave: (html: string) => Promise<void>;
  onCancel: () => void;
  /** Current user UID for attributing gallery actions (e.g. promote/demote). */
  currentUserId?: string;
}

const DeepDiveEditor: React.FC<DeepDiveEditorProps> = ({
  exercise,
  onSave,
  onCancel,
  currentUserId,
}) => {
  const [htmlContent, setHtmlContent] = useState(exercise.deepDiveHtmlContent || '');
  const [images, setImages] = useState<ExerciseImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);
  const [isUpdatingImages, setIsUpdatingImages] = useState(false);
  /** When set, show confirmation modal for promoting this image to primary */
  const [promoteConfirmImage, setPromoteConfirmImage] = useState<ExerciseImage | null>(null);

  // Fetch available images on mount
  const fetchImages = async () => {
    setLoadingImages(true);
    try {
      const galleryImages = await getExerciseImages(exercise.id);

      const allImages = [...galleryImages];
      // Add primary image as an option if it has a URL
      if (exercise.imageUrl) {
        // Check if it's already in gallery to avoid dupes
        const exists = galleryImages.some((img) => img.imageUrl === exercise.imageUrl);
        if (!exists) {
          allImages.unshift({
            id: 'primary',
            imageUrl: exercise.imageUrl,
            role: 'primary',
            storagePath: exercise.storagePath,
            createdAt: exercise.createdAt,
            createdBy: exercise.generatedBy,
            exerciseId: exercise.id,
            position: -1, // Primary is always first conceptually
          } as ExerciseImage);
        }
      }

      setImages(allImages);
    } catch (err) {
      console.error('Error fetching images:', err);
      toast.error('Failed to load images');
    } finally {
      setLoadingImages(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [exercise.id, exercise.imageUrl, exercise.createdAt]);

  /** Parsed Execution Protocol steps from current HTML (same logic as warmup timer). */
  const parsedExecutionSteps = useMemo(
    () => (htmlContent ? extractExecutionProtocolFromDeepDiveHtml(htmlContent) : []),
    [htmlContent]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(htmlContent);
      toast.success('Deep dive content updated');
    } catch (err) {
      console.error('Error saving deep dive content:', err);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedImageId(id);
    toast.success('Image URL copied to clipboard');
    setTimeout(() => setCopiedImageId(null), 2000);
  };

  const handleMoveImage = async (index: number, direction: 'up' | 'down') => {
    // Only reorder gallery images (index > 0 if primary is at 0, or check role)
    // Actually, our list includes 'primary' at index 0 which is fake.
    // Real gallery images start at index 1 (if primary exists) or 0 (if no primary, unlikely).
    // Let's filter for real gallery images first.

    const galleryImages = images.filter((img) => img.id !== 'primary');
    const primaryImage = images.find((img) => img.id === 'primary');

    // Adjust index to be relative to galleryImages
    const galleryIndex = primaryImage ? index - 1 : index;

    if (galleryIndex < 0 || galleryIndex >= galleryImages.length) return;

    const newIndex = direction === 'up' ? galleryIndex - 1 : galleryIndex + 1;
    if (newIndex < 0 || newIndex >= galleryImages.length) return;

    // Swap
    const newGalleryImages = [...galleryImages];
    [newGalleryImages[galleryIndex], newGalleryImages[newIndex]] = [
      newGalleryImages[newIndex],
      newGalleryImages[galleryIndex],
    ];

    // Optimistic update
    setImages(primaryImage ? [primaryImage, ...newGalleryImages] : newGalleryImages);

    setIsUpdatingImages(true);
    try {
      await reorderGalleryImages(
        exercise.id,
        newGalleryImages.map((img) => img.id)
      );
      toast.success('Image order updated');
    } catch (err) {
      console.error('Error reordering images:', err);
      toast.error('Failed to reorder images');
      fetchImages(); // Revert
    } finally {
      setIsUpdatingImages(false);
    }
  };

  const doPromoteToPrimary = async (image: ExerciseImage) => {
    const currentPrimary = images.find((img) => img.id === 'primary' || img.role === 'primary');
    if (!currentPrimary) throw new Error('Current primary image not found');

    await promoteToPrimary(
      exercise.id,
      image.id,
      currentPrimary.imageUrl,
      currentPrimary.storagePath,
      currentUserId
    );

    if (htmlContent) {
      // Update only <img> src attributes that match the current primary URL (avoid replacing in comments, etc.)
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      doc.querySelectorAll('img').forEach((imgEl) => {
        const src = imgEl.getAttribute('src');
        if (src === currentPrimary.imageUrl) {
          imgEl.setAttribute('src', image.imageUrl);
        }
      });
      const hasDoctype = /^\s*<!DOCTYPE/i.test(htmlContent);
      const updatedHtml = (hasDoctype ? '<!DOCTYPE html>\n' : '') + doc.documentElement.outerHTML;
      setHtmlContent(updatedHtml);
      await onSave(updatedHtml);
    }

    toast.success('Image promoted to Primary and HTML updated');
    await fetchImages();
    toast.info('Please refresh the main admin view to see changes there.');
  };

  const handlePromoteToPrimaryClick = (image: ExerciseImage) => {
    if (image.role === 'primary' || image.id === 'primary') return;
    setPromoteConfirmImage(image);
  };

  const handlePromoteConfirm = async () => {
    if (!promoteConfirmImage) return;
    const image = promoteConfirmImage;
    setPromoteConfirmImage(null);
    setIsUpdatingImages(true);
    try {
      await doPromoteToPrimary(image);
    } catch (err) {
      console.error('Error promoting image:', err);
      toast.error('Failed to promote image');
    } finally {
      setIsUpdatingImages(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-6 py-4">
        <h2 className="text-xl font-bold">Edit Deep Dive Content</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-700"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-600"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor Column */}
        <div
          className={`flex flex-col border-r border-slate-700 ${showPreview ? 'w-1/2' : 'flex-1'}`}
        >
          <div className="flex-1 overflow-hidden">
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="h-full w-full resize-none bg-slate-900 p-4 font-mono text-sm text-slate-300 outline-none focus:ring-0"
              placeholder="<html>...</html>"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Preview Column (Conditional) */}
        {showPreview && (
          <div className="w-1/2 overflow-hidden bg-white">
            <iframe
              srcDoc={htmlContent}
              className="h-full w-full border-none"
              title="Deep Dive Preview"
            />
          </div>
        )}

        {/* Image Sidebar */}
        <div className="w-64 flex-shrink-0 overflow-y-auto border-l border-slate-700 bg-slate-800 p-4">
          {/* Execution Protocol (Warmup) — live preview of what the Daily Warm-Up timer will show */}
          <div className="mb-6 rounded-lg border border-slate-600 bg-slate-900 p-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Execution Protocol (Warmup)
            </h3>
            {parsedExecutionSteps.length > 0 ? (
              <div className="max-h-48 min-h-0 overflow-y-auto">
                <ExecutionProtocolSteps
                  steps={parsedExecutionSteps}
                  variant="compact"
                  maxHeight="10rem"
                  className="text-xs text-white/90"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No steps parsed. Use an <code className="rounded bg-slate-700 px-1">h2</code> or{' '}
                <code className="rounded bg-slate-700 px-1">h3</code> titled &quot;Execution
                Protocol&quot; or &quot;Step-by-Step&quot; and a single{' '}
                <code className="rounded bg-slate-700 px-1">ol</code> with one{' '}
                <code className="rounded bg-slate-700 px-1">li</code> per step.
              </p>
            )}
          </div>

          <h3 className="mb-4 flex items-center justify-between text-sm font-bold text-slate-400">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Available Images
            </span>
            <button
              onClick={fetchImages}
              disabled={loadingImages}
              className="rounded p-1 hover:bg-slate-700 hover:text-white disabled:opacity-50"
              title="Refresh Images"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingImages ? 'animate-spin' : ''}`} />
            </button>
          </h3>

          {loadingImages ? (
            <div className="text-center text-sm text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-4">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="group relative rounded-lg border border-slate-700 bg-slate-900 p-2"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded bg-black/50">
                    <img src={img.imageUrl} alt={img.role} className="h-full w-full object-cover" />
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      {img.role !== 'primary' && img.id !== 'primary' && (
                        <>
                          <button
                            onClick={() => handlePromoteToPrimaryClick(img)}
                            disabled={isUpdatingImages}
                            className="rounded-full bg-white/10 p-2 text-white hover:bg-emerald-600"
                            title="Make Primary"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleMoveImage(index, 'up')}
                              disabled={
                                isUpdatingImages || index <= (images[0]?.id === 'primary' ? 1 : 0)
                              }
                              className="rounded-full bg-white/10 p-1.5 text-white hover:bg-blue-600 disabled:opacity-30"
                              title="Move Up"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleMoveImage(index, 'down')}
                              disabled={isUpdatingImages || index >= images.length - 1}
                              className="rounded-full bg-white/10 p-1.5 text-white hover:bg-blue-600 disabled:opacity-30"
                              title="Move Down"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`text-xs font-medium capitalize ${img.role === 'primary' ? 'text-emerald-400' : 'text-slate-400'}`}
                    >
                      {img.role === 'primary' ? 'Primary' : img.role}
                    </span>
                    <button
                      onClick={() => copyToClipboard(img.imageUrl, img.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                      title="Copy URL"
                    >
                      {copiedImageId === img.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
              {images.length === 0 && (
                <p className="text-center text-xs text-slate-500">No images found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Promote-to-Primary confirmation modal */}
      {promoteConfirmImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-labelledby="promote-confirm-title"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
            <h3 id="promote-confirm-title" className="mb-2 text-lg font-semibold text-white">
              Promote to Primary?
            </h3>
            <p className="mb-6 text-sm text-slate-300">
              The current Primary image will be moved to the gallery. The deep dive HTML will be
              updated to use the new primary image.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPromoteConfirmImage(null)}
                className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePromoteConfirm}
                disabled={isUpdatingImages}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isUpdatingImages ? 'Promoting…' : 'Promote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeepDiveEditor;
