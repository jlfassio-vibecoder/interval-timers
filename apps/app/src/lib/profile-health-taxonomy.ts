/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single source of truth for profile health filters (physical, medical, pregnancy).
 * IDs align with INJURY_RULES / prescription engine where applicable.
 */

import type { UserProfile } from '@/types';

/** Physical limitation ids (engine injury ids + explicit none). */
export const PHYSICAL_LIMITATION_IDS = [
  'knee',
  'lower-back',
  'shoulder',
  'ankles-feet',
  'wrist-hands',
  'neck',
  'hip-glutes',
  'elbow',
  'none',
] as const;

export type PhysicalLimitationId = (typeof PHYSICAL_LIMITATION_IDS)[number];

export const MEDICAL_CONDITION_IDS = [
  'hypertension',
  'asthma',
  'diabetes',
  'heart_condition',
  'vertigo',
  'none',
] as const;

export type MedicalConditionId = (typeof MEDICAL_CONDITION_IDS)[number];

export const PREGNANCY_POSTPARTUM_IDS = ['prenatal', 'postnatal'] as const;

export type PregnancyPostpartumId = (typeof PREGNANCY_POSTPARTUM_IDS)[number];

export const PHYSICAL_BADGES: { id: PhysicalLimitationId; label: string }[] = [
  { id: 'knee', label: 'Knee' },
  { id: 'lower-back', label: 'Lower back' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'ankles-feet', label: 'Ankle' },
  { id: 'wrist-hands', label: 'Wrist' },
  { id: 'neck', label: 'Neck' },
  { id: 'hip-glutes', label: 'Hip' },
  { id: 'elbow', label: 'Elbow' },
  { id: 'none', label: 'No known limitations' },
];

export const MEDICAL_BADGES: { id: MedicalConditionId; label: string }[] = [
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'asthma', label: 'Asthma' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'heart_condition', label: 'Heart condition' },
  { id: 'vertigo', label: 'Vertigo' },
  { id: 'none', label: 'None' },
];

export const PREGNANCY_BADGES: { id: PregnancyPostpartumId; label: string }[] = [
  { id: 'prenatal', label: 'Prenatal' },
  { id: 'postnatal', label: 'Postnatal' },
];

const NONE_PHYSICAL: PhysicalLimitationId = 'none';
const NONE_MEDICAL: MedicalConditionId = 'none';

/** Toggle physical badge with none exclusivity. */
export function togglePhysicalLimitation(
  current: string[],
  id: PhysicalLimitationId
): PhysicalLimitationId[] {
  const set = new Set(current.filter((x): x is PhysicalLimitationId => isPhysicalId(x)));
  if (id === NONE_PHYSICAL) {
    return set.has(NONE_PHYSICAL) ? [] : [NONE_PHYSICAL];
  }
  set.delete(NONE_PHYSICAL);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set) as PhysicalLimitationId[];
}

/** Toggle medical badge with none exclusivity. */
export function toggleMedicalCondition(
  current: string[],
  id: MedicalConditionId
): MedicalConditionId[] {
  const set = new Set(current.filter((x): x is MedicalConditionId => isMedicalId(x)));
  if (id === NONE_MEDICAL) {
    return set.has(NONE_MEDICAL) ? [] : [NONE_MEDICAL];
  }
  set.delete(NONE_MEDICAL);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set) as MedicalConditionId[];
}

/** Pregnancy: at most one of prenatal / postnatal. */
export function togglePregnancyPostpartum(
  current: string[],
  id: PregnancyPostpartumId
): PregnancyPostpartumId[] {
  const valid = current.filter((x): x is PregnancyPostpartumId => isPregnancyId(x));
  if (valid.includes(id)) return [];
  return [id];
}

function isPhysicalId(s: string): s is PhysicalLimitationId {
  return (PHYSICAL_LIMITATION_IDS as readonly string[]).includes(s);
}

function isMedicalId(s: string): s is MedicalConditionId {
  return (MEDICAL_CONDITION_IDS as readonly string[]).includes(s);
}

function isPregnancyId(s: string): s is PregnancyPostpartumId {
  return (PREGNANCY_POSTPARTUM_IDS as readonly string[]).includes(s);
}

/** Map profile medical ids to prescription engine condition ids (PrescriptionVitals / modifier tags). */
export function profileMedicalToEngineConditionIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (id === 'none' || !id) continue;
    const mapped =
      id === 'hypertension'
        ? 'high-blood-pressure'
        : id === 'heart_condition'
          ? 'heart-condition'
          : id === 'vertigo'
            ? 'vertigo-dizziness'
            : id === 'asthma'
              ? 'asthma'
              : id === 'diabetes'
                ? 'diabetes'
                : null;
    if (mapped) out.push(mapped);
  }
  return [...new Set(out)];
}

/** Map pregnancy selections to engine condition ids. */
export function profilePregnancyToEngineConditionIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (id === 'prenatal' || id === 'postnatal') out.push(id);
  }
  return [...new Set(out)];
}

/** Effective injury ids for INJURY_RULES (excludes none). */
export function physicalLimitationsToInjuryIds(ids: string[]): string[] {
  return ids.filter((id) => id && id !== 'none').map((id) => id.toLowerCase().trim());
}

export interface ProfileHealthSummary {
  /** User explicitly chose "no known limitations" for physical. */
  hasExplicitPhysicalNone: boolean;
  /** User explicitly chose "none" for medical. */
  hasExplicitMedicalNone: boolean;
  /** Show Training Log banner / workout reminder (real considerations, not empty defaults). */
  showHealthReminder: boolean;
}

function normalizeArr(a: string[] | null | undefined): string[] {
  return Array.isArray(a) ? a : [];
}

/**
 * Whether to surface a non-clinical reminder in Training Log / workout summary.
 * True when there is any physical limitation (other than none), medical condition (other than none), or pregnancy tag.
 */
export function getProfileHealthSummary(
  user: UserProfile | null | undefined
): ProfileHealthSummary {
  const physical = normalizeArr(user?.physicalLimitations);
  const medical = normalizeArr(user?.medicalConditions);
  const pregnancy = normalizeArr(user?.pregnancyPostpartum);

  const hasExplicitPhysicalNone = physical.length === 1 && physical[0] === 'none';
  const hasExplicitMedicalNone = medical.length === 1 && medical[0] === 'none';

  const physicalReal = physical.filter((id) => id !== 'none');
  const medicalReal = medical.filter((id) => id !== 'none');
  const showHealthReminder =
    physicalReal.length > 0 || medicalReal.length > 0 || pregnancy.length > 0;

  return {
    hasExplicitPhysicalNone,
    hasExplicitMedicalNone,
    showHealthReminder,
  };
}

/** Human label for a stored id (Mission Control / fallbacks). */
export function labelForPhysicalId(id: string): string {
  return PHYSICAL_BADGES.find((b) => b.id === id)?.label ?? id.replace(/-/g, ' ');
}

export function labelForMedicalId(id: string): string {
  return MEDICAL_BADGES.find((b) => b.id === id)?.label ?? id.replace(/_/g, ' ');
}

export function labelForPregnancyId(id: string): string {
  return PREGNANCY_BADGES.find((b) => b.id === id)?.label ?? id;
}

/** Legacy injury_limitation_tags → engine physical ids (for parseForm fallback). */
export function legacyInjuryTagsToPhysicalLimitations(tags: string[]): PhysicalLimitationId[] {
  const mapped = tags
    .filter(Boolean)
    .map((t) => {
      if (t === 'lower_back') return 'lower-back';
      if (t === 'none') return 'none' as const;
      if (isPhysicalId(t)) return t;
      return null;
    })
    .filter((x): x is PhysicalLimitationId => x != null);
  return [...new Set(mapped)];
}

/** Keep legacy `injury_limitation_tags` aligned for older readers (underscore lower back). */
export function physicalLimitationsToLegacyInjuryTags(physical: string[]): string[] | null {
  if (!physical.length) return null;
  if (physical.length === 1 && physical[0] === 'none') return ['none'];
  const mapped = physical
    .filter((id) => id !== 'none')
    .map((id) => (id === 'lower-back' ? 'lower_back' : id));
  return mapped.length ? mapped : null;
}
