/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kinetic Prescription Engine: client-side scoring of programs against user biometrics.
 */

import type { UserBiometrics, ScoredProgram, ProgramMetadataForScoring } from '@/types/matching';

const EXPERIENCE_LEVELS: ('beginner' | 'intermediate' | 'advanced')[] = [
  'beginner',
  'intermediate',
  'advanced',
];

function experienceIndex(level: 'beginner' | 'intermediate' | 'advanced'): number {
  const i = EXPERIENCE_LEVELS.indexOf(level);
  return i >= 0 ? i : 1;
}

/**
 * Injury rule: if program/exercise has a tag that conflicts with a user injury, apply penalty or hide.
 * Example: program.tags includes "overhead" AND user.injuries includes "shoulder" -> -50.
 * Covers Red Light body parts: spine & torso, upper body, lower body.
 */
export const INJURY_RULES: { tag: string; injury: string; penalty: number }[] = [
  // Spine & Torso
  { tag: 'neck-loading', injury: 'neck', penalty: 50 },
  { tag: 'upper-spine', injury: 'upper-back', penalty: 50 },
  { tag: 'spinal-loading', injury: 'back', penalty: 50 },
  { tag: 'spinal-loading', injury: 'lower-back', penalty: 50 },
  { tag: 'chest-loading', injury: 'chest-ribs', penalty: 50 },
  { tag: 'core-loading', injury: 'abdominals', penalty: 50 },
  // Upper Body
  { tag: 'overhead', injury: 'shoulder', penalty: 50 },
  { tag: 'elbow-loading', injury: 'elbow', penalty: 50 },
  { tag: 'wrist-loading', injury: 'wrist-hands', penalty: 50 },
  // Lower Body
  { tag: 'hip-dominant', injury: 'hip-glutes', penalty: 50 },
  { tag: 'groin-adductor', injury: 'groin', penalty: 50 },
  { tag: 'knee-dominant', injury: 'thighs', penalty: 50 },
  { tag: 'thigh-loading', injury: 'thighs', penalty: 50 },
  { tag: 'knee-dominant', injury: 'knee', penalty: 50 },
  { tag: 'lower-leg', injury: 'shins-calves', penalty: 50 },
  { tag: 'ankle-loading', injury: 'ankles-feet', penalty: 50 },
  { tag: 'high-impact', injury: 'knee', penalty: 30 },
  { tag: 'high-impact', injury: 'back', penalty: 30 },
];

/**
 * Calculate a match score (0–100) and reasons for a program given user biometrics.
 * Zone mismatch is a hard gate (score 0). Experience, schedule, and injury add penalties.
 */
export function calculateMatchScore(
  program: ProgramMetadataForScoring,
  user: UserBiometrics
): ScoredProgram {
  let score = 100;
  const reasons: string[] = [];

  const programZone = program.equipmentProfile?.zoneId;
  const userZone = user.zoneId?.trim();

  let equipmentScore = 100;
  if (userZone) {
    if (programZone !== userZone) {
      return {
        ...program,
        id: program.id,
        matchScore: 0,
        matchReasons: ['Wrong equipment zone'],
        componentScores: { equipment: 0, experience: 0, overall: 0 },
      };
    }
    reasons.push('Matches equipment');
  } else if (programZone) {
    reasons.push('Matches equipment');
  }

  const progLevel = program.difficulty ?? 'intermediate';
  const userLevel = user.experience ?? 'intermediate';
  let experienceScore = 100;
  if (userLevel !== 'any') {
    const diff = Math.abs(experienceIndex(progLevel) - experienceIndex(userLevel));
    experienceScore = diff === 0 ? 100 : diff === 1 ? 80 : 50;
    if (diff === 0) {
      reasons.push('Perfect experience match');
    } else if (diff === 1) {
      score -= 20;
      reasons.push('One level off your experience');
    } else {
      score -= 50;
      reasons.push('Not aligned with your experience');
    }
  }

  const programDays = program.workoutsPerWeek;
  if (programDays != null && user.daysPerWeek != null) {
    if (programDays > user.daysPerWeek) {
      const extra = programDays - user.daysPerWeek;
      score -= extra * 10;
      reasons.push(`Requires ${extra} more day(s) per week than you have`);
    } else if (programDays === user.daysPerWeek) {
      reasons.push('Perfect schedule fit');
    } else {
      reasons.push('Fits your schedule');
    }
  }

  const programTags = program.tags ?? [];
  const userInjuries = user.injuries.map((i) => i.toLowerCase().trim());
  for (const rule of INJURY_RULES) {
    const hasTag = programTags.some((t) => t.toLowerCase() === rule.tag);
    const hasInjury = userInjuries.includes(rule.injury);
    if (hasTag && hasInjury) {
      score -= rule.penalty;
      reasons.push(`May aggravate ${rule.injury}`);
    }
  }

  if (user.injuries.length > 0 && !reasons.some((r) => r.toLowerCase().includes('aggravate'))) {
    reasons.push('No known conflict with your injuries');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    ...program,
    id: program.id,
    matchScore: finalScore,
    matchReasons: reasons.length ? reasons : ['General fit'],
    componentScores: {
      equipment: equipmentScore,
      experience: experienceScore,
      overall: finalScore,
    },
  };
}

/**
 * Score and sort a list of programs by match score (descending).
 * When user.durationWeeksFilter is non-empty, only programs whose durationWeeks is in that set are included.
 */
export function scoreAndSortPrograms(
  programs: ProgramMetadataForScoring[],
  user: UserBiometrics
): ScoredProgram[] {
  const { durationWeeksFilter } = user;
  const filtered =
    durationWeeksFilter != null && durationWeeksFilter.length > 0
      ? programs.filter((p) => durationWeeksFilter.includes(p.durationWeeks))
      : programs;
  const scored = filtered.map((p) => calculateMatchScore(p, user));
  if (user.experience === 'any') {
    return scored.sort((a, b) => {
      const titleCompare = (a.title ?? '').localeCompare(b.title ?? '', undefined, {
        sensitivity: 'base',
      });
      if (titleCompare !== 0) return titleCompare;
      // Tie-breaker by matchScore so visible score reflects ordering.
      return b.matchScore - a.matchScore;
    });
  }
  return scored.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    // Tie-breaker by title when scores are equal.
    return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
  });
}
