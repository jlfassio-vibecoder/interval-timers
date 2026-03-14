/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared logic for building approved-exercise maps from GeneratedExercise list.
 * Used by AppIslands, ActiveProgramView, ProgramSalesView, ProgramBlueprintEditor, etc.
 */

import type { Exercise, ExtendedBiomechanics, GeneratedExerciseInput } from './types';
import { parseBiomechanicalPoints, FULL_BIOMECHANICS_CARD_LENGTH } from './parse-biomechanics';

/** Irregular plurals → singular for exercise-relevant terms. Checked before suffix rules. */
const IRREGULAR_SINGULAR: Record<string, string> = {
  calves: 'calf',
  abs: 'abs', // Fitness canonical; avoid "ab"
};

/**
 * Converts the last word to singular form for consistent lookup.
 * Exercises are stored singular (e.g. "Bodyweight Squat"); workouts prescribe plural (e.g. "Bodyweight Squats").
 */
function toSingular(word: string): string {
  if (!word || word.length < 2) return word;
  const lowered = word.toLowerCase();
  const irregular = IRREGULAR_SINGULAR[lowered];
  if (irregular !== undefined) return irregular;
  if (word.endsWith('ss')) return word; // press, cross
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y'; // calories → calorie
  if (word.endsWith('es')) {
    const beforeE = word[word.length - 3];
    if ('sxz'.includes(beforeE) || word.endsWith('ches') || word.endsWith('shes')) {
      return word.slice(0, -2); // boxes → box, pushes → push
    }
    return word.slice(0, -1); // lunges → lunge, raises → raise
  }
  if (word.endsWith('s')) return word.slice(0, -1); // squats → squat, jumps → jump
  return word;
}

/**
 * Normalizes an exercise name to a consistent lookup key (e.g. "Arm Circles" → "arm circles").
 * Handles singular/plural so "Bodyweight Squats" matches "Bodyweight Squat" (canonical form: singular).
 */
interface DeploymentStepsStructure {
  intro?: string;
  sectionTitle?: string;
  steps: string[];
}

/**
 * Parse user instructions markdown into structured Deployment Steps (intro, section title, numbered steps).
 * Matches format: subtitle, ## HOW TO DO IT, 1. Step, 2. Step, etc.
 */
function parseUserInstructionsForDeploymentSteps(markdown: string): DeploymentStepsStructure {
  const trimmed = markdown.trim();
  if (!trimmed) return { steps: [] };

  const headingRegex = /^##\s+(.+)$/gm;
  const matches = [...trimmed.matchAll(headingRegex)];

  if (matches.length === 0) {
    return { steps: [] };
  }

  const intro = trimmed.slice(0, matches[0]!.index).trim();
  const howToRegex = /how to|do it|instructions|steps/i;
  let sectionTitle: string | undefined;
  let sectionContent = '';

  for (let i = 0; i < matches.length; i++) {
    const title = matches[i]![1]!.trim();
    const start = (matches[i]!.index ?? 0) + matches[i]![0].length;
    const end = i < matches.length - 1 ? (matches[i + 1]!.index ?? trimmed.length) : trimmed.length;
    const content = trimmed.slice(start, end).trim();
    if (howToRegex.test(title)) {
      sectionTitle = title;
      sectionContent = content;
      break;
    }
  }
  if (!sectionContent && matches.length > 0) {
    sectionTitle = matches[0]![1]!.trim();
    const start = (matches[0]!.index ?? 0) + matches[0]![0].length;
    sectionContent = trimmed.slice(start).trim();
  }
  const steps = sectionContent
    ? sectionContent
        .split(/\n\s*(?=\d+[.)]\s+)/)
        .map((s) => s.trim().replace(/^\d+[.)]\s*/, ''))
        .filter(Boolean)
    : [];

  return { intro: intro || undefined, sectionTitle, steps };
}

export function normalizeExerciseName(name: string): string {
  const s = name.toLowerCase().trim();
  if (!s) return s;
  const parts = s.split(/\s+/);
  const last = parts[parts.length - 1];
  const singularLast = toSingular(last);
  if (singularLast === last) return s;
  return [...parts.slice(0, -1), singularLast].join(' ').trim() || singularLast;
}

export interface ApprovedExerciseMaps {
  exerciseMap: Map<string, Exercise>;
  extendedMap: Map<string, ExtendedBiomechanics>;
  slugMap: Map<string, string>;
}

/**
 * Build name→Exercise, name→ExtendedBiomechanics, and name→slug maps from
 * an approved GeneratedExercise list. Uses normalized names (lowercase, trimmed) as keys.
 */
export function buildApprovedExerciseMaps(
  list: GeneratedExerciseInput[]
): ApprovedExerciseMaps {
  const exerciseMap = new Map<string, Exercise>();
  const extendedMap = new Map<string, ExtendedBiomechanics>();
  const slugMap = new Map<string, string>();

  list.forEach((genEx) => {
    const key = normalizeExerciseName(genEx.exerciseName);
    slugMap.set(key, genEx.slug);

    const rawCues = genEx.biomechanics?.performanceCues ?? [];
    let instructions: string[];
    let extended: ExtendedBiomechanics | undefined;
    let instructionsStructured: Exercise['instructionsStructured'] | undefined;

    // Prefer user-friendly instructions (admin-generated for public) over performance cues
    const userInstructions = (genEx.userFriendlyInstructions ?? '').trim();
    if (userInstructions) {
      const structure = parseUserInstructionsForDeploymentSteps(userInstructions);
      if (structure.steps.length > 0) {
        instructionsStructured = {
          intro: structure.intro,
          sectionTitle: structure.sectionTitle,
          steps: structure.steps,
        };
        instructions = structure.steps;
      } else {
        instructions = userInstructions
          .split(/\r?\n+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      extended = genEx.biomechanics
        ? {
            biomechanicalChain: genEx.biomechanics.biomechanicalChain,
            pivotPoints: genEx.biomechanics.pivotPoints,
            stabilizationNeeds: genEx.biomechanics.stabilizationNeeds,
            commonMistakes: genEx.biomechanics.commonMistakes,
          }
        : undefined;
    } else if (rawCues.length >= FULL_BIOMECHANICS_CARD_LENGTH) {
      try {
        const parsed = parseBiomechanicalPoints(rawCues);
        instructions =
          parsed.biomechanics.performanceCues.length > 0
            ? parsed.biomechanics.performanceCues
            : [rawCues[FULL_BIOMECHANICS_CARD_LENGTH - 1]];
        extended = {
          biomechanicalChain: parsed.biomechanics.biomechanicalChain || undefined,
          pivotPoints: parsed.biomechanics.pivotPoints || undefined,
          stabilizationNeeds: parsed.biomechanics.stabilizationNeeds || undefined,
          commonMistakes:
            (parsed.biomechanics.commonMistakes?.length ?? 0) > 0
              ? parsed.biomechanics.commonMistakes
              : undefined,
        };
      } catch {
        instructions = rawCues;
        extended = genEx.biomechanics
          ? {
              biomechanicalChain: genEx.biomechanics.biomechanicalChain,
              pivotPoints: genEx.biomechanics.pivotPoints,
              stabilizationNeeds: genEx.biomechanics.stabilizationNeeds,
              commonMistakes: genEx.biomechanics.commonMistakes,
            }
          : undefined;
      }
    } else {
      instructions = rawCues;
      extended = genEx.biomechanics
        ? {
            biomechanicalChain: genEx.biomechanics.biomechanicalChain,
            pivotPoints: genEx.biomechanics.pivotPoints,
            stabilizationNeeds: genEx.biomechanics.stabilizationNeeds,
            commonMistakes: genEx.biomechanics.commonMistakes,
          }
        : undefined;
    }

    const primaryVideoUrl =
      genEx.videos && genEx.videos.length > 0
        ? (genEx.videos.find((v: { videoUrl?: string; hidden?: boolean }) => !v.hidden) ?? genEx.videos[0])?.videoUrl
        : genEx.videoUrl;
    exerciseMap.set(key, {
      name: genEx.exerciseName,
      images: genEx.imageUrl ? [genEx.imageUrl] : [],
      instructions,
      ...(instructionsStructured && { instructionsStructured }),
      ...(primaryVideoUrl && { videoUrl: primaryVideoUrl }),
    });
    if (extended) {
      extendedMap.set(key, extended);
    }
  });

  return { exerciseMap, extendedMap, slugMap };
}
