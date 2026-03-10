/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Derives intensity/modifier tags from exercise biomechanics (and optional deep dive text)
 * for Medical Conditions "Intensity Modifiers" (systemic health) filtering.
 */

import type { ParsedBiomechanics } from '@/types/generated-exercise';

/**
 * Keyword groups that map to modifier tags. Used to filter out exercises when
 * user selects systemic conditions (High Blood Pressure, Heart Condition, etc.).
 */
export const EXERCISE_MODIFIER_KEYWORDS: { tag: string; keywords: string[] }[] = [
  {
    tag: 'inversion',
    keywords: ['handstand', 'headstand', 'decline bench', 'inverted', 'inversion'],
  },
  {
    tag: 'isometric',
    keywords: ['isometric', 'plank', 'wall sit', 'static hold', 'hold position'],
  },
  {
    tag: 'explosive',
    keywords: [
      'explosive',
      'clean',
      'snatch',
      'jump',
      'burpee',
      'box jump',
      'plyometric',
      'ballistic',
    ],
  },
  {
    tag: 'valsalva',
    keywords: ['valsalva', 'maximal', '1rm', 'one rep max', 'heavy load', 'max effort'],
  },
  {
    tag: 'high-impact',
    keywords: ['impact', 'jump', 'running', 'jump rope', 'landing', 'bounding'],
  },
  {
    tag: 'high-complexity-floor',
    keywords: ['burpee', 'turkish get-up', 'get-up', 'floor transition', 'complex movement'],
  },
  {
    tag: 'rapid-head-change',
    keywords: ['burpee', 'thruster', 'head level', 'position change', 'flow', 'transition'],
  },
  {
    tag: 'rotational-swing',
    keywords: ['kettlebell swing', 'swing', 'rotational', 'hinge swing', 'kb swing'],
  },
];

/**
 * Which modifier tags to exclude when the user selects an Intensity Modifier condition.
 * Condition id -> modifier tag ids; exercises with any of these tags are hidden.
 */
export const CONDITION_TO_MODIFIER_TAGS: Record<string, string[]> = {
  'high-blood-pressure': ['inversion', 'isometric'],
  'heart-condition': ['explosive', 'valsalva', 'high-impact'],
  'obesity-metabolic': ['high-impact', 'high-complexity-floor'],
  'vertigo-dizziness': ['rapid-head-change', 'rotational-swing'],
};

/**
 * Hidden Mappers: condition id -> injury pill ids. When user selects a condition,
 * these injury ids are added to effective injuries for hide/penalty logic.
 */
export const CONDITION_TO_INJURY_IDS: Record<string, string[]> = {
  'rotator-cuff-tear': ['shoulder'],
  sciatica: ['lower-back', 'hip-glutes'],
  'herniated-disc': ['lower-back', 'upper-back', 'abdominals'],
  'plantar-fasciitis': ['ankles-feet'],
  'tennis-golfers-elbow': ['elbow'],
  'carpal-tunnel': ['wrist-hands'],
};

/** Ids of conditions that use Intensity Modifier logic (filter by modifier tags). */
export const INTENSITY_MODIFIER_CONDITION_IDS = new Set<string>([
  'high-blood-pressure',
  'heart-condition',
  'obesity-metabolic',
  'vertigo-dizziness',
]);

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
 * Returns modifier tags present in the combined text (biomechanics + optional deep dive).
 * Used to hide exercises when user selects systemic conditions (Intensity Modifiers).
 */
export function deriveExerciseModifierTags(
  biomechanics: ParsedBiomechanics | null | undefined,
  plainTextFromDeepDive?: string
): string[] {
  const text = buildCombinedText(biomechanics, plainTextFromDeepDive);
  if (!text) return [];

  const tags: string[] = [];
  for (const { tag, keywords } of EXERCISE_MODIFIER_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      tags.push(tag);
    }
  }
  return tags;
}
