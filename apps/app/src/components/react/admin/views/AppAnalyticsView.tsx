/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * APP Analytics: app-specific metrics (Universal Activity Hub paste & handoff funnel).
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, TrendingUp, Users } from 'lucide-react';
import {
  ADMIN_ANALYTICS_DAY_OPTIONS,
  parseAdminAnalyticsDays,
  type AdminAnalyticsDays,
} from '@/lib/admin/analytics-days';
import type { HubPasteStats } from '@/lib/supabase/admin/hub-paste-stats';

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

function MetricRow({
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
          <Icon className="text-orange-400 h-5 w-5" />
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

const AppAnalyticsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const days = parseAdminAnalyticsDays(searchParams.get('days'));

  const setDaysParam = (d: AdminAnalyticsDays) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('days', String(d));
        return next;
      },
      { replace: true }
    );
  };

  const [stats, setStats] = useState<HubPasteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/analytics/hub-paste?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as HubPasteStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setStats(data as HubPasteStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load APP analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="rounded-lg border border-white/10 bg-black/20 p-6">
          <p className="text-white/60">Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-8">
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
          <p className="text-red-400">{error ?? 'No data'}</p>
        </div>
      </div>
    );
  }

  const hb = stats;
  const hasHubPasteActivity =
    hb.hub_parse_success > 0 ||
    hb.hub_parse_fail > 0 ||
    hb.distinctSessionCount > 0 ||
    Object.keys(hb.actionClicks).length > 0 ||
    Object.keys(hb.handoffOkByKind).length > 0 ||
    Object.keys(hb.handoffFailByKind).length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">APP Analytics</h1>
          <p className="mt-2 text-white/60">
            {formatDate(stats.from)} – {formatDate(stats.to)}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDaysParam(parseAdminAnalyticsDays(e.target.value))}
          className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-white"
          aria-label="APP Analytics date range"
        >
          {ADMIN_ANALYTICS_DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-white/50">Related</span>
        <Link
          to={`/analytics?days=${days}`}
          className="rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-[#ffbf00] hover:bg-white/5"
        >
          Analytics hub
        </Link>
        <span className="text-white/30">·</span>
        <Link
          to={`/funnel?days=${days}`}
          className="rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-[#ffbf00] hover:bg-white/5"
        >
          Activation Funnel
        </Link>
      </div>

      {/* Universal Activity Hub — paste & handoff */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-2 font-heading text-xl font-bold">
          Universal Activity Hub — paste &amp; handoff
        </h2>
        <p className="mb-4 text-sm text-white/50">
          Events from <code className="text-white/70">app_id=universal_activity_hub</code> (hub
          funnel API). Sessions are anonymous <code className="text-white/70">session_id</code>.
          {hb.distinctSessionsCapped && (
            <span className="ml-1 text-amber-400/90">
              Distinct session count may be capped (large volume).
            </span>
          )}
        </p>
        <div className="space-y-4">
          <MetricRow
            icon={CheckCircle}
            label="Parse success"
            count={hb.hub_parse_success}
            sub="hub_parse_success"
          />
          <MetricRow
            icon={XCircle}
            label="Parse fail"
            count={hb.hub_parse_fail}
            sub="hub_parse_fail"
          />
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-white/5 p-2">
                <TrendingUp className="text-orange-400 h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-white">Parse success rate</p>
                <p className="text-sm text-white/50">success / (success + fail)</p>
              </div>
            </div>
            <span className="text-xl font-bold text-white">
              {pct(hb.hub_parse_success, hb.hub_parse_success + hb.hub_parse_fail)}
            </span>
          </div>
          <MetricRow
            icon={Users}
            label="Distinct hub sessions"
            count={hb.distinctSessionCount}
            sub="unique session_id on paste-funnel events"
          />
        </div>

        {Object.keys(hb.actionClicks).length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <h3 className="mb-2 font-heading text-lg font-semibold text-white/90">Action clicks</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-4 font-medium text-white/80">properties.action</th>
                  <th className="px-4 py-2 font-medium text-white/80">Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(hb.actionClicks)
                  .sort(([, a], [, b]) => b - a)
                  .map(([action, c]) => (
                    <tr key={action} className="border-b border-white/5">
                      <td className="py-2 pr-4 font-mono text-white/90">{action}</td>
                      <td className="px-4 py-2">{c.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {(Object.keys(hb.handoffOkByKind).length > 0 ||
          Object.keys(hb.handoffFailByKind).length > 0) && (
          <div className="mt-6 overflow-x-auto">
            <h3 className="mb-2 font-heading text-lg font-semibold text-white/90">
              Handoff POST outcomes by kind
            </h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-4 font-medium text-white/80">properties.kind</th>
                  <th className="px-4 py-2 font-medium text-white/80">OK</th>
                  <th className="px-4 py-2 font-medium text-white/80">Fail</th>
                  <th className="px-4 py-2 font-medium text-white/80">Success rate</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  new Set([
                    ...Object.keys(hb.handoffOkByKind),
                    ...Object.keys(hb.handoffFailByKind),
                  ])
                )
                  .sort()
                  .map((kind) => {
                    const ok = hb.handoffOkByKind[kind] ?? 0;
                    const fail = hb.handoffFailByKind[kind] ?? 0;
                    return (
                      <tr key={kind} className="border-b border-white/5">
                        <td className="py-2 pr-4 font-mono text-white/90">{kind}</td>
                        <td className="px-4 py-2">{ok.toLocaleString()}</td>
                        <td className="px-4 py-2">{fail.toLocaleString()}</td>
                        <td className="px-4 py-2">{pct(ok, ok + fail)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {!hasHubPasteActivity && (
          <p className="mt-4 text-sm text-white/50">
            No paste-funnel events in this range. Use the Universal Activity Hub to generate
            traffic.
          </p>
        )}
      </div>
    </div>
  );
};

export default AppAnalyticsView;
