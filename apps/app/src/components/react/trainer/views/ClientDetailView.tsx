/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Target, Star } from 'lucide-react';

interface ClientStats {
  userId: string;
  email: string | null;
  full_name: string | null;
  totalWorkouts: number;
  avgEffort: number | null;
  avgRating: number | null;
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
  const navigate = useNavigate();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/trainer/clients/${userId}/stats`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Client not found or not in your roster.');
          throw new Error('Failed to load client stats');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setStats(data);
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
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/roster')}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Roster
        </button>
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
          <p className="text-red-400">{error ?? 'Client not found'}</p>
        </div>
      </div>
    );
  }

  const displayName = stats.full_name || stats.email || 'Client';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/roster')}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Roster
          </button>
          <h1 className="font-heading text-3xl font-bold">{displayName}</h1>
        </div>
      </div>

      {stats.email && <p className="text-white/60">{stats.email}</p>}

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
