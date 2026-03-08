// Onboarding data for WorkoutPlanBuilder (aligned with astro-site)

export type FitnessGoal =
  | 'Build muscle'
  | 'Lose fat'
  | 'Increase strength'
  | 'Improve endurance'
  | 'Get back in shape'
  | 'Move better / reduce pain'
  | 'Improve overall fitness';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active';

export type EquipmentAccess = 'none' | 'minimal' | 'home' | 'full_gym';

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export interface PreferredUnits {
  weight: 'lb' | 'kg';
  height: 'in' | 'cm';
  distance: 'mi' | 'km';
  temperature: 'f' | 'c';
}

export interface WebsiteOnboardingData {
  gender?: Gender;
  age?: number;
  preferred_units: PreferredUnits;
  fitness_level: FitnessLevel;
  current_activity_level: ActivityLevel;
  fitness_goals: FitnessGoal[];
  equipment_access: string[];
}

export const DEFAULT_ONBOARDING_DATA: WebsiteOnboardingData = {
  gender: undefined,
  age: undefined,
  preferred_units: {
    weight: 'lb',
    height: 'in',
    distance: 'mi',
    temperature: 'f',
  },
  fitness_level: 'beginner',
  current_activity_level: 'moderately_active',
  fitness_goals: [],
  equipment_access: ['general', 'strength'],
};
