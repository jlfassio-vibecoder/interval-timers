import type { FitnessGoal } from '@/types/onboarding';
import {
  normalizeFitnessGoalRanking,
  type FitnessGoalId,
} from '@/lib/fitness-goal-taxonomy';

const ONBOARDING_FITNESS_GOAL_MAP: Record<FitnessGoal, FitnessGoalId[]> = {
  'Build muscle': ['muscle_hypertrophy'],
  'Lose fat': ['fat_loss'],
  'Increase strength': ['muscle_hypertrophy'],
  'Improve endurance': ['cardiovascular_endurance'],
  'Get back in shape': ['longevity'],
  'Move better / reduce pain': ['longevity'],
  'Improve overall fitness': ['longevity'],
};

export function mapOnboardingGoalsToRanking(goals: FitnessGoal[]): FitnessGoalId[] {
  const expanded = goals.flatMap((goal) => ONBOARDING_FITNESS_GOAL_MAP[goal] ?? []);
  return normalizeFitnessGoalRanking(expanded);
}
