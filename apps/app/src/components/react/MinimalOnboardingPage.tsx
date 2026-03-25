import React, { useMemo, useState } from 'react';
import { actions } from 'astro:actions';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import { trackEvent } from '@interval-timers/analytics';
import {
  FITNESS_GOAL_BADGES,
  normalizeFitnessGoalRanking,
  type FitnessGoalId,
} from '@/lib/fitness-goal-taxonomy';
import { mapOnboardingGoalsToRanking } from '@/lib/onboarding-fitness-goal-map';
import type { FitnessGoal } from '@/types/onboarding';

const BASELINE_OPTIONS = [
  { id: 'sedentary', label: 'Mostly sitting' },
  { id: 'low_active', label: 'On my feet often' },
  { id: 'active', label: 'Physically demanding days' },
  { id: 'highly_active', label: 'Heavy labor or very active job' },
] as const;

const ROUTINE_OPTIONS = [
  { id: 'none', label: 'No regular exercise' },
  { id: 'light', label: 'Light (1-2 days/week)' },
  { id: 'moderate', label: 'Moderate (3-5 days/week)' },
  { id: 'hard', label: 'Hard (6-7 days/week)' },
  { id: 'pro', label: 'Professional / 2x daily' },
] as const;
type LifestyleBaselineValue = (typeof BASELINE_OPTIONS)[number]['id'];
type WorkoutRoutineValue = (typeof ROUTINE_OPTIONS)[number]['id'];

function rankingFromUrl(): FitnessGoalId[] {
  if (typeof window === 'undefined') return [];
  const raw = new URLSearchParams(window.location.search).get('fitness_goal_ranking');
  if (raw) {
    return normalizeFitnessGoalRanking(raw.split(',').map((s) => s.trim()));
  }
  const labelsRaw = new URLSearchParams(window.location.search).get('fitness_goals');
  if (!labelsRaw) return [];
  const labels = labelsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as FitnessGoal[];
  return mapOnboardingGoalsToRanking(labels);
}

export default function MinimalOnboardingPage() {
  const { user, setProfile } = useAppContext();
  const [lifestyleBaseline, setLifestyleBaseline] = useState<LifestyleBaselineValue>('sedentary');
  const [workoutRoutine, setWorkoutRoutine] = useState<WorkoutRoutineValue>('none');
  const [ranking, setRanking] = useState<FitnessGoalId[]>(() => rankingFromUrl());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/account?hud=1';
    const value = new URLSearchParams(window.location.search).get('return');
    const trimmed = value?.trim();
    if (!trimmed) return '/account?hud=1';
    try {
      const nextUrl = new URL(trimmed, window.location.origin);
      if (nextUrl.origin !== window.location.origin) return '/account?hud=1';
      return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    } catch {
      return '/account?hud=1';
    }
  }, []);
  const guestClaim = useMemo(() => {
    if (typeof window === 'undefined') {
      return { sessionId: null, participantId: null, claimToken: null };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      sessionId: params.get('guest_session'),
      participantId: params.get('guest_participant'),
      claimToken: params.get('guest_claim'),
    };
  }, []);

  if (!user?.uid) {
    return (
      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-16 pt-24 md:px-6">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8">
          <h1 className="text-2xl font-bold text-white">Sign in required</h1>
          <p className="mt-2 text-white/70">Please sign in first to finish onboarding.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-2xl px-4 pb-16 pt-24 md:px-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-8">
        <h1 className="text-2xl font-bold text-white">Finish your setup</h1>
        <p className="mt-2 text-sm text-white/70">
          Two quick steps to personalize your account and save AMRAP sessions.
        </p>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">Baseline</h2>
          <div className="mt-3 grid gap-2">
            <label className="text-sm text-white/80">Daily routine</label>
            <select
              value={lifestyleBaseline}
              onChange={(e) => setLifestyleBaseline(e.target.value as LifestyleBaselineValue)}
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-white"
            >
              {BASELINE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="mt-2 text-sm text-white/80">Workout routine</label>
            <select
              value={workoutRoutine}
              onChange={(e) => setWorkoutRoutine(e.target.value as WorkoutRoutineValue)}
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-white"
            >
              {ROUTINE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">
            Fitness goals (ranked)
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {FITNESS_GOAL_BADGES.map((badge) => {
              const selectedIndex = ranking.indexOf(badge.id);
              const selected = selectedIndex >= 0;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => {
                    setRanking((prev) => {
                      if (prev.includes(badge.id)) return prev.filter((id) => id !== badge.id);
                      if (prev.length >= 3) return prev;
                      return [...prev, badge.id];
                    });
                  }}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    selected
                      ? 'border-orange-500 bg-orange-600/30 text-orange-100'
                      : 'border-white/20 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {badge.label}
                  {selected ? ` #${selectedIndex + 1}` : ''}
                </button>
              );
            })}
          </div>
        </section>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                const baselineResult = await actions.updateActivityLevel({
                  lifestyle_baseline: lifestyleBaseline,
                  workout_routine: workoutRoutine,
                });
                if (baselineResult.error) throw new Error(baselineResult.error.message);
                const rankingResult = await actions.updateProfileFitnessGoalRanking({
                  fitness_goal_ranking: ranking,
                });
                if (rankingResult.error) throw new Error(rankingResult.error.message);
                const hasGuestClaim =
                  !!guestClaim.sessionId && !!guestClaim.participantId && !!guestClaim.claimToken;
                if (hasGuestClaim) {
                  const { error: claimError } = await supabase.rpc('claim_amrap_guest_session', {
                    p_session_id: guestClaim.sessionId,
                    p_participant_id: guestClaim.participantId,
                    p_claim_token: guestClaim.claimToken,
                  });
                  if (claimError) {
                    await trackEvent(
                      supabase,
                      'guest_amrap_claim_failed',
                      { source: 'amrap', error: claimError.message },
                      { userId: user.uid, appId: 'app' }
                    );
                    throw new Error(claimError.message);
                  }
                  await trackEvent(
                    supabase,
                    'guest_amrap_claim_succeeded',
                    { source: 'amrap' },
                    { userId: user.uid, appId: 'app' }
                  );
                }
                await trackEvent(
                  supabase,
                  'minimal_onboarding_complete',
                  { source: 'amrap' },
                  { userId: user.uid, appId: 'app' }
                );
                setProfile({
                  ...user,
                  lifestyleBaseline,
                  workoutRoutine,
                  fitnessGoalRanking: ranking,
                });
                window.location.href = returnUrl;
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to save your onboarding data.');
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save and continue'}
          </button>
        </div>
      </div>
    </main>
  );
}
