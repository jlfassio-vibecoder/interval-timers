/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Activity, TrendingUp } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalPrograms: number;
  totalWorkoutsLogged: number;
  growthRate: number | null;
  recentActivity: Array<{
    id: string;
    userId: string;
    userEmail: string | null;
    workoutName: string;
    date: string;
    effort: number;
    rating: number;
  }>;
}

const DashboardHome: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/admin/stats', {
          credentials: 'include', // Include cookies for authentication
        });

        // Parse defensively so status-specific handling (401, 503) still runs when body is non-JSON (proxy error page, empty, etc.)
        const data = (await response.json().catch(() => ({}))) as
          | DashboardStats
          | { error?: string };
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized. Please ensure you have admin access.');
          }
          if (response.status === 503) {
            throw new Error(
              'Dashboard statistics temporarily unavailable. Please refresh to retry.'
            );
          }
          const message =
            data &&
            typeof data === 'object' &&
            'error' in data &&
            typeof (data as { error?: string }).error === 'string'
              ? (data as { error: string }).error
              : 'Failed to fetch dashboard statistics';
          throw new Error(message);
        }
        setStats(data as DashboardStats);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load dashboard statistics';
        setError(errorMessage);
        if (import.meta.env.DEV) {
          console.error('[DashboardHome] Error fetching stats:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  // Format date relative or absolute
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Calculate change for programs (simple: just show count, no change tracking yet)
  const getProgramsChange = (): string => {
    // For now, just show the count without change tracking
    // This could be enhanced later with historical data
    return '';
  };

  // Calculate change for workouts (simple: just show count, no change tracking yet)
  const getWorkoutsChange = (): string => {
    // For now, just show the count without change tracking
    // This could be enhanced later with historical data
    return '';
  };

  const statCards = stats
    ? [
        {
          label: 'Total Users',
          value: formatNumber(stats.totalUsers),
          change:
            stats.growthRate !== null
              ? `${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}%`
              : 'N/A',
          icon: Users,
          color: 'text-blue-400',
        },
        {
          label: 'Active Programs',
          value: formatNumber(stats.totalPrograms),
          change: getProgramsChange(),
          icon: BookOpen,
          color: 'text-purple-400',
        },
        {
          label: 'Workouts Logged',
          value: formatNumber(stats.totalWorkoutsLogged),
          change: getWorkoutsChange(),
          icon: Activity,
          color: 'text-green-400',
        },
        {
          label: 'Growth Rate',
          value: stats.growthRate !== null ? `${stats.growthRate.toFixed(1)}%` : 'N/A',
          change: stats.growthRate !== null ? '30 days' : '',
          icon: TrendingUp,
          color: 'text-yellow-400',
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Dashboard Overview</h1>
        <p className="mt-2 text-white/60">Welcome to the admin dashboard</p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <p className="text-white/60">Loading dashboard statistics...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 backdrop-blur-sm">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                      {stat.change && <p className="mt-1 text-sm text-green-400">{stat.change}</p>}
                    </div>
                    <div className={`rounded-lg bg-white/5 p-3 ${stat.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
            <h2 className="font-heading text-xl font-bold">Recent Activity</h2>
            {stats.recentActivity.length === 0 ? (
              <p className="mt-4 text-white/60">No recent activity</p>
            ) : (
              <div className="mt-4 space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 p-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {activity.userEmail || activity.userId} logged {activity.workoutName}
                      </p>
                      <p className="mt-1 text-sm text-white/60">{formatDate(activity.date)}</p>
                    </div>
                    <div className="ml-4 flex gap-4 text-sm">
                      <div>
                        <span className="text-white/60">Effort:</span>
                        <span className="ml-2 font-medium text-white">{activity.effort}/10</span>
                      </div>
                      <div>
                        <span className="text-white/60">Rating:</span>
                        <span className="ml-2 font-medium text-white">{activity.rating}/5</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardHome;
