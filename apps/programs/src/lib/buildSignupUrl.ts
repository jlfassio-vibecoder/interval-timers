import type { WebsiteOnboardingData } from '@/types/onboarding';

const APP_BASE = (import.meta.env.PUBLIC_APP_URL || 'https://app.aiworkoutgenerator.com').replace(
  /\/$/,
  ''
);
const SIGNUP_BASE_URL = `${APP_BASE}/signup`;

/**
 * Builds the signup URL with query parameters from the onboarding data.
 * Matches astro-site and app expected format (tab=signup, mode=signup, view=signup, etc.).
 */
export function buildSignupUrl(data: WebsiteOnboardingData, tenantId?: string): string {
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
  if (data.age !== undefined && data.age !== null) params.set('age', String(data.age));

  params.set('source', 'website_builder');
  params.set('theme', 'dark');
  params.set('tab', 'signup');
  params.set('mode', 'signup');
  params.set('view', 'signup');
  if (tenantId) params.set('tenant_id', tenantId);

  return `${SIGNUP_BASE_URL}?${params.toString()}`;
}
