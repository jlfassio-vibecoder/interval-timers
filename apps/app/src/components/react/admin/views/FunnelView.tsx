/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 6: Activation funnel dashboard.
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, MousePointer, UserPlus, LogIn, CheckCircle, XCircle, Zap } from 'lucide-react';

interface FunnelStats {
  from: string;
  to: string;
  timer_session_complete: number;
  timer_save_click: number;
  account_land_handoff: number;
  account_signup_complete: number;
  account_login_complete: number;
  account_session_prefill_success: number;
  account_session_prefill_fail: number;
  hub_timer_launch_1: number;
  hub_timer_launch_2: number;
  distinct_users_launch_1: number;
  distinct_users_launch_2: number;
  bySource: Record<
    string,
    {
      timer_save_click: number;
      account_land_handoff: number;
      prefill_success: number;
      prefill_fail: number;
    }
  >;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

const FunnelView: React.FC = () => {
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/funnel-stats?days=${days}`, { credentials: 'include' });
        const data = (await res.json()) as FunnelStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setStats(data as FunnelStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load funnel stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [days]);

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <p className="text-white/60">Loading funnel stats…</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
        <p className="text-red-400">{error ?? 'No data'}</p>
      </div>
    );
  }

  const prefillTotal = stats.account_session_prefill_success + stats.account_session_prefill_fail;
  const handoffDenom = stats.timer_save_click || 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Activation Funnel</h1>
          <p className="mt-2 text-white/60">
            {formatDate(stats.from)} – {formatDate(stats.to)}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-white"
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {/* Funnel steps */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Funnel Steps</h2>
        <div className="space-y-4">
          <FunnelRow
            icon={MousePointer}
            label="Save click (spokes)"
            count={stats.timer_save_click}
            sub="timer_save_click"
          />
          <FunnelRow
            icon={TrendingUp}
            label="Landed with handoff"
            count={stats.account_land_handoff}
            rate={pct(stats.account_land_handoff, handoffDenom)}
            sub="account_land_handoff"
          />
          <FunnelRow
            icon={UserPlus}
            label="Sign-up complete"
            count={stats.account_signup_complete}
            sub="account_signup_complete"
          />
          <FunnelRow
            icon={LogIn}
            label="Login complete"
            count={stats.account_login_complete}
            sub="account_login_complete"
          />
          <FunnelRow
            icon={CheckCircle}
            label="Prefill success"
            count={stats.account_session_prefill_success}
            rate={pct(stats.account_session_prefill_success, prefillTotal)}
            sub="account_session_prefill_success"
          />
          <FunnelRow
            icon={XCircle}
            label="Prefill fail"
            count={stats.account_session_prefill_fail}
            sub="account_session_prefill_fail"
          />
          <FunnelRow
            icon={Zap}
            label="First timer from hub"
            count={stats.hub_timer_launch_1}
            sub={`${stats.distinct_users_launch_1} distinct users`}
          />
          <FunnelRow
            icon={Zap}
            label="Second timer from hub (48h)"
            count={stats.hub_timer_launch_2}
            rate={
              stats.distinct_users_launch_1 > 0
                ? pct(stats.distinct_users_launch_2, stats.distinct_users_launch_1)
                : undefined
            }
            sub={`${stats.distinct_users_launch_2} distinct users`}
          />
        </div>
      </div>

      {/* By source */}
      {Object.keys(stats.bySource).length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6">
          <h2 className="mb-4 font-heading text-xl font-bold">By Source</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-4 font-medium text-white/80">Source</th>
                  <th className="py-2 px-4 font-medium text-white/80">Save click</th>
                  <th className="py-2 px-4 font-medium text-white/80">Handoff</th>
                  <th className="py-2 px-4 font-medium text-white/80">Prefill OK</th>
                  <th className="py-2 px-4 font-medium text-white/80">Prefill fail</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.bySource)
                  .sort(([, a], [, b]) => b.timer_save_click - a.timer_save_click)
                  .map(([source, s]) => (
                    <tr key={source} className="border-b border-white/5">
                      <td className="py-3 pr-4 font-medium capitalize">{source}</td>
                      <td className="py-3 px-4">{s.timer_save_click}</td>
                      <td className="py-3 px-4">{s.account_land_handoff}</td>
                      <td className="py-3 px-4">{s.prefill_success}</td>
                      <td className="py-3 px-4">{s.prefill_fail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

function FunnelRow({
  icon: Icon,
  label,
  count,
  rate,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  rate?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-white/5 p-2">
          <Icon className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <p className="font-medium text-white">{label}</p>
          {sub && <p className="text-sm text-white/50">{sub}</p>}
        </div>
      </div>
      <div className="text-right">
        <span className="text-xl font-bold text-white">{count.toLocaleString()}</span>
        {rate && <span className="ml-2 text-sm text-white/60">({rate})</span>}
      </div>
    </div>
  );
}

export default FunnelView;
