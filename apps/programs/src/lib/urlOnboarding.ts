import type { WebsiteOnboardingData, EquipmentAccess } from '@/types/onboarding';
import { DEFAULT_ONBOARDING_DATA } from '@/types/onboarding';

const EQUIPMENT_MAP: Record<EquipmentAccess, string[]> = {
  none: ['general'],
  minimal: ['general', 'strength'],
  home: ['general', 'strength', 'functional'],
  full_gym: ['general', 'strength', 'functional', 'cardio'],
};

export function equipmentArrayToAccess(arr: string[]): EquipmentAccess {
  if (arr.includes('cardio') && arr.length >= 4) return 'full_gym';
  if (arr.includes('functional') && arr.length >= 3) return 'home';
  if (arr.length >= 2) return 'minimal';
  return 'none';
}

export function parseOnboardingFromSearchParams(
  search: URLSearchParams
): Partial<WebsiteOnboardingData> {
  const fitness_level = search.get('fitness_level') as
    | WebsiteOnboardingData['fitness_level']
    | null;
  const activity_level = search.get('activity_level') as
    | WebsiteOnboardingData['current_activity_level']
    | null;
  const fitness_goals = search.get('fitness_goals');
  const equipment_access = search.get('equipment_access');
  const units_weight = search.get('units_weight') as 'lb' | 'kg' | null;
  const units_height = search.get('units_height') as 'in' | 'cm' | null;
  const units_distance = search.get('units_distance') as 'mi' | 'km' | null;
  const units_temperature = search.get('units_temperature') as 'f' | 'c' | null;
  const gender = search.get('gender') as WebsiteOnboardingData['gender'] | null;
  const ageStr = search.get('age');

  const validLevels = ['beginner', 'intermediate', 'advanced', 'athlete'];
  const validActivity = [
    'sedentary',
    'lightly_active',
    'moderately_active',
    'very_active',
    'extremely_active',
  ];
  const validGoals = [
    'Build muscle',
    'Lose fat',
    'Increase strength',
    'Improve endurance',
    'Get back in shape',
    'Move better / reduce pain',
    'Improve overall fitness',
  ];

  const out: Partial<WebsiteOnboardingData> = {};

  if (fitness_level && validLevels.includes(fitness_level)) {
    out.fitness_level = fitness_level as WebsiteOnboardingData['fitness_level'];
  }
  if (activity_level && validActivity.includes(activity_level)) {
    out.current_activity_level = activity_level;
  }
  if (fitness_goals) {
    const goals = fitness_goals
      .split(',')
      .map((g) => g.trim())
      .filter((g) => validGoals.includes(g));
    if (goals.length) out.fitness_goals = goals as WebsiteOnboardingData['fitness_goals'];
  }
  if (equipment_access) {
    const cats = equipment_access
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cats.length) out.equipment_access = cats;
  }
  if (units_weight === 'lb' || units_weight === 'kg') {
    out.preferred_units = { ...DEFAULT_ONBOARDING_DATA.preferred_units, weight: units_weight };
  }
  if (units_height === 'in' || units_height === 'cm') {
    out.preferred_units = {
      ...(out.preferred_units ?? DEFAULT_ONBOARDING_DATA.preferred_units),
      height: units_height,
    };
  }
  if (units_distance === 'mi' || units_distance === 'km') {
    out.preferred_units = {
      ...(out.preferred_units ?? DEFAULT_ONBOARDING_DATA.preferred_units),
      distance: units_distance,
    };
  }
  if (units_temperature === 'f' || units_temperature === 'c') {
    out.preferred_units = {
      ...(out.preferred_units ?? DEFAULT_ONBOARDING_DATA.preferred_units),
      temperature: units_temperature,
    };
  }
  if (gender && ['male', 'female', 'non_binary', 'prefer_not_to_say'].includes(gender)) {
    out.gender = gender as WebsiteOnboardingData['gender'];
  }
  if (ageStr) {
    const age = parseInt(ageStr, 10);
    if (!isNaN(age) && age >= 13 && age <= 120) out.age = age;
  }

  return out;
}

export function onboardingToSearchParams(data: WebsiteOnboardingData): URLSearchParams {
  const params = new URLSearchParams();
  params.set('fitness_level', data.fitness_level);
  params.set('activity_level', data.current_activity_level);
  params.set('fitness_goals', data.fitness_goals.join(','));
  params.set('equipment_access', data.equipment_access.join(','));
  params.set('units_weight', data.preferred_units.weight);
  params.set('units_height', data.preferred_units.height);
  params.set('units_distance', data.preferred_units.distance);
  params.set('units_temperature', data.preferred_units.temperature);
  if (data.gender) params.set('gender', data.gender);
  if (data.age != null) params.set('age', String(data.age));
  params.set('source', 'programs_builder');
  return params;
}

export function equipmentAccessToArray(access: EquipmentAccess): string[] {
  return EQUIPMENT_MAP[access] ?? ['general'];
}
