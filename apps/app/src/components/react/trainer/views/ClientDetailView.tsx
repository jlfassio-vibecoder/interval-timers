/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Target, Star, User } from 'lucide-react';
import {
  labelForMedicalId,
  labelForPhysicalId,
  labelForPregnancyId,
} from '@/lib/profile-health-taxonomy';
import { labelsForHiitStyleIds } from '@/lib/profile-hiit-style-badges';
import { labelForFitnessGoalId } from '@/lib/fitness-goal-taxonomy';

interface MissionControlProfile {
  id: string;
  full_name: string | null;
  primary_fitness_goal: string | null;
  fitness_goal_ranking?: string[] | null;
  preferred_hiit_style: string | null;
  preferred_hiit_styles?: string[] | null;
  injury_limitation_tags?: string[] | null;
  physical_limitations?: string[] | null;
  medical_conditions?: string[] | null;
  pregnancy_postpartum?: string[] | null;
  units_system: string | null;
  weekly_goal_minutes: number | null;
  profile_completed_at: string | null;
}

interface ClientStats {
  userId: string;
  email: string | null;
  full_name: string | null;
  totalWorkouts: number;
  avgEffort: number | null;
  avgRating: number | null;
  alignmentAverage: number | null;
  alignmentScoredSessions: number;
  logs: Array<{
    id: string;
    workoutName: string;
    date: string;
    effort: number;
    rating: number;
  }>;
}

const ClientDetailView: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [profile, setProfile] = useState<MissionControlProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/trainer/clients/${userId}/stats`, { credentials: 'include' }),
      fetch(`/api/mission-control/profile/${userId}`, { credentials: 'include' }),
    ])
      .then(([statsRes, profileRes]) => {
        if (!statsRes.ok) {
          if (statsRes.status === 404) throw new Error('Client not found or not in your roster.');
          throw new Error('Failed to load client stats');
        }
        return Promise.all([
          statsRes.json() as Promise<ClientStats>,
          profileRes.ok ? (profileRes.json() as Promise<MissionControlProfile>) : null,
        ]);
      })
      .then(([statsData, profileData]) => {
        if (!cancelled) {
          setStats(statsData);
          setProfile(profileData ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load client stats');
          if (import.meta.env.DEV) console.error('[ClientDetailView]', err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        <span className="ml-3 text-white/60">Loading client stats...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
        <p className="text-red-400">{error ?? 'Client not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {profile && (
        <div className="rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
          <h2 className="flex items-center gap-2 border-b border-white/10 px-6 py-4 font-heading text-xl font-bold">
            <User className="h-5 w-5 text-orange-light" />
            Profile
          </h2>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {profile.fitness_goal_ranking && profile.fitness_goal_ranking.length > 0 ? (
              <div className="sm:col-span-2">
                <p className="text-sm text-white/60">Fitness goals (priority)</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 font-medium text-white/90">
                  {profile.fitness_goal_ranking.map((id) => (
                    <li key={id}>{labelForFitnessGoalId(id)}</li>
                  ))}
                </ol>
              </div>
            ) : (
              profile.primary_fitness_goal && (
                <div>
                  <p className="text-sm text-white/60">Fitness goal</p>
                  <p className="font-medium capitalize">
                    {profile.primary_fitness_goal.replace(/_/g, ' ')}
                  </p>
                </div>
              )
            )}
            {(() => {
              const ids =
                profile.preferred_hiit_styles && profile.preferred_hiit_styles.length > 0
                  ? profile.preferred_hiit_styles
                  : profile.preferred_hiit_style
                    ? [profile.preferred_hiit_style]
                    : [];
              if (ids.length === 0) return null;
              return (
                <div className="sm:col-span-2">
                  <p className="text-sm text-white/60">Preferred HIIT styles</p>
                  <p className="font-medium">{labelsForHiitStyleIds(ids)}</p>
                </div>
              );
            })()}
            {profile.weekly_goal_minutes != null && (
              <div>
                <p className="text-sm text-white/60">Weekly goal</p>
                <p className="font-medium">{profile.weekly_goal_minutes} min</p>
              </div>
            )}
            {profile.physical_limitations && profile.physical_limitations.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-sm text-white/60">Physical limitations</p>
                <p className="font-medium">
                  {profile.physical_limitations.map(labelForPhysicalId).join(', ')}
                </p>
              </div>
            )}
            {profile.medical_conditions && profile.medical_conditions.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-sm text-white/60">Medical conditions</p>
                <p className="font-medium">
                  {profile.medical_conditions.map(labelForMedicalId).join(', ')}
                </p>
              </div>
            )}
            {profile.pregnancy_postpartum && profile.pregnancy_postpartum.length > 0 && (
              <div>
                <p className="text-sm text-white/60">Pregnancy / postpartum</p>
                <p className="font-medium">
                  {profile.pregnancy_postpartum.map(labelForPregnancyId).join(', ')}
                </p>
              </div>
            )}
            {!(
              (profile.fitness_goal_ranking && profile.fitness_goal_ranking.length > 0) ||
              !!profile.primary_fitness_goal
            ) &&
              !(
                (profile.preferred_hiit_styles && profile.preferred_hiit_styles.length > 0) ||
                !!profile.preferred_hiit_style
              ) &&
              profile.weekly_goal_minutes == null &&
              !(profile.physical_limitations && profile.physical_limitations.length > 0) &&
              !(profile.medical_conditions && profile.medical_conditions.length > 0) &&
              !(profile.pregnancy_postpartum && profile.pregnancy_postpartum.length > 0) &&
              !(profile.injury_limitation_tags && profile.injury_limitation_tags.length > 0) && (
                <p className="text-white/60">Profile not yet completed.</p>
              )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-orange-light" />
            <div>
              <p className="text-sm text-white/60">Total Workouts</p>
              <p className="text-2xl font-bold">{stats.totalWorkouts}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-orange-light" />
            <div>
              <p className="text-sm text-white/60">Avg Effort</p>
              <p className="text-2xl font-bold">
                {stats.avgEffort != null ? `${stats.avgEffort.toFixed(1)}/10` : '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-orange-light" />
            <div>
              <p className="text-sm text-white/60">Avg Rating</p>
              <p className="text-2xl font-bold">
                {stats.avgRating != null ? `${stats.avgRating.toFixed(1)}/5` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <h2 className="font-heading text-lg font-bold text-white">Goal alignment insight</h2>
        <p className="mt-1 text-sm text-white/65">
          Average fit of logged sessions against this client&apos;s goal ranking.
        </p>
        <p className="mt-3 text-2xl font-bold text-white">
          {stats.alignmentAverage == null ? '—' : `${stats.alignmentAverage}%`}
        </p>
        <p className="text-sm text-white/60">
          {stats.alignmentScoredSessions}/{stats.totalWorkouts} sessions scored
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
        <h2 className="border-b border-white/10 px-6 py-4 font-heading text-xl font-bold">
          Workout Logs
        </h2>
        {stats.logs.length === 0 ? (
          <p className="px-6 py-8 text-white/60">No workouts logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10 bg-black/30">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">
                    Workout
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">
                    Effort
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 text-white/90">{formatDate(log.date)}</td>
                    <td className="px-6 py-4 font-medium">{log.workoutName}</td>
                    <td className="px-6 py-4 text-white/70">{log.effort}/10</td>
                    <td className="px-6 py-4 text-white/70">{log.rating}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetailView;
