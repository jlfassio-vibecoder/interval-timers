/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GeneratedExerciseDetail Component
 * Displays exercise data using the "Iceberg Method" layout:
 * - Hero (Visuals) → Surface (Cues) → Deep Dive (Science) → Bedrock (Sources)
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Zap,
  AlertTriangle,
  ExternalLink,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Save,
  RefreshCw,
  Edit,
  X,
  Loader2,
  ImagePlus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  GeneratedExercise,
  GeneratedExerciseStatus,
  ExerciseImage,
} from '@/types/generated-exercise';
import { getExerciseImages } from '@/lib/supabase/client/exercise-gallery';
import { normalizeListItems, filterRealSources } from '@/lib/parse-biomechanics';
import { formatParagraphContent } from '@/lib/sanitize-paragraph-html';
import ExerciseImageCarousel from './ExerciseImageCarousel';
import VideoPlayer from './VideoPlayer';

interface GeneratedExerciseDetailProps {
  exercise: GeneratedExercise;
  /** Show admin controls (approve/reject) */
  isAdmin?: boolean;
  /** Handler for status updates (admin only) */
  onStatusUpdate?: (status: GeneratedExerciseStatus, reason?: string) => Promise<void>;
  /** Handler for saving image only with custom exercise name (admin only) */
  onSaveImageOnly?: (exerciseName: string) => Promise<void>;
  /** Handler for opening the regenerate image modal (admin only) */
  onRegenerate?: () => void;
  /** Handler for opening the add image modal (admin only) */
  onAddImage?: () => void;
  /** Handler for opening the add video modal (admin only) */
  onAddVideo?: () => void;
  /** Handler for opening the add anatomical image modal from biomechanics (admin only) */
  onAddAnatomicalImage?: () => void;
  /** Callback when gallery changes (for refreshing) */
  onGalleryChange?: () => void;
  /** Handler for generating deep dive page */
  onGenerateDeepDive?: () => void;
  /** Handler for opening the deep dive editor (admin only) */
  onEditDeepDive?: () => void;
  /** Whether deep dive generation is in progress */
  isGeneratingDeepDive?: boolean;
}

/** Status badge component */
const StatusBadge: React.FC<{ status: GeneratedExerciseStatus }> = ({ status }) => {
  const config = {
    pending: {
      icon: Clock,
      bg: 'bg-[#ffbf00]/20',
      text: 'text-[#ffbf00]',
      label: 'Pending Review',
    },
    approved: {
      icon: CheckCircle,
      bg: 'bg-[#ffbf00]/20',
      text: 'text-[#ffbf00]',
      label: 'Approved',
    },
    rejected: { icon: XCircle, bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
  };

  const { icon: Icon, bg, text, label } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

const GeneratedExerciseDetail: React.FC<GeneratedExerciseDetailProps> = ({
  exercise,
  isAdmin = false,
  onStatusUpdate,
  onSaveImageOnly,
  onRegenerate,
  onAddImage,
  onAddVideo,
  onAddAnatomicalImage,
  onGalleryChange,
  onGenerateDeepDive,
  onEditDeepDive,
  isGeneratingDeepDive = false,
}) => {
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'chain' | 'pivot' | 'stabilization'>(
    'chain'
  );
  const [anatomicalImagesBySection, setAnatomicalImagesBySection] = useState<
    Partial<Record<'chain' | 'pivot' | 'stabilization', ExerciseImage>>
  >({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  // Save Image Only state
  const [showSaveImageModal, setShowSaveImageModal] = useState(false);
  const [saveImageName, setSaveImageName] = useState('');
  const [isSavingImage, setIsSavingImage] = useState(false);
  // Edit mode state (for accessing admin controls on approved/rejected exercises)
  const [isEditMode, setIsEditMode] = useState(false);
  // Collapsible "Learn more" (biomechanics) when user instructions are shown — closed by default
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getExerciseImages(exercise.id)
      .then((images) => {
        if (cancelled) return;
        const sectionTypes = ['chain', 'pivot', 'stabilization'] as const;
        const filtered = images.filter(
          (img): img is ExerciseImage & { anatomicalSection: (typeof sectionTypes)[number] } =>
            !!img.anatomicalSection && sectionTypes.includes(img.anatomicalSection)
        );
        const map: Partial<Record<'chain' | 'pivot' | 'stabilization', ExerciseImage>> = {};
        for (const img of filtered) {
          map[img.anatomicalSection] = img;
        }
        setAnatomicalImagesBySection(map);
      })
      .catch(() => {
        if (!cancelled) setAnatomicalImagesBySection({});
      });
    return () => {
      cancelled = true;
    };
  }, [exercise.id]);

  const handleApprove = async () => {
    if (!onStatusUpdate) return;
    setIsUpdating(true);
    try {
      await onStatusUpdate('approved');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!onStatusUpdate || !rejectReason.trim()) return;
    setIsUpdating(true);
    try {
      await onStatusUpdate('rejected', rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason('');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveImageOnly = async () => {
    if (!onSaveImageOnly || !saveImageName.trim()) return;
    setIsSavingImage(true);
    try {
      await onSaveImageOnly(saveImageName.trim());
      setShowSaveImageModal(false);
      setSaveImageName('');
    } finally {
      setIsSavingImage(false);
    }
  };

  const openSaveImageModal = () => {
    setSaveImageName(exercise.exerciseName); // Pre-fill with current name
    setShowSaveImageModal(true);
  };

  const { biomechanics, sources } = exercise;
  const hasUserInstructions = !isAdmin && !!exercise.userFriendlyInstructions?.trim();
  const allVideos =
    exercise.videos && exercise.videos.length > 0
      ? exercise.videos.map((v, i) => ({
          videoUrl: v.videoUrl,
          videoStoragePath: v.videoStoragePath ?? '',
          label: v.label,
          hidden: v.hidden ?? false,
          position: v.position ?? i,
        }))
      : exercise.videoUrl
        ? [
            {
              videoUrl: exercise.videoUrl,
              videoStoragePath: exercise.videoStoragePath ?? '',
              hidden: false,
              position: 0,
            },
          ]
        : [];
  const visibleVideos = allVideos
    .filter((v) => !v.hidden)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const videosForCarousel = isAdmin
    ? [...allVideos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : visibleVideos;

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-[#0d0500] pb-10 text-white">
      {/* 1. HERO SECTION - The Stroboscopic Shot */}
      <div className="relative flex h-80 w-full items-center justify-center overflow-hidden bg-[#0d0500] md:h-[28rem]">
        <img
          src={exercise.imageUrl}
          alt={`${exercise.exerciseName} biomechanics visualization`}
          className="max-h-full max-w-full object-contain"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0500] via-[#0d0500]/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6">
          {isAdmin && (
            <div className="mb-3">
              <StatusBadge status={exercise.status} />
            </div>
          )}
          <h1 className="mb-2 text-3xl font-bold md:text-5xl">{exercise.exerciseName}</h1>
          <span className="font-mono text-sm tracking-wider text-[#ffbf00]">
            {exercise.kineticChainType}
          </span>
        </div>
      </div>

      {/* Edit Button for non-pending exercises */}
      {isAdmin && exercise.status !== 'pending' && !isEditMode && (
        <div className="px-4 md:px-6">
          <button
            onClick={() => setIsEditMode(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
          >
            <Edit className="h-4 w-4" />
            Edit Exercise
          </button>
        </div>
      )}

      {/* Admin Controls - show when pending OR in edit mode */}
      {isAdmin && (exercise.status === 'pending' || isEditMode) && (
        <div className="px-4 md:px-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
            <span className="text-sm text-white/60">Admin Actions:</span>

            {/* Approve - show for pending or rejected (not already approved) */}
            {exercise.status !== 'approved' && onStatusUpdate && (
              <button
                onClick={handleApprove}
                disabled={isUpdating || isSavingImage}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
            )}

            {/* Reject - show for pending or approved (not already rejected) */}
            {exercise.status !== 'rejected' && onStatusUpdate && (
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isUpdating || isSavingImage}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            )}

            {/* Save Image - always available */}
            {onSaveImageOnly && (
              <button
                onClick={openSaveImageModal}
                disabled={isUpdating || isSavingImage}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Image
              </button>
            )}

            {/* Regenerate - always available */}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isUpdating || isSavingImage}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </button>
            )}

            {/* Done Editing - only show when in edit mode (not for pending) */}
            {isEditMode && (
              <button
                onClick={() => setIsEditMode(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                Done Editing
              </button>
            )}
          </div>

          {/* Deep Dive Content Generation */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
            <span className="text-sm text-white/60">Deep Dive Content:</span>
            {exercise.deepDiveHtmlContent ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffbf00]/20 px-3 py-1 text-xs font-medium text-[#ffbf00]">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Generated
                </span>
                <a
                  href={`/exercises/${exercise.slug}/learn`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00]/20 px-4 py-2 text-sm font-medium text-[#ffbf00] transition-colors hover:bg-[#ffbf00]/30"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Page
                </a>
                {onGenerateDeepDive && (
                  <button
                    onClick={onGenerateDeepDive}
                    disabled={isGeneratingDeepDive}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00]/20 px-4 py-2 text-sm font-medium text-[#ffbf00] transition-colors hover:bg-[#ffbf00]/30 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isGeneratingDeepDive ? 'animate-spin' : ''}`}
                    />
                    Regenerate
                  </button>
                )}
                {/* Edit Page Button */}
                {onEditDeepDive && (
                  <button
                    onClick={onEditDeepDive}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00]/20 px-4 py-2 text-sm font-medium text-[#ffbf00] transition-colors hover:bg-[#ffbf00]/30"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Page
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="bg-white/10/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white/60">
                  Not Generated
                </span>
                {onGenerateDeepDive && (
                  <button
                    onClick={onGenerateDeepDive}
                    disabled={isGeneratingDeepDive}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
                  >
                    {isGeneratingDeepDive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Generate Deep Dive Page
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection reason display */}
      {exercise.status === 'rejected' && exercise.rejectionReason && (
        <div className="px-4 md:px-6">
          <div className="rounded-xl border border-red-900/50 bg-red-900/20 p-4">
            <h3 className="mb-1 text-sm font-bold text-red-400">Rejection Reason</h3>
            <p className="text-sm text-white/80">{exercise.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Exercise Video (show first visible video when present) */}
      {visibleVideos[0] && (
        <div className="px-4 md:px-6">
          <VideoPlayer videoUrl={visibleVideos[0].videoUrl} />
        </div>
      )}

      {/* Image Gallery Carousel */}
      <ExerciseImageCarousel
        exerciseId={exercise.id}
        videos={videosForCarousel}
        isAdmin={isAdmin}
        onAddImage={onAddImage}
        onAddVideo={onAddVideo}
        onGalleryChange={onGalleryChange}
      />

      {/* When user-friendly instructions exist (public view): show as main content, biomechanics in "Learn More" */}
      {hasUserInstructions && (
        <div className="px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="prose prose-invert prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80 prose-strong:text-white max-w-none rounded-xl border border-white/10 bg-black/40 p-5"
          >
            <ReactMarkdown>{exercise.userFriendlyInstructions!.trim()}</ReactMarkdown>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/40"
          >
            <button
              type="button"
              onClick={() => setLearnMoreOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-2 p-5 text-left font-bold text-white/90 transition-colors hover:bg-white/10"
            >
              <span>Learn more about the biomechanics</span>
              {learnMoreOpen ? (
                <ChevronDown className="h-5 w-5 text-white/60" />
              ) : (
                <ChevronRight className="h-5 w-5 text-white/60" />
              )}
            </button>
            {learnMoreOpen && (
              <div className="space-y-4 border-t border-white/10 px-5 pb-5 pt-2">
                {(biomechanics.performanceCues?.length ?? 0) > 0 && (
                  <div className="rounded-lg border-l-4 border-[#ffbf00] bg-black/30 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-base font-bold text-[#ffbf00]">
                      <Zap className="h-4 w-4" />
                      Performance Cues
                    </h4>
                    <ul className="space-y-2">
                      {normalizeListItems(biomechanics.performanceCues ?? []).map((cue, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-white/80">
                          <span className="font-mono text-[#ffbf00]/80">{idx + 1}.</span>
                          <span>{cue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(biomechanics.commonMistakes?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-red-900/30 bg-red-900/10 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-base font-bold text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      Common Mistakes
                    </h4>
                    <ul className="space-y-2">
                      {normalizeListItems(biomechanics.commonMistakes ?? []).map((mistake, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-white/80">
                          <span className="font-mono text-red-400/80">{idx + 1}.</span>
                          <span>{mistake}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(biomechanics.biomechanicalChain ||
                  biomechanics.pivotPoints ||
                  biomechanics.stabilizationNeeds) && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-base font-bold text-[#ffbf00]">
                      <Shield className="h-4 w-4" />
                      Biomechanical Analysis
                    </h4>
                    <div className="flex gap-2 border-b border-white/10 pb-3">
                      {[
                        { id: 'chain' as const, label: 'The Chain' },
                        { id: 'pivot' as const, label: 'Pivot Points' },
                        { id: 'stabilization' as const, label: 'Stabilization' },
                      ].map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveAnalysisTab(id)}
                          className={`rounded px-3 py-1.5 text-sm font-medium ${
                            activeAnalysisTab === id
                              ? 'bg-[#ffbf00]/20 text-[#ffbf00]'
                              : 'text-white/60 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 text-sm leading-relaxed text-white/60">
                      {activeAnalysisTab === 'chain' && (
                        <div
                          className="[&_p:last-child]:mb-0 [&_p]:mb-0"
                          dangerouslySetInnerHTML={{
                            __html: formatParagraphContent(biomechanics.biomechanicalChain ?? ''),
                          }}
                        />
                      )}
                      {activeAnalysisTab === 'pivot' && (
                        <div
                          className="[&_p:last-child]:mb-0 [&_p]:mb-0"
                          dangerouslySetInnerHTML={{
                            __html: formatParagraphContent(biomechanics.pivotPoints ?? ''),
                          }}
                        />
                      )}
                      {activeAnalysisTab === 'stabilization' && (
                        <div
                          className="[&_p:last-child]:mb-0 [&_p]:mb-0"
                          dangerouslySetInnerHTML={{
                            __html: formatParagraphContent(biomechanics.stabilizationNeeds ?? ''),
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* When no user instructions (or admin): show Performance Cues, Common Mistakes, Biomechanical Analysis as main content */}
      {!hasUserInstructions && (
        <>
          {/* 2. PERFORMANCE CUES - The "Do This" */}
          <div className="px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border-l-4 border-[#ffbf00] bg-black/40 p-5"
            >
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <Zap className="h-5 w-5 text-[#ffbf00]" />
                Performance Cues
              </h3>
              <ul className="space-y-4">
                {(() => {
                  const items = normalizeListItems(biomechanics.performanceCues ?? []);
                  return items.map((cue, idx) => (
                    <li key={idx} className="flex items-start gap-6 text-white/80">
                      <span className="font-mono text-lg font-bold text-[#ffbf00] opacity-80">
                        {(idx + 1).toString().padStart(items.length.toString().length, '0')}
                      </span>
                      <span>{cue}</span>
                    </li>
                  ));
                })()}
              </ul>
            </motion.div>
          </div>

          {/* 3. COMMON MISTAKES - The "Don't Do This" */}
          <div className="px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-red-900/50 bg-red-900/20 p-5"
            >
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Common Mistakes
              </h3>
              <ul className="space-y-4">
                {(() => {
                  const items = normalizeListItems(biomechanics.commonMistakes ?? []);
                  return items.map((mistake, idx) => (
                    <li key={idx} className="flex items-start gap-6 text-white/80">
                      <span className="font-mono text-lg font-bold text-red-400 opacity-80">
                        {(idx + 1).toString().padStart(items.length.toString().length, '0')}
                      </span>
                      <span>{mistake}</span>
                    </li>
                  ));
                })()}
              </ul>
            </motion.div>
          </div>

          {/* 4. BIOMECHANICAL ANALYSIS - Tabbed */}
          <div className="px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="overflow-hidden rounded-xl bg-black/40"
            >
              <div className="flex items-center justify-between gap-2 p-5 font-bold">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#ffbf00]" />
                  Biomechanical Analysis
                </div>
                {isAdmin && onAddAnatomicalImage && (
                  <button
                    type="button"
                    onClick={onAddAnatomicalImage}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-black/40 hover:text-white"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Add anatomical image
                  </button>
                )}
              </div>
              <div className="flex gap-2 border-t border-white/10 px-5 pb-2 pt-4">
                {[
                  { id: 'chain' as const, label: 'The Chain' },
                  { id: 'pivot' as const, label: 'Pivot Points' },
                  { id: 'stabilization' as const, label: 'Stabilization' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveAnalysisTab(id)}
                    className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                      activeAnalysisTab === id
                        ? 'bg-[#ffbf00]/20 text-[#ffbf00]'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/10 p-5">
                {activeAnalysisTab === 'chain' && (
                  <div className="flex gap-4">
                    {anatomicalImagesBySection.chain && (
                      <div className="w-48 flex-shrink-0 md:w-56">
                        <img
                          src={anatomicalImagesBySection.chain.imageUrl}
                          alt="The Chain"
                          className="w-full rounded-lg border border-white/10 object-contain"
                        />
                      </div>
                    )}
                    <div
                      className="min-w-0 flex-1 text-sm leading-relaxed text-white/60 [&_p:last-child]:mb-0 [&_p]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: formatParagraphContent(biomechanics.biomechanicalChain ?? ''),
                      }}
                    />
                  </div>
                )}
                {activeAnalysisTab === 'pivot' && (
                  <div className="flex gap-4">
                    {anatomicalImagesBySection.pivot && (
                      <div className="w-48 flex-shrink-0 md:w-56">
                        <img
                          src={anatomicalImagesBySection.pivot.imageUrl}
                          alt="Pivot Points"
                          className="w-full rounded-lg border border-white/10 object-contain"
                        />
                      </div>
                    )}
                    <div
                      className="min-w-0 flex-1 text-sm leading-relaxed text-white/60 [&_p:last-child]:mb-0 [&_p]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: formatParagraphContent(biomechanics.pivotPoints ?? ''),
                      }}
                    />
                  </div>
                )}
                {activeAnalysisTab === 'stabilization' && (
                  <div className="flex gap-4">
                    {anatomicalImagesBySection.stabilization && (
                      <div className="w-48 flex-shrink-0 md:w-56">
                        <img
                          src={anatomicalImagesBySection.stabilization.imageUrl}
                          alt="Stabilization"
                          className="w-full rounded-lg border border-white/10 object-contain"
                        />
                      </div>
                    )}
                    <div
                      className="min-w-0 flex-1 text-sm leading-relaxed text-white/60 [&_p:last-child]:mb-0 [&_p]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: formatParagraphContent(biomechanics.stabilizationNeeds ?? ''),
                      }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* 5. SOURCES FOOTER - Credibility (excludes Vertex AI Search placeholders) */}
      {(() => {
        const displaySources = filterRealSources(sources ?? []);
        return displaySources.length > 0 ? (
          <div className="mt-4 px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                Sources
              </h4>
              <div className="flex flex-wrap gap-2">
                {displaySources.map((source, idx) => (
                  <a
                    key={idx}
                    href={`https://google.com/search?q=${encodeURIComponent(source.searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-black/40 hover:text-white"
                  >
                    {source.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </motion.div>
          </div>
        ) : null;
      })()}

      {/* Metadata footer */}
      <div className="mt-8 px-4 md:px-6">
        <div className="flex flex-wrap gap-4 text-xs text-white/40">
          <span>Complexity: {exercise.complexityLevel}</span>
          <span>Style: {exercise.visualStyle}</span>
        </div>
        {/* Admin: preserved image prompt */}
        {isAdmin && exercise.imagePrompt && (
          <details className="mt-4 cursor-pointer">
            <summary className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Image Prompt (preserved)
            </summary>
            <p className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/60">
              {exercise.imagePrompt}
            </p>
          </details>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-6">
            <h3 className="mb-4 text-lg font-bold">Reject Exercise</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="w-full resize-none rounded-lg border border-white/10 bg-[#0d0500] p-3 text-white placeholder-white/40 focus:border-transparent focus:ring-2 focus:ring-red-500"
              rows={4}
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 rounded-lg bg-black/40 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isUpdating || !rejectReason.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Image Only Modal */}
      {showSaveImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-6">
            <h3 className="mb-2 text-lg font-bold">Save Image Only</h3>
            <p className="mb-4 text-sm text-white/60">
              Save this image to the exercise library with a different name. The image will be
              approved and available for mapping to exercises.
            </p>
            <label className="mb-2 block text-sm font-medium text-white/80">Exercise Name</label>
            <input
              type="text"
              value={saveImageName}
              onChange={(e) => setSaveImageName(e.target.value)}
              placeholder="Enter the correct exercise name..."
              className="w-full rounded-lg border border-white/10 bg-[#0d0500] p-3 text-white placeholder-white/40 focus:border-transparent focus:ring-2 focus:ring-[#ffbf00]"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowSaveImageModal(false)}
                className="flex-1 rounded-lg bg-black/40 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveImageOnly}
                disabled={isSavingImage || !saveImageName.trim()}
                className="flex-1 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
              >
                {isSavingImage ? 'Saving...' : 'Save Image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneratedExerciseDetail;
