import type { FitnessLevel } from '@/types/onboarding';

export const categoryLabels: Record<string, string> = {
  general: 'General / Universal',
  strength: 'Strength Training',
  functional: 'Functional Training',
  cardio: 'Cardio',
  calisthenics: 'Calisthenics',
  yoga: 'Yoga',
  pilates: 'Pilates',
  mobility: 'Mobility',
  strongman: 'Strongman',
  olympic: 'Olympic Lifting',
  recovery: 'Recovery',
  combat: 'Combat Sports',
  rehab: 'Rehabilitation',
  outdoor: 'Outdoor Training',
  aquatic: 'Aquatic Training',
  smart: 'Smart Equipment',
};

const categoryMapping: Record<FitnessLevel, string[]> = {
  beginner: ['general', 'strength', 'functional', 'cardio'],
  intermediate: [
    'general',
    'strength',
    'functional',
    'cardio',
    'calisthenics',
    'yoga',
    'pilates',
    'mobility',
  ],
  advanced: [
    'general',
    'strength',
    'functional',
    'cardio',
    'calisthenics',
    'yoga',
    'pilates',
    'mobility',
    'strongman',
    'olympic',
    'recovery',
  ],
  athlete: [
    'general',
    'strength',
    'functional',
    'cardio',
    'calisthenics',
    'yoga',
    'pilates',
    'mobility',
    'strongman',
    'olympic',
    'recovery',
    'combat',
    'rehab',
    'outdoor',
    'aquatic',
    'smart',
  ],
};

export function getAvailableCategoriesByFitnessLevel(fitnessLevel: FitnessLevel): string[] {
  return categoryMapping[fitnessLevel] ?? categoryMapping.beginner;
}

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] ?? category;
}
