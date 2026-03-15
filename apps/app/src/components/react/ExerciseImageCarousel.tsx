/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ExerciseImageCarousel Component
 * Displays a horizontal scrollable carousel of exercise gallery images.
 * Supports lightbox view and admin controls.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  Image as ImageIcon,
  Loader2,
  Video,
  Eye,
  EyeOff,
  Pencil,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  getExerciseImages,
  deleteExerciseImage,
  updateExerciseImageHidden,
} from '@/lib/supabase/client/exercise-gallery';
import {
  removeExerciseVideo,
  updateExerciseVideo,
  reorderExerciseVideos,
} from '@/lib/supabase/client/generated-exercises';
import type { ExerciseImage, ExerciseImageRole } from '@/types/generated-exercise';

interface ExerciseImageCarouselProps {
  exerciseId: string;
  /** Videos to show in the carousel; each fills a slot */
  videos?: Array<{
    videoUrl: string;
    videoStoragePath?: string;
    label?: string;
    hidden?: boolean;
    position?: number;
  }>;
  isAdmin?: boolean;
  onAddImage?: () => void;
  /** Handler for opening the add video modal (admin only) */
  onAddVideo?: () => void;
  /** Callback when gallery or videos change (for refreshing) */
  onGalleryChange?: () => void;
}

/** Role badge colors and labels */
const ROLE_CONFIG: Record<ExerciseImageRole, { label: string; color: string }> = {
  primary: { label: 'Primary', color: 'bg-[#ffbf00]/80 text-black' },
  secondary: { label: 'Secondary', color: 'bg-blue-500/80 text-white' },
  tertiary: { label: 'Tertiary', color: 'bg-purple-500/80 text-white' },
  ghosted: { label: 'Ghosted', color: 'bg-slate-500/80 text-white' },
  illustration: { label: 'Illustration', color: 'bg-[#ffbf00]/80 text-black' },
  multiplicity: { label: 'Multiplicity', color: 'bg-teal-500/80 text-white' },
  sequenceStart: { label: 'Start', color: 'bg-teal-600/80 text-white' },
  sequenceMid: { label: 'Mid', color: 'bg-teal-500/80 text-white' },
  sequenceEnd: { label: 'End', color: 'bg-teal-400/80 text-white' },
};

const ANATOMICAL_SECTION_LABELS: Record<string, string> = {
  chain: 'The Chain',
  pivot: 'Pivot Points',
  stabilization: 'Stabilization',
};

const ExerciseImageCarousel: React.FC<ExerciseImageCarouselProps> = ({
  exerciseId,
  videos = [],
  isAdmin = false,
  onAddImage,
  onAddVideo,
  onGalleryChange,
}) => {
  const [images, setImages] = useState<ExerciseImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ExerciseImage | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingVideoIndex, setDeletingVideoIndex] = useState<number | null>(null);
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [updatingVideoIndex, setUpdatingVideoIndex] = useState<number | null>(null);
  const [updatingImageId, setUpdatingImageId] = useState<string | null>(null);

  const displayImages = isAdmin
    ? [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : images.filter((img) => !img.hidden).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Fetch images on mount and when exerciseId changes
  useEffect(() => {
    fetchImages();
  }, [exerciseId]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getExerciseImages(exerciseId);
      setImages(data);
    } catch (err) {
      console.error('[ExerciseImageCarousel] Error fetching images:', err);
      setError('Failed to load gallery images');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (index: number) => {
    if (!confirm('Delete this video from the gallery?')) return;
    const videoUrl = videos[index]?.videoUrl;
    if (!videoUrl) return;
    try {
      setDeletingVideoIndex(index);
      await removeExerciseVideo(exerciseId, videoUrl);
      setSelectedVideoIndex(null);
      onGalleryChange?.();
    } catch (err) {
      console.error('[ExerciseImageCarousel] Error deleting video:', err);
      alert('Failed to delete video');
    } finally {
      setDeletingVideoIndex(null);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm('Delete this image from the gallery?')) return;

    try {
      setDeleting(imageId);
      await deleteExerciseImage(exerciseId, imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      if (selectedImage?.id === imageId) {
        setSelectedImage(null);
      }
      onGalleryChange?.();
    } catch (err) {
      console.error('[ExerciseImageCarousel] Error deleting image:', err);
      alert('Failed to delete image');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleImageHidden = async (imageId: string, hidden: boolean) => {
    try {
      setUpdatingImageId(imageId);
      await updateExerciseImageHidden(exerciseId, imageId, hidden);
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, hidden } : img)));
      onGalleryChange?.();
    } catch (err) {
      console.error('[ExerciseImageCarousel] Error toggling image visibility:', err);
      alert('Failed to update image');
    } finally {
      setUpdatingImageId(null);
    }
  };

  const handleToggleVideoHidden = async (index: number, hidden: boolean) => {
    const videoUrl = videos[index]?.videoUrl;
    if (!videoUrl) return;
    try {
      setUpdatingVideoIndex(index);
      await updateExerciseVideo(exerciseId, videoUrl, { hidden });
      onGalleryChange?.();
    } catch (err) {
      console.error('[ExerciseImageCarousel] Error toggling video visibility:', err);
      alert('Failed to update video');
    } finally {
      setUpdatingVideoIndex(null);
    }
  };

  const handleSaveVideoLabel = async (index: number) => {
    const videoUrl = videos[index]?.videoUrl;
    if (!videoUrl) return;
    const label = editingLabel.trim().slice(0, 50);
    setEditingVideoIndex(null);
    setEditingLabel('');
    try {
      setUpdatingVideoIndex(index);
      await updateExerciseVideo(exerciseId, videoUrl, { label: label || undefined });
      onGalleryChange?.();
    } catch (err) {
      console.error('[ExerciseImageCarousel] Error saving video label:', err);
      alert('Failed to update video label');
    } finally {
      setUpdatingVideoIndex(null);
    }
  };

  const handleReorderVideo = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= videos.length) return;
    const urls = videos.map((v) => v.videoUrl);
    [urls[index], urls[newIndex]] = [urls[newIndex], urls[index]];
    try {
      setUpdatingVideoIndex(index);
      await reorderExerciseVideos(exerciseId, urls);
      onGalleryChange?.();
    } catch (err) {
      console.error('[ExerciseImageCarousel] Error reordering video:', err);
      alert('Failed to reorder video');
    } finally {
      setUpdatingVideoIndex(null);
    }
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    const currentIndex = displayImages.findIndex((img) => img.id === selectedImage.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < displayImages.length) {
      setSelectedImage(displayImages[newIndex]);
    }
  };

  // Don't render if no videos, no images, and not admin
  if (!loading && videos.length === 0 && displayImages.length === 0 && !isAdmin) {
    return null;
  }

  return (
    <>
      <div className="px-4 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#ffbf00]">Gallery</h4>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {images.length < 5 && onAddImage && (
                <button
                  onClick={onAddImage}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#ffbf00] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Image
                </button>
              )}
              {onAddVideo && (
                <button
                  onClick={onAddVideo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#ffbf00] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
                >
                  <Video className="h-3.5 w-3.5" />
                  Add Video
                </button>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading gallery...
          </div>
        )}

        {/* Error State */}
        {error && <div className="py-4 text-sm text-red-400">{error}</div>}

        {/* Empty State (Admin only - no videos and no images) */}
        {!loading && videos.length === 0 && displayImages.length === 0 && isAdmin && (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-700 py-8">
            <button
              onClick={onAddImage}
              className="flex flex-col items-center gap-2 text-slate-500 transition-colors hover:text-[#ffbf00]"
            >
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">Add gallery images</span>
            </button>
          </div>
        )}

        {/* Carousel */}
        {!loading &&
          (videos.length > 0 ||
            displayImages.length > 0 ||
            (isAdmin && (onAddVideo || onAddImage))) && (
            <div className="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent flex gap-3 overflow-x-auto pb-2">
              {/* Video thumbnails */}
              {videos.map((v, idx) => (
                <div
                  key={idx}
                  className={`group relative flex-shrink-0 ${v.hidden ? 'opacity-60' : ''}`}
                >
                  <button
                    onClick={() => setSelectedVideoIndex(idx)}
                    className="block h-24 w-24 overflow-hidden rounded-lg border border-teal-600 transition-colors hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 md:h-32 md:w-32"
                  >
                    <video
                      src={v.videoUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="none"
                    />
                  </button>
                  <span className="absolute left-1 top-1 max-w-[5rem] truncate rounded bg-teal-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {v.hidden
                      ? 'Hidden'
                      : v.label || (videos.length > 1 ? `Video ${idx + 1}` : 'Video')}
                  </span>
                  {isAdmin && (
                    <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingVideoIndex(idx);
                          setEditingLabel(v.label ?? '');
                        }}
                        disabled={updatingVideoIndex === idx}
                        className="rounded bg-slate-700 p-1 text-white hover:bg-slate-600 disabled:opacity-50"
                        title="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVideoHidden(idx, !v.hidden);
                        }}
                        disabled={updatingVideoIndex === idx}
                        className="rounded bg-slate-700 p-1 text-white hover:bg-slate-600 disabled:opacity-50"
                        title={v.hidden ? 'Show' : 'Hide'}
                      >
                        {v.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderVideo(idx, 'up');
                        }}
                        disabled={updatingVideoIndex === idx || idx === 0}
                        className="rounded bg-slate-700 p-0.5 text-white hover:bg-slate-600 disabled:opacity-50"
                        title="Move up"
                      >
                        <ChevronUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderVideo(idx, 'down');
                        }}
                        disabled={updatingVideoIndex === idx || idx === videos.length - 1}
                        className="rounded bg-slate-700 p-0.5 text-white hover:bg-slate-600 disabled:opacity-50"
                        title="Move down"
                      >
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVideo(idx);
                        }}
                        disabled={deletingVideoIndex === idx}
                        className="rounded bg-red-600/80 p-1 text-white hover:bg-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingVideoIndex === idx ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                  {editingVideoIndex === idx && (
                    <div
                      className="absolute right-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-lg border border-slate-600 bg-slate-800 p-2 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        placeholder="Video label"
                        maxLength={50}
                        className="w-32 rounded bg-slate-700 px-2 py-1 text-sm text-white placeholder-slate-400"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSaveVideoLabel(idx)}
                          className="rounded bg-teal-600 px-2 py-1 text-xs text-white hover:bg-teal-500"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingVideoIndex(null);
                            setEditingLabel('');
                          }}
                          className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {/* Empty video slot placeholder (admin) */}
              {isAdmin && onAddVideo && (
                <button
                  onClick={onAddVideo}
                  className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-teal-600/50 text-teal-500 transition-colors hover:border-teal-500 hover:text-teal-400 md:h-32 md:w-32"
                >
                  <Video className="h-6 w-6" />
                </button>
              )}
              {displayImages.map((image) => (
                <div
                  key={image.id}
                  className={`group relative flex-shrink-0 ${image.hidden ? 'opacity-60' : ''}`}
                >
                  <button
                    onClick={() => setSelectedImage(image)}
                    className="block h-24 w-24 overflow-hidden rounded-lg border border-slate-700 transition-colors hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:h-32 md:w-32"
                  >
                    <img
                      src={image.imageUrl}
                      alt={`${image.role} view`}
                      className="h-full w-full object-cover"
                    />
                  </button>

                  {/* Role or Hidden Badge */}
                  <span
                    className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      image.hidden ? 'bg-slate-600 text-white' : ROLE_CONFIG[image.role].color
                    }`}
                  >
                    {image.hidden
                      ? 'Hidden'
                      : image.anatomicalSection
                        ? (ANATOMICAL_SECTION_LABELS[image.anatomicalSection] ??
                          ROLE_CONFIG[image.role].label)
                        : ROLE_CONFIG[image.role].label}
                  </span>

                  {/* Admin Buttons */}
                  {isAdmin && (
                    <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleImageHidden(image.id, !image.hidden);
                        }}
                        disabled={updatingImageId === image.id}
                        className="rounded bg-slate-700 p-1 text-white hover:bg-slate-600 disabled:opacity-50"
                        title={image.hidden ? 'Show' : 'Hide'}
                      >
                        {image.hidden ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(image.id);
                        }}
                        disabled={deleting === image.id}
                        className="rounded bg-red-600/80 p-1 text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {deleting === image.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Button (inline) */}
              {isAdmin && images.length < 5 && onAddImage && (
                <button
                  onClick={onAddImage}
                  className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 text-slate-500 transition-colors hover:border-slate-500 hover:text-slate-400 md:h-32 md:w-32"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )}
            </div>
          )}
      </div>

      {/* Video Lightbox Modal */}
      <AnimatePresence>
        {selectedVideoIndex !== null && videos[selectedVideoIndex] && (
          <motion.div
            key="video-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setSelectedVideoIndex(null)}
          >
            <button
              onClick={() => setSelectedVideoIndex(null)}
              className="absolute right-4 top-4 rounded-lg bg-slate-800 p-2 text-white transition-colors hover:bg-slate-700"
            >
              <X className="h-6 w-6" />
            </button>
            <video
              src={videos[selectedVideoIndex].videoUrl}
              controls
              autoPlay
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-teal-500/80 px-3 py-1.5 text-sm font-medium text-white">
                {videos[selectedVideoIndex]?.label ||
                  (videos.length > 1 ? `Video ${selectedVideoIndex + 1}` : 'Video')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setSelectedImage(null)}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute right-4 top-4 rounded-lg bg-slate-800 p-2 text-white transition-colors hover:bg-slate-700"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Previous Button */}
            {displayImages.findIndex((img) => img.id === selectedImage.id) > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('prev');
                }}
                className="absolute left-4 rounded-lg bg-slate-800 p-2 text-white transition-colors hover:bg-slate-700"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Image */}
            <motion.img
              key={selectedImage.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage.imageUrl}
              alt={`${selectedImage.role} view`}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Next Button */}
            {displayImages.findIndex((img) => img.id === selectedImage.id) <
              displayImages.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('next');
                }}
                className="absolute right-4 rounded-lg bg-slate-800 p-2 text-white transition-colors hover:bg-slate-700"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Role Badge in Lightbox */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${ROLE_CONFIG[selectedImage.role].color}`}
              >
                {selectedImage.anatomicalSection
                  ? (ANATOMICAL_SECTION_LABELS[selectedImage.anatomicalSection] ??
                    ROLE_CONFIG[selectedImage.role].label)
                  : ROLE_CONFIG[selectedImage.role].label}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ExerciseImageCarousel;
