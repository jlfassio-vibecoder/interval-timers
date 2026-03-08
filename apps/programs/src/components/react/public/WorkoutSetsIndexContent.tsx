/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workout sets index: filter by difficulty + grid of set cards; set-detail with session list; session → selectWorkout.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ChevronRight } from 'lucide-react';
import ArtistCard from '@/components/react/ArtistCard';
import FormattedMarkdown from '@/components/react/FormattedMarkdown';
import LevelFilter, { type LevelFilterValue } from '@/components/react/LevelFilter';
import type { Artist } from '@/types';
import type { WorkoutInSet } from '@/types/ai-workout';
import { mapWorkoutInSetToArtist } from '@/lib/map-workout-in-set-to-artist';
import { LANDING_DESCRIPTION_CLASS } from '@/components/react/public/landing-description-styles';

const DEFAULT_IMAGE = '/images/gym-barbell-squat-001.jpg';

const OVERVIEW_TRUNCATE_LENGTH = 500;

/** Props passed from SSR; matches SerializedWorkoutSet from workout-service */
export interface PublishedWorkoutSet {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  workoutCount: number;
  workouts: WorkoutInSet[];
}

function difficultyToIntensity(d: string): number {
  switch (d) {
    case 'beginner':
      return 1;
    case 'advanced':
      return 5;
    default:
      return 3;
  }
}

export interface WorkoutSetsIndexContentProps {
  publishedSets: PublishedWorkoutSet[];
}

function filterByDifficulty(
  sets: PublishedWorkoutSet[],
  level: LevelFilterValue
): PublishedWorkoutSet[] {
  if (level === 'all') return sets;
  return sets.filter((s) => s.difficulty === level);
}

/**
 * Parse set description into intro paragraphs and optional labeled sections (e.g. "Coach's Insight:", "The Pace:").
 * Preserves all content; improves scannability when structure is present.
 */
function parseSetDescription(description: string): {
  introParagraphs: string[];
  sections: { label: string; paragraphs: string[] }[];
} {
  const trimmed = description.trim();
  if (!trimmed) return { introParagraphs: [], sections: [] };

  // Normalize typographic apostrophes (U+2019) to straight quotes so "Coach's Insight:" matches in edited copy.
  const normalized = trimmed.replace(/\u2019/g, "'");
  const subheadingPattern = /(Coach'?s? Insight:|The Pace:)/i;
  const parts = normalized.split(subheadingPattern);
  if (parts.length < 2) {
    const introParagraphs = normalized
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return { introParagraphs, sections: [] };
  }
  const introParagraphs = parts[0]
    .trim()
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sections: { label: string; paragraphs: string[] }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i].trim();
    const body = (parts[i + 1] ?? '').trim();
    const paragraphs = body
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (label) sections.push({ label, paragraphs });
  }
  return { introParagraphs, sections };
}

/** Map a set to a display Artist for ArtistCard (no workoutDetail; card only). */
function setToDisplayArtist(set: PublishedWorkoutSet): Artist {
  const sessionLabel = set.workoutCount === 1 ? '1 session' : `${set.workoutCount} sessions`;
  return {
    id: set.id,
    name: set.title,
    genre: sessionLabel,
    image: DEFAULT_IMAGE,
    day: '',
    description: '',
    intensity: difficultyToIntensity(set.difficulty),
  };
}

const WorkoutSetsIndexContent: React.FC<WorkoutSetsIndexContentProps> = ({ publishedSets }) => {
  const [selectedLevel, setSelectedLevel] = useState<LevelFilterValue>('all');
  const [selectedSet, setSelectedSet] = useState<PublishedWorkoutSet | null>(null);
  const [showFullOverviewModal, setShowFullOverviewModal] = useState(false);

  const isOverviewLong = (selectedSet?.description?.length ?? 0) > OVERVIEW_TRUNCATE_LENGTH;

  const filtered = useMemo(
    () => filterByDifficulty(publishedSets, selectedLevel),
    [publishedSets, selectedLevel]
  );

  const parsedDescription = useMemo(() => {
    if (!selectedSet?.description) {
      return {
        introParagraphs: [] as string[],
        sections: [] as { label: string; paragraphs: string[] }[],
      };
    }
    return parseSetDescription(selectedSet.description);
  }, [selectedSet?.description]);

  const handleOpenSession = (set: PublishedWorkoutSet, sessionIndex: number) => {
    const workout = set.workouts[sessionIndex];
    if (!workout) return;
    const artist = mapWorkoutInSetToArtist(workout, {
      setId: set.id,
      sessionIndex,
      intensity: difficultyToIntensity(set.difficulty),
      id: `workout-set-${set.id}-session-${sessionIndex}`,
      image: DEFAULT_IMAGE,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('selectWorkout', {
          detail: { artist, rawWorkout: workout },
          bubbles: true,
          cancelable: true,
        })
      );
    }
    setSelectedSet(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:mb-10 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 font-heading text-4xl font-bold leading-tight md:text-5xl">
            Workouts
          </h1>
          <p className="max-w-3xl text-lg font-light leading-relaxed text-gray-200 md:text-xl">
            Scientifically designed workout sets: single sessions, splits, or two-a-days. Choose a
            set, pick a session, and assign to clients.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
          >
            Terminate Session
          </a>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6 rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white/90">
            Filter
          </h2>
          <LevelFilter selectedLevel={selectedLevel} onLevelChange={setSelectedLevel} />
        </aside>

        <div className="min-w-0">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">No workouts at this level.</p>
            </div>
          ) : (
            <div className="relative z-10 grid grid-cols-1 border-l border-t border-white/10 bg-black/20 backdrop-blur-sm md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((set) => (
                <article
                  key={set.id}
                  className="flex flex-col border-b border-r border-white/10 bg-black/20"
                >
                  {/* Card and button both open the set: card = large hit area, button = explicit "View sessions" CTA. ArtistCard has role=button, tabIndex=0, onKeyDown. */}
                  <ArtistCard
                    artist={setToDisplayArtist(set)}
                    onClick={() => setSelectedSet(set)}
                  />
                  <div className="flex flex-1 items-end p-4">
                    <button
                      type="button"
                      onClick={() => setSelectedSet(set)}
                      className="hover:bg-orange-light/90 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-orange-light px-4 py-3 text-sm font-bold uppercase tracking-wider text-black transition"
                    >
                      View sessions
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Set-detail modal: list of sessions (styled to match WorkoutDetailModal) */}
      <AnimatePresence>
        {selectedSet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelectedSet(null);
              setShowFullOverviewModal(false);
            }}
            className="fixed inset-0 z-50 cursor-auto overflow-y-auto bg-black/95 backdrop-blur-3xl"
          >
            <div className="flex min-h-full items-start justify-center pb-10 pt-20 md:pb-10 md:pt-20 lg:items-center">
              <motion.div
                initial={{ scale: 0.9, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 40 }}
                onClick={(e) => e.stopPropagation()}
                className="relative mx-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-[3rem] border border-white/10 bg-bg-dark shadow-[0_50px_100px_rgba(0,0,0,0.8)] md:my-0"
              >
                {/* Hero strip */}
                <div className="relative h-64 w-full shrink-0 md:h-80">
                  <img
                    src={DEFAULT_IMAGE}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover opacity-40 grayscale"
                  />
                  <div className="via-bg-dark/40 absolute inset-0 bg-gradient-to-t from-bg-dark to-transparent" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSet(null);
                      setShowFullOverviewModal(false);
                    }}
                    className="absolute right-10 top-10 z-20 rounded-full border border-white/10 bg-black/50 p-5 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black"
                    aria-label="Close"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-12">
                    <h2 className="font-heading text-3xl font-black uppercase leading-tight tracking-tighter text-white drop-shadow-2xl md:text-4xl">
                      {selectedSet.title}
                    </h2>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
                      {selectedSet.workoutCount} session
                      {selectedSet.workoutCount !== 1 ? 's' : ''} ·{' '}
                      <span className="capitalize">{selectedSet.difficulty}</span>
                    </p>
                  </div>
                </div>
                {/* Two-column content: Overview | Sessions */}
                <div className="grid grid-cols-1 gap-12 p-8 md:p-10 lg:grid-cols-12 lg:gap-16 lg:p-12 lg:px-16">
                  {/* Left: Overview */}
                  <div className="space-y-8 lg:col-span-5">
                    {selectedSet.description ? (
                      <section className="max-w-prose">
                        <h4 className="border-orange-light/20 mb-6 border-b pb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
                          Overview
                        </h4>
                        {isOverviewLong ? (
                          <>
                            <FormattedMarkdown
                              content={
                                selectedSet.description.slice(0, OVERVIEW_TRUNCATE_LENGTH).trim() +
                                '…'
                              }
                              className={`${LANDING_DESCRIPTION_CLASS} text-xl font-light italic leading-relaxed text-gray-300`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowFullOverviewModal(true)}
                              className="border-orange-light/50 bg-orange-light/10 hover:bg-orange-light/20 mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-orange-light transition-colors"
                            >
                              Full Overview
                            </button>
                          </>
                        ) : (
                          <div className="space-y-4">
                            {parsedDescription.introParagraphs.map((para, i) => (
                              <FormattedMarkdown
                                key={`intro-${i}`}
                                content={para}
                                className={`${LANDING_DESCRIPTION_CLASS} text-xl font-light italic leading-relaxed text-gray-300`}
                              />
                            ))}
                            {parsedDescription.sections.map((sec, i) => (
                              <div key={`sec-${i}`} className="space-y-3">
                                <p className="text-orange-light/90 font-mono text-[10px] font-bold uppercase tracking-[0.3em]">
                                  {sec.label}
                                </p>
                                {sec.paragraphs.map((para, j) => (
                                  <FormattedMarkdown
                                    key={`sec-${i}-${j}`}
                                    content={para}
                                    className={`${LANDING_DESCRIPTION_CLASS} text-xl font-light italic leading-relaxed text-gray-300`}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    ) : null}
                  </div>
                  {/* Right: Sessions */}
                  <div className="space-y-6 lg:col-span-7">
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
                      Sessions
                    </h4>
                    <ul className="space-y-2">
                      {selectedSet.workouts.map((session, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white">{session.title}</p>
                            {session.description && (
                              <p className="mt-0.5 line-clamp-1 text-sm text-white/60">
                                {session.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenSession(selectedSet, idx)}
                            className="hover:bg-orange-light/90 flex shrink-0 items-center gap-2 rounded-lg bg-orange-light px-3 py-2 text-sm font-medium text-black transition-colors"
                          >
                            View <Play className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Overview modal */}
      <AnimatePresence>
        {showFullOverviewModal && selectedSet?.description && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullOverviewModal(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            aria-modal="true"
            role="dialog"
            aria-labelledby="full-overview-title"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[3rem] border border-white/10 bg-bg-dark shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4 md:px-8">
                <h2
                  id="full-overview-title"
                  className="font-heading text-lg font-bold uppercase tracking-tight text-white md:text-xl"
                >
                  Full Overview
                </h2>
                <button
                  type="button"
                  onClick={() => setShowFullOverviewModal(false)}
                  className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-6 md:p-8">
                {parsedDescription.introParagraphs.map((para, i) => (
                  <FormattedMarkdown
                    key={`modal-intro-${i}`}
                    content={para}
                    className={`${LANDING_DESCRIPTION_CLASS} text-xl font-light italic leading-relaxed text-gray-300`}
                  />
                ))}
                {parsedDescription.sections.map((sec, i) => (
                  <div key={`modal-sec-${i}`} className="space-y-3">
                    <p className="text-orange-light/90 font-mono text-[10px] font-bold uppercase tracking-[0.3em]">
                      {sec.label}
                    </p>
                    {sec.paragraphs.map((para, j) => (
                      <FormattedMarkdown
                        key={`modal-sec-${i}-${j}`}
                        content={para}
                        className={`${LANDING_DESCRIPTION_CLASS} text-xl font-light italic leading-relaxed text-gray-300`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkoutSetsIndexContent;
