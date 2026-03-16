/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Exercise Prescription Engine: same configuration as Programs — Vitals sidebar
 * and filterable/scored exercise list for the public /exercises page.
 */

import React, { useState, useMemo } from 'react';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import type { SerializedGeneratedExercise } from '@/lib/supabase/public/generated-exercise-service';
import GridCard, { DEFAULT_PROGRAM_IMAGE } from '@/components/react/GridCard';
import { INJURY_RULES } from '@/lib/matching-logic';
import { deriveExerciseInjuryTags } from '@/lib/exercise-injury-tags';
import {
  deriveExerciseModifierTags,
  CONDITION_TO_MODIFIER_TAGS,
  CONDITION_TO_INJURY_IDS,
  INTENSITY_MODIFIER_CONDITION_IDS,
} from '@/lib/exercise-modifier-tags';
import { deriveExerciseGoalTags, GOAL_TO_TAGS, GOAL_MATCH_BONUS } from '@/lib/exercise-goal-tags';
import Drawer from '@/components/react/Drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import PrescriptionVitalsSidebar, { type ExperienceLevel } from './PrescriptionVitalsSidebar';

const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

function experienceMatchScore(
  exerciseLevel: string,
  userLevel: Exclude<ExperienceLevel, 'any'>
): number {
  const exIdx = EXPERIENCE_LEVELS.indexOf(exerciseLevel as (typeof EXPERIENCE_LEVELS)[number]);
  const userIdx = EXPERIENCE_LEVELS.indexOf(userLevel);
  const ex = exIdx >= 0 ? exIdx : 1;
  const diff = Math.abs(ex - userIdx);
  if (diff === 0) return 100;
  if (diff === 1) return 80;
  return 50;
}

/** Exact match: true when the user's selected injuries include the rule's injury id. */
function userHasInjury(selectedInjuries: string[], ruleInjury: string): boolean {
  return selectedInjuries.includes(ruleInjury);
}

/** Gold at 100% match, dark red at 0%. */
function matchScoreToColor(score: number): string {
  if (score >= 100) return '#ffbf00';
  if (score <= 0) return '#7f1d1d';
  const t = score / 100;
  const r = Math.round(127 + (255 - 127) * t);
  const g = Math.round(29 + (191 - 29) * t);
  const b = Math.round(29 + (0 - 29) * t);
  return `rgb(${r},${g},${b})`;
}

function MatchRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const stroke = 4;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = matchScoreToColor(score);
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute font-mono text-xs font-bold text-white">{score}%</span>
    </div>
  );
}

export interface ExercisePrescriptionEngineProps {
  availableExercises: SerializedGeneratedExercise[];
  zones?: { id: string; name: string }[];
  /** If true, links to the Learning Center deep dive (/learn/[slug]) instead of the standard detail page */
  linkToDeepDive?: boolean;
  /** CTA label when linkToDeepDive is true (e.g. "Science & Mastery"). Used for all deep-dive links. */
  ctaLabelWhenDeepDive?: string;
  /** Optional override for the header title (e.g. "Science & Mastery" on Learn index). */
  headerTitle?: string;
  /** Optional override for the header subtitle. */
  headerSubtitle?: string;
}

const DEFAULT_EXPERIENCE: ExperienceLevel = 'intermediate';

const DEFAULT_CTA_DEEP_DIVE = 'Science & Mastery';

const DEFAULT_HEADER_TITLE = 'Exercise Prescription Engine';
const DEFAULT_HEADER_SUBTITLE = 'Tune your vitals — we rank exercises in real time';

const ExercisePrescriptionEngine: React.FC<ExercisePrescriptionEngineProps> = ({
  availableExercises = [],
  zones = [],
  linkToDeepDive = false,
  ctaLabelWhenDeepDive = DEFAULT_CTA_DEEP_DIVE,
  headerTitle = DEFAULT_HEADER_TITLE,
  headerSubtitle = DEFAULT_HEADER_SUBTITLE,
}) => {
  const deepDiveCtaLabel = linkToDeepDive ? ctaLabelWhenDeepDive : null;
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel>(DEFAULT_EXPERIENCE);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedMainWorkoutType, setSelectedMainWorkoutType] = useState<string>('');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const filteredAndScored = useMemo(() => {
    // Hierarchy: (1) Injuries hide, (2) Conditions hide, (3) Goals only rank the remainder.
    const effectiveInjuries = [
      ...injuries.map((i) => i.toLowerCase().trim()),
      ...conditions.flatMap((c) => CONDITION_TO_INJURY_IDS[c] ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);
    const exercises = Array.isArray(availableExercises) ? availableExercises : [];
    return exercises
      .map((ex) => {
        const experienceScore =
          selectedExperience === 'any'
            ? 50
            : experienceMatchScore(
                ex.complexityLevel ?? 'intermediate',
                selectedExperience as Exclude<ExperienceLevel, 'any'>
              );
        const injuryTags = deriveExerciseInjuryTags(ex.biomechanics);
        const modifierTags = deriveExerciseModifierTags(ex.biomechanics);
        const goalTags = deriveExerciseGoalTags(ex.biomechanics);
        let score = experienceScore;
        for (const rule of INJURY_RULES) {
          const hasTag = injuryTags.some((t) => t === rule.tag);
          const hasInjury = userHasInjury(effectiveInjuries, rule.injury);
          if (hasTag && hasInjury) score -= rule.penalty;
        }
        for (const goalId of goals) {
          const boostTags = GOAL_TO_TAGS[goalId] ?? [];
          if (boostTags.some((t) => goalTags.includes(t))) score += GOAL_MATCH_BONUS;
        }
        const matchScore = Math.max(0, Math.min(100, Math.round(score)));
        return { ...ex, matchScore, injuryTags, modifierTags };
      })
      .filter((ex) => {
        // Hide: drop exercises that directly load a selected injury area (or condition-mapped injury).
        if (effectiveInjuries.length > 0) {
          const tags = (ex as { injuryTags?: string[] }).injuryTags ?? [];
          const hasConflict = tags.some((tag) =>
            INJURY_RULES.some((r) => r.tag === tag && userHasInjury(effectiveInjuries, r.injury))
          );
          if (hasConflict) return false;
        }
        // Hide: drop exercises that have modifier tags excluded by selected Intensity Modifier conditions.
        const exModifierTags = (ex as { modifierTags?: string[] }).modifierTags ?? [];
        for (const conditionId of conditions) {
          if (!INTENSITY_MODIFIER_CONDITION_IDS.has(conditionId)) continue;
          const excludeTags = CONDITION_TO_MODIFIER_TAGS[conditionId] ?? [];
          if (excludeTags.some((t) => exModifierTags.includes(t))) return false;
        }
        // Zone filter
        if (selectedZone) {
          const zoneId = (ex as SerializedGeneratedExercise & { zoneId?: string }).zoneId;
          if (zoneId != null && zoneId !== selectedZone) return false;
        }
        // Block filter: when selected, only include exercises with that block in suitableBlocks.
        if (selectedBlock) {
          const blocks = (ex as SerializedGeneratedExercise & { suitableBlocks?: string[] })
            .suitableBlocks;
          if (!blocks?.length || !blocks.includes(selectedBlock)) return false;
          if (
            selectedBlock === 'main' &&
            selectedMainWorkoutType &&
            (ex as SerializedGeneratedExercise & { mainWorkoutType?: string }).mainWorkoutType !==
              selectedMainWorkoutType
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) =>
        selectedExperience === 'any'
          ? (a.exerciseName ?? '').localeCompare(b.exerciseName ?? '', undefined, {
              sensitivity: 'base',
            })
          : b.matchScore - a.matchScore
      );
  }, [
    availableExercises,
    selectedExperience,
    selectedZone,
    selectedBlock,
    selectedMainWorkoutType,
    injuries,
    conditions,
    goals,
  ]);

  const isAnyExperience = selectedExperience === 'any';
  const topMatch = isAnyExperience ? null : (filteredAndScored[0] ?? null);
  const alternatives = isAnyExperience ? filteredAndScored : filteredAndScored.slice(1);
  const lowMatchThreshold = 30;

  const toggleInjury = (id: string) => {
    setInjuries((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };
  const toggleCondition = (id: string) => {
    setConditions((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };
  const toggleGoal = (id: string) => {
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 font-heading text-3xl font-bold text-white md:text-4xl">
            {headerTitle}
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ffbf00]">
            {headerSubtitle}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[#ffbf00]/50 bg-[#ffbf00]/20 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#ffbf00] transition-all hover:bg-[#ffbf00]/30"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          )}
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
          >
            Terminate Session
          </a>
        </div>
      </div>

      {!isDesktop && (
        <Drawer isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Your Vitals">
          <PrescriptionVitalsSidebar
            zones={zones}
            selectedZone={selectedZone}
            onZoneChange={setSelectedZone}
            selectedExperience={selectedExperience}
            onExperienceChange={setSelectedExperience}
            selectedBlock={selectedBlock}
            onBlockChange={setSelectedBlock}
            selectedMainWorkoutType={selectedMainWorkoutType}
            onMainWorkoutTypeChange={setSelectedMainWorkoutType}
            injuries={injuries}
            onToggleInjury={toggleInjury}
            goals={goals}
            onToggleGoal={toggleGoal}
            conditions={conditions}
            onToggleCondition={toggleCondition}
            disclaimerAcknowledged={disclaimerAcknowledged}
            onDisclaimerAcknowledge={() => setDisclaimerAcknowledged(true)}
          />
        </Drawer>
      )}

      <div className={isDesktop ? 'grid gap-10 lg:grid-cols-[320px_1fr]' : ''}>
        {isDesktop && (
          <PrescriptionVitalsSidebar
            zones={zones}
            selectedZone={selectedZone}
            onZoneChange={setSelectedZone}
            selectedExperience={selectedExperience}
            onExperienceChange={setSelectedExperience}
            selectedBlock={selectedBlock}
            onBlockChange={setSelectedBlock}
            selectedMainWorkoutType={selectedMainWorkoutType}
            onMainWorkoutTypeChange={setSelectedMainWorkoutType}
            injuries={injuries}
            onToggleInjury={toggleInjury}
            goals={goals}
            onToggleGoal={toggleGoal}
            conditions={conditions}
            onToggleCondition={toggleCondition}
            disclaimerAcknowledged={disclaimerAcknowledged}
            onDisclaimerAcknowledge={() => setDisclaimerAcknowledged(true)}
          />
        )}

        {/* Right: Exercise cards */}
        <div className="min-w-0 space-y-6">
          {filteredAndScored.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              {injuries.length > 0 || conditions.length > 0 ? (
                <p className="text-white/60">
                  No exercises shown for your selected injuries or conditions. Clear one or more
                  filters to see suggestions.
                </p>
              ) : (
                <p className="text-white/60">No exercises available. Publish exercises in admin.</p>
              )}
            </div>
          ) : isAnyExperience ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {alternatives.map((exercise) => (
                <article
                  key={exercise.id}
                  className="flex flex-col rounded-3xl border border-white/10 bg-black/20 p-[2px] shadow-2xl backdrop-blur-sm transition hover:border-[#ffbf00]/30 hover:bg-black/30"
                >
                  <GridCard
                    headerImage={exercise.imageUrl || DEFAULT_PROGRAM_IMAGE}
                    headerImageAlt={exercise.exerciseName}
                    headerContent={
                      <>
                        <div className="min-w-0 flex-1">
                          <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">
                            {exercise.exerciseName}
                          </h2>
                        </div>
                        <MatchRing score={exercise.matchScore} size={48} />
                      </>
                    }
                  />
                  <div className="flex flex-wrap items-center gap-2 p-4">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                      {(exercise.complexityLevel ?? 'intermediate').charAt(0).toUpperCase() +
                        (exercise.complexityLevel ?? 'intermediate').slice(1)}
                    </span>
                    <a
                      href={
                        linkToDeepDive ? `/learn/${exercise.slug}` : `/exercises/${exercise.slug}`
                      }
                      className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-[#ffbf00]/90"
                    >
                      {linkToDeepDive ? deepDiveCtaLabel : 'View'}
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <>
              {topMatch && (
                <div className="rounded-xl border border-[#ffbf00]/30 bg-black/20 p-4">
                  <article className="flex flex-col rounded-3xl border border-[#ffbf00]/40 bg-[#ffbf00]/10 p-[2px] shadow-2xl backdrop-blur-sm">
                    <GridCard
                      headerImage={topMatch.imageUrl || DEFAULT_PROGRAM_IMAGE}
                      headerImageAlt={topMatch.exerciseName}
                      className="border-[#ffbf00]/40"
                      headerContent={
                        <>
                          <div className="min-w-0 flex-1">
                            <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">
                              {topMatch.exerciseName}
                            </h2>
                            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[#ffbf00]">
                              Top match for your vitals
                            </p>
                          </div>
                          <MatchRing score={topMatch.matchScore} size={52} />
                        </>
                      }
                    />
                    <div className="flex flex-wrap items-center gap-2 p-4">
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                        {(topMatch.complexityLevel ?? 'intermediate').charAt(0).toUpperCase() +
                          (topMatch.complexityLevel ?? 'intermediate').slice(1)}
                      </span>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                        {topMatch.kineticChainType}
                      </span>
                      <a
                        href={
                          linkToDeepDive ? `/learn/${topMatch.slug}` : `/exercises/${topMatch.slug}`
                        }
                        className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-[#ffbf00]/90"
                      >
                        {linkToDeepDive ? deepDiveCtaLabel : 'View Exercise'}
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    </div>
                  </article>
                </div>
              )}
              <div>
                <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-white/80">
                  Alternatives
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {alternatives
                    .filter((ex) => ex.matchScore >= lowMatchThreshold)
                    .map((exercise) => (
                      <article
                        key={exercise.id}
                        className={`flex flex-col rounded-3xl border p-[2px] shadow-2xl backdrop-blur-sm transition ${
                          exercise.matchScore >= 50
                            ? 'border-white/10 bg-black/20 hover:border-[#ffbf00]/30 hover:bg-black/30'
                            : 'border-white/5 bg-black/10 opacity-75'
                        } ${exercise.matchScore < 30 ? 'grayscale' : ''}`}
                      >
                        <GridCard
                          headerImage={exercise.imageUrl || DEFAULT_PROGRAM_IMAGE}
                          headerImageAlt={exercise.exerciseName}
                          headerContent={
                            <>
                              <div className="min-w-0 flex-1">
                                <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">
                                  {exercise.exerciseName}
                                </h2>
                              </div>
                              <MatchRing score={exercise.matchScore} size={48} />
                            </>
                          }
                        />
                        <div className="flex flex-wrap items-center gap-2 p-4">
                          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                            {(exercise.complexityLevel ?? 'intermediate').charAt(0).toUpperCase() +
                              (exercise.complexityLevel ?? 'intermediate').slice(1)}
                          </span>
                          <a
                            href={
                              linkToDeepDive
                                ? `/learn/${exercise.slug}`
                                : `/exercises/${exercise.slug}`
                            }
                            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-[#ffbf00]/90"
                          >
                            {linkToDeepDive ? deepDiveCtaLabel : 'View'}
                            <ChevronRight className="h-4 w-4" />
                          </a>
                        </div>
                      </article>
                    ))}
                </div>
              </div>
              {alternatives.some((ex) => ex.matchScore < lowMatchThreshold) && (
                <div>
                  <h2 className="mb-3 font-heading text-xs font-bold uppercase tracking-wider text-white/50">
                    Lower match
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {alternatives
                      .filter((ex) => ex.matchScore < lowMatchThreshold)
                      .map((exercise) => (
                        <article
                          key={exercise.id}
                          className="flex flex-col rounded-3xl border border-white/5 bg-black/10 p-[2px] opacity-75 grayscale backdrop-blur-sm"
                        >
                          <GridCard
                            headerImage={exercise.imageUrl || DEFAULT_PROGRAM_IMAGE}
                            headerImageAlt={exercise.exerciseName}
                            headerContent={
                              <>
                                <div className="min-w-0 flex-1">
                                  <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">
                                    {exercise.exerciseName}
                                  </h2>
                                </div>
                                <MatchRing score={exercise.matchScore} size={48} />
                              </>
                            }
                          />
                          <div className="flex flex-wrap items-center gap-2 p-4">
                            <a
                              href={
                                linkToDeepDive
                                  ? `/learn/${exercise.slug}`
                                  : `/exercises/${exercise.slug}`
                              }
                              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-[#ffbf00]/90"
                            >
                              {linkToDeepDive ? deepDiveCtaLabel : 'View'}
                              <ChevronRight className="h-4 w-4" />
                            </a>
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExercisePrescriptionEngine;
