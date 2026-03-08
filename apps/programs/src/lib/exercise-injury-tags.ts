/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Derives injury-relevant tags from exercise biomechanics (and optional deep dive text)
 * for use with INJURY_RULES in the Exercise Prescription Engine.
 */

import type { ParsedBiomechanics } from '@/types/generated-exercise';

/**
 * Keyword groups that map to injury tags. Tag names must match INJURY_RULES
 * in matching-logic.ts (Red Light body parts: spine & torso, upper body, lower body).
 */
export const EXERCISE_INJURY_KEYWORDS: { tag: string; keywords: string[] }[] = [
  // Existing (spine & torso, upper, lower)
  {
    tag: 'overhead',
    keywords: ['overhead', 'glenohumeral', 'rotator', 'shoulder', 'scapula', 'arm above'],
  },
  {
    tag: 'knee-dominant',
    keywords: ['knee', 'patella', 'squat', 'lunge', 'quadriceps', 'patellofemoral'],
  },
  {
    tag: 'spinal-loading',
    keywords: ['spinal', 'lumbar', 'spine', 'erector', 'vertebrae', 'loading', 'compression'],
  },
  { tag: 'high-impact', keywords: ['impact', 'jump', 'plyometric', 'landing', 'bounding'] },
  // Spine & Torso
  { tag: 'neck-loading', keywords: ['cervical', 'neck', 'upper trap', 'head position'] },
  { tag: 'upper-spine', keywords: ['thoracic', 'upper back', 'mid-back', 'scapula'] },
  { tag: 'chest-loading', keywords: ['chest', 'pec', 'sternum', 'ribs'] },
  { tag: 'core-loading', keywords: ['core', 'abdominals', 'rectus', 'oblique', 'trunk'] },
  // Upper Body
  { tag: 'elbow-loading', keywords: ['elbow', 'olecranon'] },
  { tag: 'wrist-loading', keywords: ['wrist', 'hand', 'grip', 'carpal'] },
  // Lower Body
  { tag: 'hip-dominant', keywords: ['hip', 'glute', 'gluteal', 'hip hinge'] },
  { tag: 'groin-adductor', keywords: ['groin', 'adductor', 'inner thigh'] },
  { tag: 'thigh-loading', keywords: ['thigh', 'quadriceps', 'hamstring', 'quads', 'hams'] },
  { tag: 'lower-leg', keywords: ['shin', 'calf', 'tibia', 'gastrocnemius', 'soleus'] },
  { tag: 'ankle-loading', keywords: ['ankle', 'foot', 'plantar', 'dorsiflexion'] },
];

/**
 * Build a single lowercase normalized string from biomechanics and optional deep dive text.
 */
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
 * Returns injury tags present in the combined text (biomechanics + optional deep dive).
 * Tag names match INJURY_RULES so they can be used with the same penalty logic as programs.
 */
export function deriveExerciseInjuryTags(
  biomechanics: ParsedBiomechanics | null | undefined,
  plainTextFromDeepDive?: string
): string[] {
  const text = buildCombinedText(biomechanics, plainTextFromDeepDive);
  if (!text) return [];

  const tags: string[] = [];
  for (const { tag, keywords } of EXERCISE_INJURY_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      tags.push(tag);
    }
  }
  return tags;
}
