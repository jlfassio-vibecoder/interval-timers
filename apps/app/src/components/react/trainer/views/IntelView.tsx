/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, Activity, TrendingUp } from 'lucide-react';

interface TrainerStats {
  totalClients: number;
  totalWorkoutsLogged: number;
  recentActivity: Array<{
    id: string;
    userId: string;
    userEmail: string | null;
    userName: string | null;
    workoutName: string;
    date: string;
    effort: number;
    rating: number;
  }>;
}

const IntelView: React.FC = () => {
  const [stats, setStats] = useState<TrainerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/trainer/stats', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) throw new Error('Unauthorized. Trainer access required.');
          throw new Error('Failed to fetch stats');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
          if (import.meta.env.DEV) console.error('[IntelView]', err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <p className="text-white/60">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl font-bold">Intel</h1>
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: 'Total Clients',
      value: stats.totalClients.toLocaleString(),
      icon: Users,
      color: 'text-blue-400',
    },
    {
      label: 'Workouts Logged',
      value: stats.totalWorkoutsLogged.toLocaleString(),
      icon: Activity,
      color: 'text-green-400',
    },
    {
      label: 'Roster Activity',
      value: stats.recentActivity.length > 0 ? 'Recent' : 'None yet',
      icon: TrendingUp,
      color: 'text-orange-light',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Intel</h1>
        <p className="mt-2 text-white/60">Performance metrics and compliance for your roster</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`rounded-lg bg-white/5 p-3 ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <h2 className="font-heading text-xl font-bold">Recent Activity</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="mt-4 text-white/60">No recent activity from your clients.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 p-4"
              >
                <div className="flex-1">
                  <p className="font-medium text-white">
                    {activity.userName || activity.userEmail || activity.userId} logged{' '}
                    {activity.workoutName}
                  </p>
                  <p className="mt-1 text-sm text-white/60">{formatDate(activity.date)}</p>
                </div>
                <div className="ml-4 flex gap-4 text-sm">
                  <span className="text-white/60">Effort: {activity.effort}/10</span>
                  <span className="text-white/60">Rating: {activity.rating}/5</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelView;
