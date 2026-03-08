/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared type definitions for AI Challenge Generation
 * Challenges are 2-6 week focused sprints with themes, milestones, and check-ins.
 */

import type {
  UserDemographics,
  MedicalProfile,
  Goals,
  ProgramSchedule,
  PromptChainMetadata,
} from '@/types/ai-program';

/** Challenge duration: 2-6 weeks */
export type ChallengeDurationWeeks = 2 | 3 | 4 | 5 | 6;

/** Milestone marker within a challenge (e.g. Form Check, Halfway, Final Push) */
export interface ChallengeMilestone {
  week: number;
  label: string;
  checkInPrompt?: string;
}

/**
 * Complete persona for challenge generation (API request payload)
 */
export interface ChallengePersona {
  title?: string;
  description?: string;
  theme?: string;
  demographics: UserDemographics;
  medical: MedicalProfile;
  goals: Goals;
  zoneId?: string;
  selectedEquipmentIds?: string[];
  durationWeeks: ChallengeDurationWeeks;
}

/**
 * Admin configuration for challenge generation
 */
export interface ChallengeConfig {
  challengeInfo: {
    title: string;
    description: string;
  };
  targetAudience: UserDemographics;
  requirements: {
    durationWeeks: ChallengeDurationWeeks;
    theme?: string;
  };
  medicalContext?: {
    includeInjuries: boolean;
    injuries?: string;
    includeConditions: boolean;
    conditions?: string;
  };
  goals: Goals;
  zoneId?: string;
  selectedEquipmentIds?: string[];
}

/**
 * Challenge template structure (expected JSON output from AI)
 */
export interface ChallengeTemplate {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  theme?: string;
  tagline?: string;
  milestones: ChallengeMilestone[];
  schedule: ProgramSchedule[];
}

/**
 * Challenge metadata stored in Firestore master document
 */
export interface ChallengeMetadata {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  theme?: string;
  tagline?: string;
  milestones: ChallengeMilestone[];
  targetAudience: UserDemographics;
  equipmentProfile?: {
    zoneId?: string;
    equipmentIds?: string[];
  };
  goals?: Goals;
  chain_metadata?: PromptChainMetadata;
  heroImageUrl?: string;
  sectionImages?: Record<string, string>;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  type: 'challenge';
}

/**
 * Challenge library item (metadata only, for listing)
 */
export interface ChallengeLibraryItem extends ChallengeMetadata {
  id: string;
}

/**
 * Public challenge preview (metadata + Week 1 only)
 */
export interface ChallengePreviewData {
  metadata: ChallengeMetadata & { id: string };
  previewWeek: {
    weekNumber: number;
    workouts: ProgramSchedule['workouts'];
  };
  totalWeeks: number;
}
