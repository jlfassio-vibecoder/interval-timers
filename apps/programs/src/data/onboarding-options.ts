import type {
  FitnessGoal,
  FitnessLevel,
  ActivityLevel,
  EquipmentAccess,
  Gender,
} from '@/types/onboarding';
import { getAvailableCategoriesByFitnessLevel, getCategoryLabel } from './equipment-categories';

export interface LabeledOption<T> {
  value: T;
  label: string;
}

export const fitnessGoalOptions: LabeledOption<FitnessGoal>[] = [
  { value: 'Build muscle', label: 'Build muscle' },
  { value: 'Lose fat', label: 'Lose fat' },
  { value: 'Increase strength', label: 'Increase strength' },
  { value: 'Improve endurance', label: 'Improve endurance' },
  { value: 'Get back in shape', label: 'Get back in shape' },
  { value: 'Move better / reduce pain', label: 'Move better / reduce pain' },
  { value: 'Improve overall fitness', label: 'Improve overall fitness' },
];

export const fitnessLevelOptions: LabeledOption<FitnessLevel>[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'athlete', label: 'Athlete' },
];

export const activityLevelOptions: LabeledOption<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Sedentary (little to no exercise)' },
  { value: 'lightly_active', label: 'Lightly active (1-2 days/week)' },
  { value: 'moderately_active', label: 'Moderately active (3-4 days/week)' },
  { value: 'very_active', label: 'Very active (5-6 days/week)' },
  { value: 'extremely_active', label: 'Extremely active (daily intense)' },
];

export const equipmentAccessOptions: LabeledOption<EquipmentAccess>[] = [
  { value: 'none', label: 'No equipment (bodyweight only)' },
  { value: 'minimal', label: 'Minimal (resistance bands, etc.)' },
  { value: 'home', label: 'Home gym (dumbbells, bench)' },
  { value: 'full_gym', label: 'Full gym access' },
];

export function getEquipmentCategoryOptions(fitnessLevel: FitnessLevel): LabeledOption<string>[] {
  const categories = getAvailableCategoriesByFitnessLevel(fitnessLevel);
  return categories.map((category) => ({
    value: category,
    label: getCategoryLabel(category),
  }));
}

export const genderOptions: LabeledOption<Gender>[] = [
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
];

export const weightUnitOptions: LabeledOption<'lb' | 'kg'>[] = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
];

export const heightUnitOptions: LabeledOption<'in' | 'cm'>[] = [
  { value: 'in', label: 'in' },
  { value: 'cm', label: 'cm' },
];
