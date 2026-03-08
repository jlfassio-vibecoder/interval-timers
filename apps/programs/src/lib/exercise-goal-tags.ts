/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Derives goal-relevant tags from exercise biomechanics (and optional deep dive text)
 * for Fitness Goals "Green Light" prioritization in the Exercise Prescription Engine.
 */

import type { ParsedBiomechanics } from '@/types/generated-exercise';

/**
 * Keyword groups that map to goal tags. Used to boost score when user selects a goal
 * so goal-aligned exercises rank higher (after injury and condition filters).
 */
export const EXERCISE_GOAL_KEYWORDS: { tag: string; keywords: string[] }[] = [
  {
    tag: 'metabolic',
    keywords: ['metabolic', 'circuit', 'high rep', 'short rest', 'conditioning', 'burn', 'fat'],
  },
  {
    tag: 'hypertrophy',
    keywords: ['hypertrophy', 'volume', '8-12 rep', 'split', 'pump', 'muscle building'],
  },
  { tag: 'tone', keywords: ['full body', 'moderate weight', 'high rep', 'definition', 'toning'] },
  {
    tag: 'strength',
    keywords: ['strength', 'low rep', '1rm', 'compound', 'squat', 'deadlift', 'press', 'heavy'],
  },
  {
    tag: 'endurance',
    keywords: [
      'endurance',
      'aerobic',
      'amrap',
      'liss',
      'steady state',
      'calisthenics',
      'sustained',
    ],
  },
  {
    tag: 'power',
    keywords: [
      'power',
      'explosive',
      'plyometric',
      'box jump',
      'clean',
      'snatch',
      'speed',
      'ballistic',
    ],
  },
  {
    tag: 'general-health',
    keywords: ['balanced', 'wellness', 'moderate intensity', 'consistency', 'maintenance'],
  },
  {
    tag: 'mobility',
    keywords: [
      'mobility',
      'flexibility',
      'rom',
      'range of motion',
      'yoga',
      'stretch',
      'warm-up',
      'cool-down',
    ],
  },
  {
    tag: 'core-stability',
    keywords: [
      'core',
      'stability',
      'posture',
      'anti-rotation',
      'glute',
      'scapular',
      'lower back',
      'activation',
    ],
  },
];

/**
 * Which goal tags to boost when the user selects a goal. Exercises with matching
 * tags get a score bonus so they rank higher (Goals = Green Light, rank remainder only).
 */
export const GOAL_TO_TAGS: Record<string, string[]> = {
  'lose-weight': ['metabolic'],
  'build-muscle': ['hypertrophy'],
  'tone-definition': ['tone', 'metabolic', 'hypertrophy'],
  'increase-strength': ['strength'],
  'improve-endurance': ['endurance'],
  'athleticism-power': ['power'],
  'general-health': ['general-health'],
  'mobility-flexibility': ['mobility'],
  'core-stability-posture': ['core-stability'],
};

const GOAL_BONUS = 12;

function buildCombinedText(
  biomechanics: ParsedBiomechanics | null | undefined,
  plainTextFromDeepDive?: string
): string {
  const bio = biomechanics;
  const chain = bio?.biomechanicalChain ?? '';
  const pivot = bio?.pivotPoints ?? '';
  const stab = bio?.stabilizationNeeds ?? '';
  const mistakes = Array.isArray(bio?.commonMistakes)
    ? (bio.commonMistakes as string[]).join(' ')
    : '';
  const cues = Array.isArray(bio?.performanceCues)
    ? (bio.performanceCues as string[]).join(' ')
    : '';
  const deep = plainTextFromDeepDive ?? '';
  const combined = [chain, pivot, stab, mistakes, cues, deep].filter(Boolean).join(' ');
  return combined.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Returns goal tags present in the combined text (biomechanics + optional deep dive).
 * Used to boost match score when user selects a goal (Green Light: rank remainder).
 */
export function deriveExerciseGoalTags(
  biomechanics: ParsedBiomechanics | null | undefined,
  plainTextFromDeepDive?: string
): string[] {
  const text = buildCombinedText(biomechanics, plainTextFromDeepDive);
  if (!text) return [];

  const tags: string[] = [];
  for (const { tag, keywords } of EXERCISE_GOAL_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * Goal bonus applied when an exercise's goal tags match a selected goal.
 * Exported for use in ExercisePrescriptionEngine.
 */
export const GOAL_MATCH_BONUS = GOAL_BONUS;
