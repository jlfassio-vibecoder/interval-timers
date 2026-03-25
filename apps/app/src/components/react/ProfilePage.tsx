/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-service profile editing: Baseline, Personalization, Brain, Preferences.
 * Optimistic updates with Supabase; trackEvent for profile_completed and profile_field_updated.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { actions } from 'astro:actions';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import { trackEvent } from '@interval-timers/analytics';
import {
  computeTotalActiveMultiplier,
  lifestyleBaselineFromLegacyActivity,
  legacyActivityLevelFromLifestyle,
  type LifestyleBaselineId,
  type WorkoutRoutineId,
} from '@/lib/met';
import {
  legacyInjuryTagsToPhysicalLimitations,
  MEDICAL_BADGES,
  physicalLimitationsToLegacyInjuryTags,
  PHYSICAL_BADGES,
  PREGNANCY_BADGES,
  toggleMedicalCondition,
  togglePhysicalLimitation,
  togglePregnancyPostpartum,
  type MedicalConditionId,
  type PhysicalLimitationId,
  type PregnancyPostpartumId,
} from '@/lib/profile-health-taxonomy';
import {
  HIIT_STYLE_BADGES,
  toggleHiitStyle,
  type HiitStyleId,
} from '@/lib/profile-hiit-style-badges';
import {
  FITNESS_GOAL_BADGES,
  isFitnessGoalId,
  normalizeFitnessGoalRanking,
  toggleFitnessGoalRanking,
  type FitnessGoalId,
} from '@/lib/fitness-goal-taxonomy';
import { calculateAgeYears, estimateMaxHrTanaka } from '@/lib/calculations';

const DAILY_ROUTINE_OPTIONS: { id: LifestyleBaselineId; label: string }[] = [
  { id: 'sedentary', label: 'Mostly Sitting' },
  { id: 'low_active', label: 'On My Feet' },
  { id: 'active', label: 'Physically Demanding' },
  { id: 'highly_active', label: 'Heavy Labor' },
];

const WORKOUT_ROUTINE_OPTIONS: { id: WorkoutRoutineId; label: string; description: string }[] = [
  { id: 'none', label: 'No regular exercise', description: 'Mainly focusing on daily movement for now.' },
  { id: 'light', label: 'Light (1–2 days/wk)', description: 'Occasional HIIT, yoga, or light cardio.' },
  { id: 'moderate', label: 'Moderate (3–5 days/wk)', description: 'Consistent training sessions most days.' },
  { id: 'hard', label: 'Hard (6–7 days/wk)', description: 'Dedicated daily training or high-intensity sport.' },
  { id: 'pro', label: 'Professional / 2x Daily', description: 'Training multiple times a day or elite level.' },
];
const UNITS = ['metric', 'imperial'] as const;
const SOCIAL_PRIVACY = ['ghost', 'friends_only', 'public'] as const;

function kgToLb(kg: number): number {
  return Math.round(kg * 2.205 * 10) / 10;
}
function lbToKg(lb: number): number {
  return Math.round((lb / 2.205) * 100) / 100;
}
function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}
function inToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}
function formatHeightFtIn(totalInches: number): string {
  const ft = Math.floor(totalInches / 12);
  const in_ = Math.round(totalInches % 12);
  return `${ft}' ${in_}"`;
}

/** Height options for ages 16+ (4' 6" to 7') */
const HEIGHT_OPTIONS_IMPERIAL: { value: number; label: string }[] = (() => {
  const opts: { value: number; label: string }[] = [];
  for (let in_ = 54; in_ <= 84; in_++) {
    opts.push({ value: in_, label: formatHeightFtIn(in_) });
  }
  return opts;
})();

/** Height options for metric (137 cm to 213 cm, ~4' 6" to 7') */
const HEIGHT_OPTIONS_METRIC: { value: number; label: string }[] = (() => {
  const opts: { value: number; label: string }[] = [];
  for (let cm = 137; cm <= 213; cm++) {
    opts.push({ value: cm, label: `${cm} cm` });
  }
  return opts;
})();

interface ProfileForm {
  full_name: string;
  date_of_birth: string;
  biological_sex: string;
  weight_kg: string;
  height_cm: string;
  lifestyle_baseline: string;
  workout_routine: string;
  fitness_goal_ranking: string[];
  preferred_hiit_styles: string[];
  physical_limitations: string[];
  medical_conditions: string[];
  pregnancy_postpartum: string[];
  resting_hr_bpm: string;
  max_hr_bpm: string;
  units_system: string;
  timezone: string;
  social_privacy: string;
  trainer_bio: string;
  host_tagline: string;
}

const emptyForm: ProfileForm = {
  full_name: '',
  date_of_birth: '',
  biological_sex: '',
  weight_kg: '',
  height_cm: '',
  lifestyle_baseline: 'sedentary',
  workout_routine: 'none',
  fitness_goal_ranking: [],
  preferred_hiit_styles: [],
  physical_limitations: [],
  medical_conditions: [],
  pregnancy_postpartum: [],
  resting_hr_bpm: '',
  max_hr_bpm: '',
  units_system: 'imperial',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  social_privacy: 'friends_only',
  trainer_bio: '',
  host_tagline: '',
};

function parseForm(data: Record<string, unknown>): ProfileForm {
  return {
    full_name: String(data.full_name ?? ''),
    date_of_birth: data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : '',
    biological_sex: String(data.biological_sex ?? ''),
    weight_kg: data.weight_kg != null ? String(data.weight_kg) : '',
    height_cm: data.height_cm != null ? String(data.height_cm) : '',
    lifestyle_baseline: (() => {
      const direct = String(data.lifestyle_baseline ?? '').trim();
      if (direct) return direct;
      const fromLegacy = lifestyleBaselineFromLegacyActivity(
        String(data.activity_level_baseline ?? '')
      );
      return fromLegacy || 'sedentary';
    })(),
    workout_routine: String(data.workout_routine ?? '').trim() || 'none',
    fitness_goal_ranking: (() => {
      const fromCol = Array.isArray(data.fitness_goal_ranking)
        ? normalizeFitnessGoalRanking(data.fitness_goal_ranking as string[])
        : [];
      if (fromCol.length > 0) return fromCol;
      const legacy = String(data.primary_fitness_goal ?? '').trim();
      if (legacy && isFitnessGoalId(legacy)) return [legacy];
      return [];
    })(),
    preferred_hiit_styles: (() => {
      const fromArr = Array.isArray(data.preferred_hiit_styles)
        ? (data.preferred_hiit_styles as string[]).filter(Boolean)
        : [];
      if (fromArr.length > 0) return [...new Set(fromArr)];
      const legacy = String(data.preferred_hiit_style ?? '').trim();
      return legacy ? [legacy] : [];
    })(),
    physical_limitations: (() => {
      const fromCol = Array.isArray(data.physical_limitations)
        ? (data.physical_limitations as string[])
        : [];
      if (fromCol.length > 0) return fromCol;
      const legacy = Array.isArray(data.injury_limitation_tags)
        ? (data.injury_limitation_tags as string[]).filter(Boolean)
        : [];
      return legacyInjuryTagsToPhysicalLimitations(legacy);
    })(),
    medical_conditions: Array.isArray(data.medical_conditions)
      ? (data.medical_conditions as string[])
      : [],
    pregnancy_postpartum: Array.isArray(data.pregnancy_postpartum)
      ? (data.pregnancy_postpartum as string[])
      : [],
    resting_hr_bpm: data.resting_hr_bpm != null ? String(data.resting_hr_bpm) : '',
    max_hr_bpm: data.max_hr_bpm != null ? String(data.max_hr_bpm) : '',
    units_system: String(data.units_system ?? 'imperial'),
    timezone: String(data.timezone ?? ''),
    social_privacy: String(data.social_privacy ?? 'friends_only'),
    trainer_bio: String(data.trainer_bio ?? ''),
    host_tagline: String(data.host_tagline ?? ''),
  };
}

function formToUpdate(form: ProfileForm): Record<string, unknown> {
  const u: Record<string, unknown> = {
    full_name: form.full_name || null,
    date_of_birth: form.date_of_birth || null,
    biological_sex: form.biological_sex || null,
    weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
    height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
    lifestyle_baseline: form.lifestyle_baseline || 'sedentary',
    workout_routine: form.workout_routine || 'none',
    total_active_multiplier: computeTotalActiveMultiplier(
      form.lifestyle_baseline || 'sedentary',
      form.workout_routine || 'none'
    ),
    activity_level_baseline: legacyActivityLevelFromLifestyle(
      form.lifestyle_baseline || 'sedentary'
    ),
    fitness_goal_ranking: form.fitness_goal_ranking,
    primary_fitness_goal: form.fitness_goal_ranking[0] ?? null,
    preferred_hiit_styles: form.preferred_hiit_styles,
    preferred_hiit_style: form.preferred_hiit_styles[0] ?? null,
    physical_limitations: form.physical_limitations,
    medical_conditions: form.medical_conditions,
    pregnancy_postpartum: form.pregnancy_postpartum,
    injury_limitation_tags: physicalLimitationsToLegacyInjuryTags(form.physical_limitations),
    resting_hr_bpm: form.resting_hr_bpm ? parseInt(form.resting_hr_bpm, 10) : null,
    max_hr_bpm: form.max_hr_bpm ? parseInt(form.max_hr_bpm, 10) : null,
    units_system: form.units_system || 'imperial',
    timezone: form.timezone || null,
    social_privacy: form.social_privacy || 'friends_only',
    trainer_bio: form.trainer_bio || null,
    host_tagline: form.host_tagline || null,
  };
  return u;
}

const CORE_FIELDS = ['date_of_birth', 'biological_sex', 'weight_kg', 'height_cm', 'lifestyle_baseline'];

function countFilledCore(form: ProfileForm): number {
  return CORE_FIELDS.filter((f) => {
    const v = form[f as keyof ProfileForm];
    if (Array.isArray(v)) return v.length > 0;
    return v != null && String(v).trim() !== '';
  }).length;
}

/** Avoid sending '' to numeric/date columns (Postgres rejects implicit cast). */
function normalizeProfileFieldForDb(field: keyof ProfileForm, value: unknown): unknown {
  if (value === '') {
    if (
      field === 'weight_kg' ||
      field === 'height_cm' ||
      field === 'resting_hr_bpm' ||
      field === 'max_hr_bpm' ||
      field === 'date_of_birth' ||
      field === 'biological_sex'
    ) {
      return null;
    }
  }
  return value;
}

const ProfilePage: React.FC = () => {
  const { user, profile: contextProfile, setProfile } = useAppContext();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [profileCompletedAt, setProfileCompletedAt] = useState<string | null>(null);
  const [restingHrGuideOpen, setRestingHrGuideOpen] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          showToast('error', 'Failed to load profile');
          setLoading(false);
          return;
        }
        if (data) {
          setForm(parseForm(data as Record<string, unknown>));
          setProfileCompletedAt(data.profile_completed_at ?? null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, showToast]);

  useEffect(() => {
    if (!restingHrGuideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRestingHrGuideOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restingHrGuideOpen]);

  const persistBimodalActivity = useCallback(
    async (lifestyle: LifestyleBaselineId, workout: WorkoutRoutineId) => {
      if (!user?.uid) return;
      const snapshot = form;
      const next = { ...form, lifestyle_baseline: lifestyle, workout_routine: workout };
      setForm(next);
      try {
        const { error } = await actions.updateActivityLevel({
          lifestyle_baseline: lifestyle,
          workout_routine: workout,
        });
        if (error) throw new Error(error.message);
        void trackEvent(supabase, 'profile_field_updated', { field: 'activity_bimodal' }, { appId: 'app' });
        const coreFilled = countFilledCore(next);
        if (coreFilled >= 3 && !profileCompletedAt) {
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ profile_completed_at: new Date().toISOString() })
            .eq('id', user.uid);
          if (!updErr) {
            setProfileCompletedAt(new Date().toISOString());
            const fieldsFilled = Object.values(next).filter((v) => {
              if (Array.isArray(v)) return v.length > 0;
              return v != null && String(v).trim() !== '';
            }).length;
            void trackEvent(
              supabase,
              'profile_completed',
              { fields_filled: fieldsFilled, time_to_complete_ms: 0 },
              { appId: 'app' }
            );
          }
        }
      } catch (err) {
        setForm((current) => ({
          ...current,
          lifestyle_baseline: snapshot.lifestyle_baseline,
          workout_routine: snapshot.workout_routine,
        }));
        showToast('error', err instanceof Error ? err.message : 'Failed to save activity');
      }
    },
    [user?.uid, form, profileCompletedAt, showToast]
  );

  const handleSaveField = useCallback(
    async (field: keyof ProfileForm, value: unknown) => {
      if (!user?.uid) return;
      const normalized = normalizeProfileFieldForDb(field, value);
      const previousValue = form[field];
      const next = { ...form, [field]: normalized } as ProfileForm;
      setForm(next);

      const payload: Record<string, unknown> = { [field]: normalized };

      try {
        const { error } = await supabase.from('profiles').update(payload).eq('id', user.uid);
        if (error) throw error;
        void trackEvent(supabase, 'profile_field_updated', { field }, { appId: 'app' });
        if (
          contextProfile &&
          (field === 'date_of_birth' || field === 'resting_hr_bpm' || field === 'max_hr_bpm')
        ) {
          setProfile({
            ...contextProfile,
            ...(field === 'date_of_birth'
              ? {
                  dateOfBirth: normalized
                    ? String(normalized).slice(0, 10)
                    : null,
                }
              : {}),
            ...(field === 'resting_hr_bpm'
              ? {
                  restingHrBpm:
                    normalized != null && String(normalized).trim() !== ''
                      ? parseInt(String(normalized), 10)
                      : null,
                }
              : {}),
            ...(field === 'max_hr_bpm'
              ? {
                  maxHrBpm:
                    normalized != null && String(normalized).trim() !== ''
                      ? parseInt(String(normalized), 10)
                      : null,
                }
              : {}),
          });
        }
        const coreFilled = countFilledCore(next);
        if (coreFilled >= 3 && !profileCompletedAt) {
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ profile_completed_at: new Date().toISOString() })
            .eq('id', user.uid);
          if (!updErr) {
            setProfileCompletedAt(new Date().toISOString());
            const fieldsFilled = Object.values(next).filter((v) => {
              if (Array.isArray(v)) return v.length > 0;
              return v != null && String(v).trim() !== '';
            }).length;
            void trackEvent(
              supabase,
              'profile_completed',
              { fields_filled: fieldsFilled, time_to_complete_ms: 0 },
              { appId: 'app' }
            );
          }
        }
      } catch (err) {
        setForm((current) => ({ ...current, [field]: previousValue }));
        showToast('error', err instanceof Error ? err.message : 'Failed to save');
      }
    },
    [user?.uid, form, profileCompletedAt, showToast, contextProfile, setProfile]
  );

  const handleCalculateMaxHrFromBirthdate = useCallback(() => {
    if (!user?.uid) return;
    if (!form.date_of_birth?.trim()) {
      showToast('error', 'Birthdate Required to Calculate Max HR');
      return;
    }
    const age = calculateAgeYears(form.date_of_birth);
    if (age == null) {
      showToast('error', 'Enter a valid birthdate to calculate max HR');
      return;
    }
    const bpm = estimateMaxHrTanaka(age);
    if (bpm == null) {
      showToast('error', 'Max HR cannot be estimated for this age (use ages 10–100)');
      return;
    }
    void handleSaveField('max_hr_bpm', String(bpm));
  }, [user?.uid, form.date_of_birth, showToast, handleSaveField]);

  const persistHiitStyles = useCallback(
    async (next: string[]) => {
      if (!user?.uid) return;
      const snapshot = [...form.preferred_hiit_styles];
      setForm((current) => ({ ...current, preferred_hiit_styles: next }));
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            preferred_hiit_styles: next,
            preferred_hiit_style: next[0] ?? null,
          })
          .eq('id', user.uid);
        if (error) throw error;
        void trackEvent(
          supabase,
          'profile_field_updated',
          { field: 'preferred_hiit_styles' },
          { appId: 'app' }
        );
      } catch (err) {
        setForm((current) => ({ ...current, preferred_hiit_styles: snapshot }));
        showToast('error', err instanceof Error ? err.message : 'Failed to save HIIT preferences');
      }
    },
    [user?.uid, form.preferred_hiit_styles, showToast]
  );

  const persistFitnessGoalRanking = useCallback(
    async (next: string[]) => {
      if (!user?.uid) return;
      const snapshot = [...form.fitness_goal_ranking];
      setForm((current) => ({ ...current, fitness_goal_ranking: next }));
      try {
        const { error } = await actions.updateProfileFitnessGoalRanking({
          fitness_goal_ranking: next as FitnessGoalId[],
        });
        if (error) throw new Error(error.message);
        void trackEvent(
          supabase,
          'profile_field_updated',
          { field: 'fitness_goal_ranking' },
          { appId: 'app' }
        );
        if (contextProfile) {
          setProfile({
            ...contextProfile,
            fitnessGoalRanking: next,
          });
        }
      } catch (err) {
        setForm((current) => ({ ...current, fitness_goal_ranking: snapshot }));
        showToast(
          'error',
          err instanceof Error ? err.message : 'Failed to save fitness goals'
        );
      }
    },
    [user?.uid, form.fitness_goal_ranking, contextProfile, setProfile, showToast]
  );

  const persistHealthFilters = useCallback(
    async (next: {
      physical_limitations: string[];
      medical_conditions: string[];
      pregnancy_postpartum: string[];
    }) => {
      if (!user?.uid) return;
      const snapshot = form;
      const merged = {
        ...form,
        physical_limitations: next.physical_limitations,
        medical_conditions: next.medical_conditions,
        pregnancy_postpartum: next.pregnancy_postpartum,
      };
      setForm(merged);
      try {
        const { error } = await actions.updateProfileHealthFilters({
          physical_limitations: next.physical_limitations as PhysicalLimitationId[],
          medical_conditions: next.medical_conditions as MedicalConditionId[],
          pregnancy_postpartum: next.pregnancy_postpartum as PregnancyPostpartumId[],
        });
        if (error) throw new Error(error.message);
        void trackEvent(supabase, 'profile_field_updated', { field: 'health_filters' }, { appId: 'app' });
        if (contextProfile) {
          setProfile({
            ...contextProfile,
            physicalLimitations: next.physical_limitations,
            medicalConditions: next.medical_conditions,
            pregnancyPostpartum: next.pregnancy_postpartum,
          });
        }
      } catch (err) {
        setForm((current) => ({
          ...current,
          physical_limitations: snapshot.physical_limitations,
          medical_conditions: snapshot.medical_conditions,
          pregnancy_postpartum: snapshot.pregnancy_postpartum,
        }));
        showToast('error', err instanceof Error ? err.message : 'Failed to save health filters');
      }
    },
    [user?.uid, form, contextProfile, setProfile, showToast]
  );

  const handleSave = useCallback(async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const payload = formToUpdate(form);
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.uid);
      if (error) throw error;
      if (contextProfile) {
        setProfile({
          ...contextProfile,
          displayName: form.full_name || contextProfile.displayName,
          dateOfBirth: form.date_of_birth ? form.date_of_birth.slice(0, 10) : null,
          restingHrBpm: form.resting_hr_bpm ? parseInt(form.resting_hr_bpm, 10) : null,
          maxHrBpm: form.max_hr_bpm ? parseInt(form.max_hr_bpm, 10) : null,
          lifestyleBaseline: form.lifestyle_baseline || 'sedentary',
          workoutRoutine: form.workout_routine || 'none',
          totalActiveMultiplier: computeTotalActiveMultiplier(
            form.lifestyle_baseline || 'sedentary',
            form.workout_routine || 'none'
          ),
          activityLevelBaseline: legacyActivityLevelFromLifestyle(
            form.lifestyle_baseline || 'sedentary'
          ),
          physicalLimitations: form.physical_limitations,
          medicalConditions: form.medical_conditions,
          pregnancyPostpartum: form.pregnancy_postpartum,
          fitnessGoalRanking: form.fitness_goal_ranking,
        });
      }
      const coreFilled = countFilledCore(form);
      if (coreFilled >= 3 && !profileCompletedAt) {
        await supabase
          .from('profiles')
          .update({ profile_completed_at: new Date().toISOString() })
          .eq('id', user.uid);
        setProfileCompletedAt(new Date().toISOString());
        const fieldsFilled = Object.values(form).filter((v) => {
          if (Array.isArray(v)) return v.length > 0;
          return v != null && String(v).trim() !== '';
        }).length;
        void trackEvent(
          supabase,
          'profile_completed',
          { fields_filled: fieldsFilled, has_wearable_connected: false },
          { appId: 'app' }
        );
      }
      showToast('success', 'Profile saved');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [user?.uid, form, contextProfile, setProfile, profileCompletedAt, showToast]);

  const isTrainerOrAdmin =
    user?.role === 'trainer' || user?.role === 'admin' || user?.role === 'super_admin';
  const isHostOrAbove =
    isTrainerOrAdmin || user?.role === 'host';

  if (!user) {
    return (
      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24">
        <p className="text-white/70">Sign in to manage your profile.</p>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { fromAppId: 'app' } }))
          }
          className="mt-4 rounded-xl bg-orange-500 px-4 py-2 font-bold text-black hover:bg-orange-400"
        >
          Sign in
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {restingHrGuideOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8"
          role="presentation"
          onClick={() => setRestingHrGuideOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resting-hr-guide-title"
            className="relative max-h-[min(90vh,32rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setRestingHrGuideOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2
              id="resting-hr-guide-title"
              className="pr-10 font-heading text-xl font-bold text-white"
            >
              How to measure resting heart rate
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Use these steps to get a value you can enter above. This is guidance only—not a medical
              diagnosis.
            </p>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/85">
              <li>
                Download a <strong className="font-semibold text-white">free resting heart rate app</strong>{' '}
                from your phone&apos;s app store (camera-based or sensor-based is fine).
              </li>
              <li>
                Take your reading{' '}
                <strong className="font-semibold text-white">right after you wake up</strong>, while you
                are still <strong className="font-semibold text-white">lying in bed</strong>, before you
                get up or start moving around.
              </li>
            </ol>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-orange-300/90">
              For best accuracy
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/75">
              <li>
                Repeat on several mornings and use a typical value rather than a single reading.
              </li>
              <li>
                Prefer mornings when you had <strong className="text-white/90">no alcohol</strong> the
                night before.
              </li>
              <li>
                Prefer when you got roughly <strong className="text-white/90">average to ideal</strong>{' '}
                sleep for you and you <strong className="text-white/90">feel rested</strong>.
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setRestingHrGuideOpen(false)}
              className="mt-6 w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-orange-400"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center gap-4">
        <a
          href="/account"
          className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-white transition-colors hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Account
        </a>
      </div>

      <header className="mb-12">
        <h1 className="mb-2 font-heading text-4xl font-black text-white">Your Profile</h1>
        <p className="text-white/70">Your data powers the Training Log and MET calculations.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="space-y-10"
      >
        {/* Core baseline */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="mb-4 font-heading text-xl font-bold text-white">Baseline</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/70">Display name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Date of birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => handleSaveField('date_of_birth', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Biological sex</label>
              <select
                value={form.biological_sex}
                onChange={(e) => handleSaveField('biological_sex', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm text-white/70">Height & weight units</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveField('units_system', 'imperial')}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    form.units_system === 'imperial'
                      ? 'border-orange-500 bg-orange-500/20 text-white'
                      : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                  }`}
                >
                  Standard (lb, ft/in)
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveField('units_system', 'metric')}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    form.units_system === 'metric'
                      ? 'border-orange-500 bg-orange-500/20 text-white'
                      : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                  }`}
                >
                  Metric (kg, cm)
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">
                Weight {form.units_system === 'imperial' ? '(lb)' : '(kg)'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={
                  form.units_system === 'imperial'
                    ? (form.weight_kg ? kgToLb(parseFloat(form.weight_kg)) : '')
                    : form.weight_kg
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (form.units_system === 'imperial') {
                    handleSaveField('weight_kg', v ? String(lbToKg(parseFloat(v))) : '');
                  } else {
                    handleSaveField('weight_kg', v);
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">
                Height {form.units_system === 'imperial' ? '(ft/in)' : '(cm)'}
              </label>
              <select
                value={(() => {
                  if (!form.height_cm) return '';
                  const raw = form.units_system === 'imperial'
                    ? Math.round(cmToIn(parseFloat(form.height_cm)))
                    : Math.round(parseFloat(form.height_cm));
                  const [min, max] = form.units_system === 'imperial' ? [54, 84] : [137, 213];
                  return raw >= min && raw <= max ? raw : '';
                })()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    handleSaveField('height_cm', '');
                    return;
                  }
                  const num = parseInt(v, 10);
                  handleSaveField(
                    'height_cm',
                    form.units_system === 'imperial' ? String(inToCm(num)) : String(num)
                  );
                }}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              >
                <option value="">—</option>
                {form.units_system === 'imperial'
                  ? HEIGHT_OPTIONS_IMPERIAL.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))
                  : HEIGHT_OPTIONS_METRIC.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-white/70">Daily routine</label>
              <select
                value={form.lifestyle_baseline}
                onChange={(e) => {
                  void persistBimodalActivity(
                    e.target.value as LifestyleBaselineId,
                    (form.workout_routine || 'none') as WorkoutRoutineId
                  );
                }}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              >
                {DAILY_ROUTINE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-white/60">
                This baseline helps the Training Log calculate your daily burn before exercises are
                added.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-white/70">Workout routine</label>
              <select
                value={form.workout_routine}
                onChange={(e) => {
                  void persistBimodalActivity(
                    (form.lifestyle_baseline || 'sedentary') as LifestyleBaselineId,
                    e.target.value as WorkoutRoutineId
                  );
                }}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              >
                {WORKOUT_ROUTINE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-white/50">
                {
                  WORKOUT_ROUTINE_OPTIONS.find((o) => o.id === form.workout_routine)
                    ?.description
                }
              </p>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-sm text-white/80">
                Your current activity profile is calibrated at{' '}
                <span className="font-semibold text-orange-300">
                  {computeTotalActiveMultiplier(
                    form.lifestyle_baseline || 'sedentary',
                    form.workout_routine || 'none'
                  ).toFixed(2)}
                </span>
                . This ensures your Training Log metrics are 95% more accurate to your specific
                metabolism.
              </p>
            </div>
          </div>
        </section>

        {/* Personalization */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="mb-4 font-heading text-xl font-bold text-white">Personalization</h2>
          <div className="mb-6 sm:col-span-2">
            <h3 className="mb-1 text-sm font-semibold text-white/90">Fitness goals (priority)</h3>
            <p className="mb-4 text-sm text-white/60">
              Choose up to three goals in order of importance. Tap a tag to add or remove it. The first
              one is your top priority and syncs to legacy &quot;primary goal&quot; fields elsewhere.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void persistFitnessGoalRanking([])}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.fitness_goal_ranking.length === 0
                    ? 'border-orange-500 bg-orange-500/20 text-white'
                    : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                }`}
              >
                None
              </button>
              {FITNESS_GOAL_BADGES.map(({ id, label }) => {
                const rankIndex = form.fitness_goal_ranking.indexOf(id);
                const selected = rankIndex >= 0;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const { next, rejectedMax } = toggleFitnessGoalRanking(
                        form.fitness_goal_ranking,
                        id
                      );
                      if (rejectedMax) {
                        showToast('error', 'You can select up to three goals');
                        return;
                      }
                      void persistFitnessGoalRanking(next);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {selected ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/40 text-xs font-bold text-white">
                          {rankIndex + 1}
                        </span>
                        {label}
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/70">Resting HR (bpm)</label>
              <input
                type="number"
                min="30"
                max="120"
                value={form.resting_hr_bpm}
                onChange={(e) => handleSaveField('resting_hr_bpm', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
              <button
                type="button"
                onClick={() => setRestingHrGuideOpen(true)}
                className="mt-2 w-full rounded-lg border border-orange-500/50 px-3 py-2 text-sm font-medium text-orange-300 transition hover:border-orange-400 hover:bg-orange-500/10"
              >
                Calculate Resting HR
              </button>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Max HR (bpm)</label>
              <input
                type="number"
                min="100"
                max="220"
                value={form.max_hr_bpm}
                onChange={(e) => handleSaveField('max_hr_bpm', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
              <button
                type="button"
                disabled={!user?.uid}
                onClick={() => handleCalculateMaxHrFromBirthdate()}
                className="mt-2 w-full rounded-lg border border-orange-500/50 px-3 py-2 text-sm font-medium text-orange-300 transition hover:border-orange-400 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Calculate Max HR
              </button>
            </div>
          </div>
        </section>

        {/* Preferred HIIT styles — multi-select badges */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="mb-2 font-heading text-xl font-bold text-white">Preferred HIIT styles</h2>
          <p className="mb-6 text-sm text-white/60">
            Pick any formats you use. This helps tailor program and timer suggestions. Tap a tag to add
            or remove it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void persistHiitStyles([])}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                form.preferred_hiit_styles.length === 0
                  ? 'border-orange-500 bg-orange-500/20 text-white'
                  : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
              }`}
            >
              No preference
            </button>
            {HIIT_STYLE_BADGES.map(({ id, label }) => {
              const selected = form.preferred_hiit_styles.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const next = toggleHiitStyle(form.preferred_hiit_styles, id as HiitStyleId);
                    void persistHiitStyles(next);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? 'border-orange-500 bg-orange-500/20 text-white'
                      : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Physical considerations — health filters (saved via Astro action + Zod) */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="mb-2 font-heading text-xl font-bold text-white">Physical considerations</h2>
          <p className="mb-6 text-sm text-white/60">
            These selections help tailor suggestions. They are not a medical diagnosis. Tap a tag to
            turn it on or off.
          </p>

          <div className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
              Physical limitations
            </h3>
            <div className="flex flex-wrap gap-2">
              {PHYSICAL_BADGES.map(({ id, label }) => {
                const selected = form.physical_limitations.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const next = togglePhysicalLimitation(form.physical_limitations, id);
                      void persistHealthFilters({
                        physical_limitations: next,
                        medical_conditions: form.medical_conditions,
                        pregnancy_postpartum: form.pregnancy_postpartum,
                      });
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
              Medical conditions
            </h3>
            <div className="flex flex-wrap gap-2">
              {MEDICAL_BADGES.map(({ id, label }) => {
                const selected = form.medical_conditions.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const next = toggleMedicalCondition(form.medical_conditions, id);
                      void persistHealthFilters({
                        physical_limitations: form.physical_limitations,
                        medical_conditions: next,
                        pregnancy_postpartum: form.pregnancy_postpartum,
                      });
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {form.medical_conditions.includes('heart_condition') && (
              <p className="mt-3 text-sm text-amber-200/90">
                Always consult a physician before high-intensity training.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
              Pregnancy / postpartum
            </h3>
            <p className="mb-3 text-xs text-white/50">
              Optional. Leave unselected if not applicable.
            </p>
            <div className="flex flex-wrap gap-2">
              {PREGNANCY_BADGES.map(({ id, label }) => {
                const selected = form.pregnancy_postpartum.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const next = togglePregnancyPostpartum(form.pregnancy_postpartum, id);
                      void persistHealthFilters({
                        physical_limitations: form.physical_limitations,
                        medical_conditions: form.medical_conditions,
                        pregnancy_postpartum: next,
                      });
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="mb-4 font-heading text-xl font-bold text-white">Preferences</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/70">Units</label>
              <select
                value={form.units_system}
                onChange={(e) => handleSaveField('units_system', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lb, in)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Timezone</label>
              <input
                type="text"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                placeholder="America/New_York"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Social privacy</label>
              <select
                value={form.social_privacy}
                onChange={(e) => handleSaveField('social_privacy', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              >
                {SOCIAL_PRIVACY.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Trainer (if role) */}
        {isTrainerOrAdmin && (
          <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="mb-4 font-heading text-xl font-bold text-white">Trainer profile</h2>
            <div>
              <label className="mb-1 block text-sm text-white/70">Bio</label>
              <textarea
                rows={3}
                value={form.trainer_bio}
                onChange={(e) => setForm((f) => ({ ...f, trainer_bio: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
            </div>
          </section>
        )}

        {/* Host (if role) */}
        {isHostOrAbove && (
          <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="mb-4 font-heading text-xl font-bold text-white">Host profile</h2>
            <div>
              <label className="mb-1 block text-sm text-white/70">Tagline</label>
              <input
                type="text"
                value={form.host_tagline}
                onChange={(e) => setForm((f) => ({ ...f, host_tagline: e.target.value }))}
                placeholder="e.g. Friend group organizer"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
              />
            </div>
          </section>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border-2 border-orange-500 bg-orange-500/20 px-8 py-3 font-bold text-white transition-colors hover:bg-orange-500/40 hover:border-orange-400 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </main>
  );
};

export default ProfilePage;
