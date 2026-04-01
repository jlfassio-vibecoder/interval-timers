/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analytics dashboard shell (Phase 0). Overview from analytics_events; Phase 1 Acquisition section.
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ADMIN_ANALYTICS_DATASETS,
  type AdminAnalyticsUiPath,
} from '@/lib/admin/analytics-datasets-registry';
import {
  ADMIN_ANALYTICS_DAY_OPTIONS,
  parseAdminAnalyticsDays,
  type AdminAnalyticsDays,
} from '@/lib/admin/analytics-days';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

interface AnalyticsOverview {
  from: string;
  to: string;
  totalEvents: number;
  distinctUsers: number;
}

interface AcquisitionStats {
  uniqueVisitorsByDay: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  utmBreakdown: { source: string; medium: string; campaign: string; count: number }[];
  topLandingPages: { path: string; count: number }[];
  deviceBrowser: { device: string; browser: string; count: number }[];
  geo: { country: string; count: number }[];
}

interface AuthFunnelStats {
  signUpsByDay: { date: string; count: number }[];
  signInsByDay: { date: string; count: number }[];
  funnel: { visit: number; signUp: number; emailConfirmed: number; firstAction: number };
  oauthVsEmail: { oauth: number; email: number };
  ttfkaDistribution: {
    sameDay: number;
    oneToTwoDays: number;
    threeToSevenDays: number;
    sevenPlusDays: number;
    never: number;
  };
  onboardingDropOff?: { step: string; completed: number; dropped: number }[];
}

interface EngagementStats {
  dauByDay: { date: string; count: number }[];
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  sessionCount: number;
  avgSessionDurationMinutes: number;
  avgPagesPerSession: number;
  featureActivity: {
    featureId: string;
    name: string;
    surface: string;
    count7d: number;
    count30d: number;
    wowPercent: number | null;
  }[];
  featureActivityTrends: { featureId: string; points: { date: string; count: number }[] }[];
  eventVolumeByAppId7d: { appId: string; count7d: number }[];
  powerUserDistribution: { bucket: string; count: number }[];
}

interface MonetizationStats {
  activeByPlan: { planName: string; planIndex: number; count: number; price: number }[];
  activePaidCount: number;
  activeTrialCount: number;
  trialConversionRate: number;
  trialConverted: number;
  trialEligible: number;
  ttfcDistribution: {
    sameDay: number;
    oneToTwoDays: number;
    threeToSevenDays: number;
    sevenPlusDays: number;
  };
  listPriceMrr: number;
  proOverageMrr: number;
  estimatedMrr: number;
  arpu: number;
  ltvHeuristic: number;
}

interface MonetizationFunnelStep {
  eventName: string;
  label: string;
  totalEvents: number;
  distinctUsers: number;
  distinctSessions: number;
}

interface MonetizationFunnelConv {
  eligible: number;
  converted: number;
  rate: number;
}

interface MonetizationFunnelStats {
  from: string;
  to: string;
  days: number;
  steps: MonetizationFunnelStep[];
  userConversions: {
    pricingToCheckout: MonetizationFunnelConv;
    checkoutToCompleted: MonetizationFunnelConv;
  };
  sessionConversions: {
    pricingToCheckout: MonetizationFunnelConv;
  };
  medianSecondsUser: {
    pricingToCheckout: number | null;
    checkoutToCompleted: number | null;
  };
  conversionNotes: string;
}

interface QualityStats {
  errorsByPage: { page: string; count: number }[];
  totalErrors: number;
  topErrors: { message: string; count: number }[];
  errorsByDay: { date: string; count: number }[];
}

interface RetentionPeriod {
  offset: number;
  activeCount: number;
  retentionRate: number;
}

interface RetentionCohortRow {
  cohortStart: string;
  label: string;
  cohortSize: number;
  periods: RetentionPeriod[];
}

interface RetentionStats {
  from: string;
  to: string;
  granularity: 'week' | 'month';
  maxPeriods: number;
  cohortAnchor: string;
  activeDefinition: string;
  cohorts: RetentionCohortRow[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncateUrl(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

function formatFeatureWowPercent(p: number | null): string {
  if (p == null || Number.isNaN(p)) return '—';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

function adminUiPathLabel(path: AdminAnalyticsUiPath | null): string {
  if (path === '/analytics') return 'Analytics';
  if (path === '/funnel') return 'Funnel';
  if (path === '/app-analytics') return 'APP Analytics';
  return '—';
}

const AnalyticsView: React.FC = () => {
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
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [acquisition, setAcquisition] = useState<AcquisitionStats | null>(null);
  const [authFunnel, setAuthFunnel] = useState<AuthFunnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [acqLoading, setAcqLoading] = useState(true);
  const [authFunnelLoading, setAuthFunnelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acqError, setAcqError] = useState<string | null>(null);
  const [authFunnelError, setAuthFunnelError] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(true);
  const [engagementError, setEngagementError] = useState<string | null>(null);
  const [monetization, setMonetization] = useState<MonetizationStats | null>(null);
  const [monetizationLoading, setMonetizationLoading] = useState(true);
  const [monetizationError, setMonetizationError] = useState<string | null>(null);
  const [monetizationFunnel, setMonetizationFunnel] = useState<MonetizationFunnelStats | null>(
    null
  );
  const [monetizationFunnelLoading, setMonetizationFunnelLoading] = useState(true);
  const [monetizationFunnelError, setMonetizationFunnelError] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityStats | null>(null);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [retention, setRetention] = useState<RetentionStats | null>(null);
  const [retentionLoading, setRetentionLoading] = useState(true);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const [retentionGranularity, setRetentionGranularity] = useState<'week' | 'month'>('week');

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/analytics/overview?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as AnalyticsOverview | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setOverview(data as AnalyticsOverview);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics overview');
        setOverview(null);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, [days]);

  useEffect(() => {
    const fetchAcquisition = async () => {
      try {
        setAcqLoading(true);
        setAcqError(null);
        const res = await fetch(`/api/admin/analytics/acquisition?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as AcquisitionStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setAcquisition(data as AcquisitionStats);
      } catch (err) {
        setAcqError(err instanceof Error ? err.message : 'Failed to load acquisition stats');
        setAcquisition(null);
      } finally {
        setAcqLoading(false);
      }
    };
    fetchAcquisition();
  }, [days]);

  useEffect(() => {
    const fetchAuthFunnel = async () => {
      try {
        setAuthFunnelLoading(true);
        setAuthFunnelError(null);
        const res = await fetch(`/api/admin/analytics/auth-funnel?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as AuthFunnelStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setAuthFunnel(data as AuthFunnelStats);
      } catch (err) {
        setAuthFunnelError(err instanceof Error ? err.message : 'Failed to load auth funnel stats');
        setAuthFunnel(null);
      } finally {
        setAuthFunnelLoading(false);
      }
    };
    fetchAuthFunnel();
  }, [days]);

  useEffect(() => {
    const fetchEngagement = async () => {
      try {
        setEngagementLoading(true);
        setEngagementError(null);
        const res = await fetch(`/api/admin/analytics/engagement?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as EngagementStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setEngagement(data as EngagementStats);
      } catch (err) {
        setEngagementError(err instanceof Error ? err.message : 'Failed to load engagement stats');
        setEngagement(null);
      } finally {
        setEngagementLoading(false);
      }
    };
    fetchEngagement();
  }, [days]);

  useEffect(() => {
    const fetchMonetization = async () => {
      try {
        setMonetizationLoading(true);
        setMonetizationError(null);
        const res = await fetch(`/api/admin/analytics/monetization?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as MonetizationStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setMonetization(data as MonetizationStats);
      } catch (err) {
        setMonetizationError(
          err instanceof Error ? err.message : 'Failed to load monetization stats'
        );
        setMonetization(null);
      } finally {
        setMonetizationLoading(false);
      }
    };
    fetchMonetization();
  }, [days]);

  useEffect(() => {
    const fetchMonetizationFunnel = async () => {
      try {
        setMonetizationFunnelLoading(true);
        setMonetizationFunnelError(null);
        const res = await fetch(`/api/admin/analytics/monetization-funnel?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as MonetizationFunnelStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setMonetizationFunnel(data as MonetizationFunnelStats);
      } catch (err) {
        setMonetizationFunnelError(
          err instanceof Error ? err.message : 'Failed to load monetization funnel'
        );
        setMonetizationFunnel(null);
      } finally {
        setMonetizationFunnelLoading(false);
      }
    };
    fetchMonetizationFunnel();
  }, [days]);

  useEffect(() => {
    const fetchQuality = async () => {
      try {
        setQualityLoading(true);
        setQualityError(null);
        const res = await fetch(`/api/admin/analytics/quality?days=${days}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as QualityStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setQuality(data as QualityStats);
      } catch (err) {
        setQualityError(err instanceof Error ? err.message : 'Failed to load quality stats');
        setQuality(null);
      } finally {
        setQualityLoading(false);
      }
    };
    fetchQuality();
  }, [days]);

  useEffect(() => {
    const fetchRetention = async () => {
      try {
        setRetentionLoading(true);
        setRetentionError(null);
        const res = await fetch(
          `/api/admin/analytics/retention?days=${days}&granularity=${retentionGranularity}&maxPeriods=8`,
          { credentials: 'include' }
        );
        const data = (await res.json()) as RetentionStats | { error?: string };
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Failed to load');
        }
        setRetention(data as RetentionStats);
      } catch (err) {
        setRetentionError(err instanceof Error ? err.message : 'Failed to load retention stats');
        setRetention(null);
      } finally {
        setRetentionLoading(false);
      }
    };
    fetchRetention();
  }, [days, retentionGranularity]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-white/60">
            {overview
              ? `${formatDate(overview.from)} – ${formatDate(overview.to)}`
              : 'Select a range'}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDaysParam(parseAdminAnalyticsDays(e.target.value))}
          className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-white"
          aria-label="Analytics date range"
        >
          {ADMIN_ANALYTICS_DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-white/50">Related dashboards</span>
          <Link
            to={`/funnel?days=${days}`}
            className="rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-[#ffbf00] hover:bg-white/5"
          >
            Activation Funnel
          </Link>
          <span className="text-white/30">·</span>
          <Link
            to={`/app-analytics?days=${days}`}
            className="rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-[#ffbf00] hover:bg-white/5"
          >
            APP Analytics
          </Link>
          <span className="text-white/40">(same {days}-day window)</span>
        </div>
      </div>

      <details className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
        <summary className="cursor-pointer font-medium text-white/90">
          Dataset index (Phase P5)
        </summary>
        <p className="mt-2 text-white/60">
          Registry of APIs and primary tables behind each admin analytics surface. Source:{' '}
          <code className="text-orange-300/90">analytics-datasets-registry.ts</code>.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/70">
                <th className="py-2 pr-2 font-medium">Title</th>
                <th className="py-2 pr-2 font-medium">UI</th>
                <th className="py-2 pr-2 font-medium">Tables</th>
                <th className="py-2 pr-2 font-medium">API</th>
                <th className="py-2 font-medium">Metrics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80">
              {ADMIN_ANALYTICS_DATASETS.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-2 align-top font-medium text-white/90">{row.title}</td>
                  <td className="py-2 pr-2 align-top text-white/60">
                    {adminUiPathLabel(row.adminUiPath)}
                  </td>
                  <td className="py-2 pr-2 align-top font-mono text-[10px] text-white/55">
                    {row.primaryTables.join(', ')}
                  </td>
                  <td className="text-orange-300/80 max-w-[200px] py-2 pr-2 align-top font-mono text-[10px]">
                    {row.apiRoutes.join(', ')}
                  </td>
                  <td className="py-2 align-top text-white/65">{row.metricDefinitions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Overview card */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Overview</h2>
        {loading && <p className="text-white/60">Loading…</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && !error && overview && (
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-sm text-white/60">Total events</p>
              <p className="text-2xl font-semibold">{overview.totalEvents.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Distinct users</p>
              <p className="text-2xl font-semibold">{overview.distinctUsers.toLocaleString()}</p>
            </div>
          </div>
        )}
        {!loading && !error && !overview && <p className="text-white/60">No data</p>}
      </div>

      {/* Acquisition & traffic (Phase 1) */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Acquisition & traffic</h2>
        {acqLoading && <p className="text-white/60">Loading…</p>}
        {acqError && <p className="text-red-400">{acqError}</p>}
        {!acqLoading && !acqError && acquisition && (
          <div className="space-y-8">
            {/* Unique visitors over time */}
            {acquisition.uniqueVisitorsByDay.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">
                  Unique visitors over time
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={acquisition.uniqueVisitorsByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#ffbf00"
                        strokeWidth={2}
                        dot={false}
                        name="Visitors"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid gap-8 md:grid-cols-2">
              {/* Top referrers */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">Top referrers</h3>
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Referrer</th>
                        <th className="px-3 py-2 text-right text-white/80">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {acquisition.topReferrers.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-3 py-4 text-center text-white/50">
                            No referrer data
                          </td>
                        </tr>
                      ) : (
                        acquisition.topReferrers.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-white/80" title={r.referrer}>
                              {truncateUrl(r.referrer, 50)}
                            </td>
                            <td className="px-3 py-2 text-right text-white/70">
                              {r.count.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top landing pages */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">Top landing pages</h3>
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Path</th>
                        <th className="px-3 py-2 text-right text-white/80">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {acquisition.topLandingPages.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-3 py-4 text-center text-white/50">
                            No landing page data
                          </td>
                        </tr>
                      ) : (
                        acquisition.topLandingPages.slice(0, 10).map((p, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-mono text-xs text-white/80">
                              {p.path || '/'}
                            </td>
                            <td className="px-3 py-2 text-right text-white/70">
                              {p.count.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* UTM breakdown */}
            {acquisition.utmBreakdown.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">UTM breakdown</h3>
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Source</th>
                        <th className="px-3 py-2 text-left text-white/80">Medium</th>
                        <th className="px-3 py-2 text-left text-white/80">Campaign</th>
                        <th className="px-3 py-2 text-right text-white/80">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {acquisition.utmBreakdown.slice(0, 15).map((u, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-white/80">{u.source}</td>
                          <td className="px-3 py-2 text-white/80">{u.medium}</td>
                          <td className="px-3 py-2 text-white/80">{u.campaign}</td>
                          <td className="px-3 py-2 text-right text-white/70">
                            {u.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Device & browser */}
            {acquisition.deviceBrowser.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">Device & browser</h3>
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Device</th>
                        <th className="px-3 py-2 text-left text-white/80">Browser</th>
                        <th className="px-3 py-2 text-right text-white/80">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {acquisition.deviceBrowser.slice(0, 10).map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-white/80">{d.device}</td>
                          <td className="px-3 py-2 text-white/80">{d.browser}</td>
                          <td className="px-3 py-2 text-right text-white/70">
                            {d.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Geo */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Geography</h3>
              {acquisition.geo.length === 0 ? (
                <p className="text-white/50">No geo data</p>
              ) : (
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Country</th>
                        <th className="px-3 py-2 text-right text-white/80">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {acquisition.geo.map((g, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-white/80">{g.country}</td>
                          <td className="px-3 py-2 text-right text-white/70">
                            {g.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {!acqLoading && !acqError && !acquisition && (
          <p className="text-white/60">No acquisition data</p>
        )}
      </div>

      {/* Auth & onboarding (Phase 2) */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Auth & onboarding</h2>
        {authFunnelLoading && <p className="text-white/60">Loading…</p>}
        {authFunnelError && <p className="text-red-400">{authFunnelError}</p>}
        {!authFunnelLoading && !authFunnelError && authFunnel && (
          <div className="space-y-8">
            {/* Sign-ins and sign-ups by day */}
            {(authFunnel.signInsByDay.length > 0 || authFunnel.signUpsByDay.length > 0) &&
              (() => {
                const dateSet = new Set<string>();
                authFunnel.signInsByDay.forEach((r) => dateSet.add(r.date));
                authFunnel.signUpsByDay.forEach((r) => dateSet.add(r.date));
                const signInsMap = new Map(authFunnel.signInsByDay.map((r) => [r.date, r.count]));
                const signUpsMap = new Map(authFunnel.signUpsByDay.map((r) => [r.date, r.count]));
                const combined = Array.from(dateSet)
                  .sort()
                  .map((date) => ({
                    date,
                    signIns: signInsMap.get(date) ?? 0,
                    signUps: signUpsMap.get(date) ?? 0,
                  }));
                return (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-white/70">
                      Sign-ins and sign-ups by day
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={combined}
                          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                          />
                          <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(0,0,0,0.8)',
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="signIns"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={false}
                            name="Sign-ins"
                          />
                          <Line
                            type="monotone"
                            dataKey="signUps"
                            stroke="#ffbf00"
                            strokeWidth={2}
                            dot={false}
                            name="Sign-ups"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

            {/* Funnel: visit -> sign_up -> email_confirmed -> first_action */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Conversion funnel</h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded border border-white/10 bg-black/30 px-4 py-2">
                  <p className="text-xs text-white/50">Visit</p>
                  <p className="text-lg font-semibold">
                    {authFunnel.funnel.visit.toLocaleString()}
                  </p>
                </div>
                <span className="text-white/40">→</span>
                <div className="rounded border border-white/10 bg-black/30 px-4 py-2">
                  <p className="text-xs text-white/50">Sign up</p>
                  <p className="text-lg font-semibold">
                    {authFunnel.funnel.signUp.toLocaleString()}
                  </p>
                </div>
                <span className="text-white/40">→</span>
                <div className="rounded border border-white/10 bg-black/30 px-4 py-2">
                  <p className="text-xs text-white/50">Email confirmed</p>
                  <p className="text-lg font-semibold">
                    {authFunnel.funnel.emailConfirmed.toLocaleString()}
                  </p>
                </div>
                <span className="text-white/40">→</span>
                <div className="rounded border border-white/10 bg-black/30 px-4 py-2">
                  <p className="text-xs text-white/50">First action</p>
                  <p className="text-lg font-semibold">
                    {authFunnel.funnel.firstAction.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* OAuth vs email */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">OAuth vs email</h3>
              {authFunnel.oauthVsEmail.oauth > 0 || authFunnel.oauthVsEmail.email > 0 ? (
                <div className="flex items-center gap-8">
                  <div className="h-40 w-40">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'OAuth', value: authFunnel.oauthVsEmail.oauth, fill: '#22c55e' },
                          { name: 'Email', value: authFunnel.oauthVsEmail.email, fill: '#ffbf00' },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </div>
                  <div className="text-sm text-white/70">
                    <p>OAuth: {authFunnel.oauthVsEmail.oauth.toLocaleString()}</p>
                    <p>Email: {authFunnel.oauthVsEmail.email.toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <p className="text-white/50">No auth method data</p>
              )}
            </div>

            {/* TTFKA */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Time to first key action</h3>
              <div className="overflow-hidden rounded border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-white/80">Bucket</th>
                      <th className="px-3 py-2 text-right text-white/80">Users</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="px-3 py-2 text-white/80">Same day</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {authFunnel.ttfkaDistribution.sameDay.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-white/80">1–2 days</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {authFunnel.ttfkaDistribution.oneToTwoDays.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-white/80">3–7 days</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {authFunnel.ttfkaDistribution.threeToSevenDays.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-white/80">7+ days</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {authFunnel.ttfkaDistribution.sevenPlusDays.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-white/80">Never</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {authFunnel.ttfkaDistribution.never.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Minimal onboarding drop-off (Phase P3) */}
            {authFunnel.onboardingDropOff && authFunnel.onboardingDropOff.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">
                  Minimal onboarding drop-off
                </h3>
                <details className="mb-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80">
                  <summary className="cursor-pointer font-medium text-white/90">
                    Metric glossary
                  </summary>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-white/70">
                    <li>
                      <strong>Cohort</strong> — distinct users with{' '}
                      <code className="text-orange-300/90">minimal_onboarding_viewed</code> in the
                      selected date window (same <code className="text-orange-300/90">days</code> as
                      the rest of this page). Requires{' '}
                      <code className="text-orange-300/90">user_id</code> on events.
                    </li>
                    <li>
                      <strong>Completed / Dropped</strong> — sequential milestones in the same
                      window: baseline save → goals ranking save →{' '}
                      <code className="text-orange-300/90">minimal_onboarding_complete</code>. Each
                      row’s <em>completed + dropped</em> equals the eligible set from the prior step
                      (row 1 is entry only; dropped is 0).
                    </li>
                    <li>
                      <strong>Conversion from prior</strong> —{' '}
                      <code className="text-orange-300/90">completed ÷ (completed + dropped)</code>{' '}
                      for that row; em dash for the first row.
                    </li>
                    <li>
                      Users who finished onboarding before step events were added, or without a{' '}
                      <em>viewed</em> event in range, are not counted in this cohort (no backfill).
                    </li>
                  </ul>
                </details>
                <div className="overflow-hidden overflow-x-auto rounded border border-white/10">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Step</th>
                        <th className="px-3 py-2 text-right text-white/80">Completed</th>
                        <th className="px-3 py-2 text-right text-white/80">Dropped</th>
                        <th className="px-3 py-2 text-right text-white/80">
                          Conversion from prior
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {authFunnel.onboardingDropOff.map((row, i) => {
                        const denom = row.completed + row.dropped;
                        const ratePct =
                          i === 0 || denom <= 0
                            ? null
                            : Math.round((row.completed / denom) * 1000) / 10;
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2 text-white/80">{row.step}</td>
                            <td className="px-3 py-2 text-right text-white/70">
                              {row.completed.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-white/70">
                              {row.dropped.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-white/70">
                              {ratePct != null ? `${ratePct}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {!authFunnelLoading && !authFunnelError && !authFunnel && (
          <p className="text-white/60">No auth funnel data</p>
        )}
      </div>

      {/* Engagement (Phase 3) */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Engagement</h2>
        {engagementLoading && <p className="text-white/60">Loading…</p>}
        {engagementError && <p className="text-red-400">{engagementError}</p>}
        {!engagementLoading && !engagementError && engagement && (
          <div className="space-y-8">
            {/* DAU over time */}
            {engagement.dauByDay.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">DAU over time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={engagement.dauByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#ffbf00"
                        strokeWidth={2}
                        dot={false}
                        name="DAU"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* DAU / WAU / MAU / Stickiness cards */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Active users</h3>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">DAU</p>
                  <p className="text-xl font-semibold">{engagement.dau.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">WAU</p>
                  <p className="text-xl font-semibold">{engagement.wau.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">MAU</p>
                  <p className="text-xl font-semibold">{engagement.mau.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Stickiness</p>
                  <p className="text-xl font-semibold">
                    {engagement.mau > 0 ? `${(engagement.stickiness * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Session stats */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Sessions</h3>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Session count</p>
                  <p className="text-xl font-semibold">
                    {engagement.sessionCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Avg duration (min)</p>
                  <p className="text-xl font-semibold">
                    {engagement.avgSessionDurationMinutes.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Avg pages per session</p>
                  <p className="text-xl font-semibold">
                    {engagement.avgPagesPerSession.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* Feature activity (Phase P4) */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Feature activity</h3>
              <details className="mb-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80">
                <summary className="cursor-pointer font-medium text-white/90">
                  Metric glossary
                </summary>
                <ul className="mt-2 list-inside list-disc space-y-1 text-white/70">
                  <li>
                    Rows aggregate all <code className="text-orange-300/90">analytics_events</code>{' '}
                    whose <code className="text-orange-300/90">event_name</code> belongs to that
                    feature (see{' '}
                    <code className="text-orange-300/90">feature-activity-catalog.ts</code>).
                  </li>
                  <li>
                    <strong>WoW</strong> compares the last 7 days to the <em>prior</em> 7 days (same
                    rolling definition as the 7d column). Em dash when the prior window had zero
                    events.
                  </li>
                  <li>
                    <strong>Trend</strong> sparkline uses up to 14 days ending today (from the
                    page&apos;s <code className="text-orange-300/90">days</code> control),
                    aggregated in SQL via{' '}
                    <code className="text-orange-300/90">get_feature_activity_daily</code>.
                  </li>
                </ul>
              </details>
              <div className="overflow-hidden overflow-x-auto rounded border border-white/10">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-white/80">Feature</th>
                      <th className="px-3 py-2 text-left text-white/80">Surface</th>
                      <th className="px-3 py-2 text-right text-white/80">7d</th>
                      <th className="px-3 py-2 text-right text-white/80">30d</th>
                      <th className="px-3 py-2 text-right text-white/80">WoW</th>
                      <th className="px-3 py-2 text-left text-white/80">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {engagement.featureActivity.map((row) => {
                      const trend =
                        engagement.featureActivityTrends.find((t) => t.featureId === row.featureId)
                          ?.points ?? [];
                      return (
                        <tr key={row.featureId}>
                          <td className="px-3 py-2 font-medium text-white/90">{row.name}</td>
                          <td className="max-w-[200px] px-3 py-2 text-xs text-white/60">
                            {row.surface}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-white/70">
                            {row.count7d.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-white/70">
                            {row.count30d.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-white/70">
                            {formatFeatureWowPercent(row.wowPercent)}
                          </td>
                          <td className="w-28 px-1 py-1">
                            <div className="h-9 w-24">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={trend}
                                  margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                                >
                                  <XAxis dataKey="date" hide />
                                  <YAxis hide domain={[0, 'auto']} />
                                  <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#ffbf00"
                                    strokeWidth={1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {engagement.eventVolumeByAppId7d.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-medium text-white/50">
                    Event volume by <code className="text-orange-300/80">app_id</code> (7d, known
                    IDs)
                  </h4>
                  <div className="overflow-x-auto rounded border border-white/10">
                    <table className="w-full max-w-md text-xs">
                      <tbody className="divide-y divide-white/5">
                        {engagement.eventVolumeByAppId7d.map((r) => (
                          <tr key={r.appId}>
                            <td className="px-2 py-1 font-mono text-white/70">{r.appId}</td>
                            <td className="px-2 py-1 text-right tabular-nums text-white/60">
                              {r.count7d.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Power-user distribution */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">
                Power-user distribution (catalog key events)
              </h3>
              {engagement.powerUserDistribution.some((b) => b.count > 0) ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={engagement.powerUserDistribution}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                      <Bar dataKey="count" fill="#ffbf00" name="Users" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-white/50">No power-user data in range</p>
              )}
            </div>
          </div>
        )}
        {!engagementLoading && !engagementError && !engagement && (
          <p className="text-white/60">No engagement data</p>
        )}
      </div>

      {/* Retention & cohorts */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading text-xl font-bold">Retention & cohorts</h2>
          <select
            value={retentionGranularity}
            onChange={(e) => setRetentionGranularity(e.target.value === 'month' ? 'month' : 'week')}
            className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-white"
            aria-label="Retention cohort granularity"
          >
            <option value="week">Weekly cohorts</option>
            <option value="month">Monthly cohorts</option>
          </select>
        </div>

        <details className="mb-4 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
          <summary className="cursor-pointer font-medium text-white/90">Metric glossary</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-white/70">
            <li>
              <strong>Cohort</strong> = users with a profile created in the selected date range (
              {days}-day window ending today). Cohort bucket is the UTC start of the signup week or
              month from <code className="text-orange-300/90">profiles.created_at</code> (not{' '}
              <code className="text-orange-300/90">account_signup_complete</code>).
            </li>
            <li>
              <strong>Active</strong> in period <em>n</em> = at least one event in{' '}
              <code className="text-orange-300/90">analytics_events</code> or{' '}
              <code className="text-orange-300/90">web_events</code> in that calendar week/month (
              same granularity), with <code className="text-orange-300/90">user_id</code> set
              (anonymous sessions excluded).
            </li>
            <li>
              <strong>Retention rate</strong> = active users in that period ÷ cohort size. Period 0
              is the signup bucket itself.
            </li>
          </ul>
        </details>

        {retentionLoading && <p className="text-white/60">Loading…</p>}
        {retentionError && <p className="text-red-400">{retentionError}</p>}
        {!retentionLoading && !retentionError && retention && retention.cohorts.length === 0 && (
          <p className="text-white/60">No cohorts in this range (no profile signups).</p>
        )}
        {!retentionLoading && !retentionError && retention && retention.cohorts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border border-white/10 bg-black/40 px-2 py-2 text-left text-white/80">
                    Cohort (n)
                  </th>
                  {retention.cohorts[0]?.periods.map((p) => (
                    <th
                      key={p.offset}
                      className="border border-white/10 bg-black/30 px-2 py-2 text-center text-white/80"
                    >
                      {retention.granularity === 'week' ? 'W' : 'M'}
                      {p.offset}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.cohorts.map((row) => (
                  <tr key={row.label}>
                    <td className="sticky left-0 z-10 border border-white/10 bg-black/40 px-2 py-2 font-mono text-xs text-white/90">
                      {row.label}
                      <span className="text-white/50"> ({row.cohortSize})</span>
                    </td>
                    {row.periods.map((p) => {
                      const pct = Math.round(p.retentionRate * 1000) / 10;
                      const bg = `rgba(255, 191, 0, ${0.12 + p.retentionRate * 0.55})`;
                      return (
                        <td
                          key={p.offset}
                          className="border border-white/10 px-1 py-1 text-center tabular-nums text-white/90"
                          style={{ backgroundColor: bg }}
                          title={`${p.activeCount} / ${row.cohortSize} active`}
                        >
                          {row.cohortSize > 0 ? `${pct}%` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!retentionLoading && !retentionError && !retention && (
          <p className="text-white/60">No retention data</p>
        )}
      </div>

      {/* Monetization (Phase 5) */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Monetization</h2>

        {/* Monetization funnel (Phase P2 — descriptive) */}
        <div className="mb-8 rounded-lg border border-white/10 bg-black/30 p-4">
          <h3 className="mb-2 font-heading text-lg font-semibold text-white">
            Monetization funnel
          </h3>
          <details className="mb-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
            <summary className="cursor-pointer font-medium text-white/90">Metric glossary</summary>
            <ul className="mt-2 list-inside list-disc space-y-1 text-white/70">
              <li>
                <strong>Pricing viewed</strong> — home page{' '}
                <code className="text-orange-300/90">#pricing</code> entered viewport (client).
              </li>
              <li>
                <strong>Checkout started</strong> — user clicked a tier CTA toward Stripe (client);{' '}
                <code className="text-orange-300/90">plan_id</code> /{' '}
                <code className="text-orange-300/90">purchased_index</code> in properties match{' '}
                <code className="text-orange-300/90">pricing.ts</code>.
              </li>
              <li>
                <strong>Checkout completed</strong> — Stripe{' '}
                <code className="text-orange-300/90">checkout.session.completed</code> (server
                webhook). <code className="text-orange-300/90">user_id</code> is set only if
                Checkout includes <code className="text-orange-300/90">client_reference_id</code> or
                metadata <code className="text-orange-300/90">supabase_user_id</code> /{' '}
                <code className="text-orange-300/90">user_id</code> (UUID). Payment Links without
                this stay anonymous for the completed step.
              </li>
              <li>
                <strong>User vs session conversion</strong> — logged-in users use{' '}
                <code className="text-orange-300/90">user_id</code>; anonymous pricing/checkout
                pairs use <code className="text-orange-300/90">session_id</code> for the session row
                only.
              </li>
            </ul>
          </details>
          {monetizationFunnelLoading && <p className="text-white/60">Loading funnel…</p>}
          {monetizationFunnelError && <p className="text-red-400">{monetizationFunnelError}</p>}
          {!monetizationFunnelLoading && !monetizationFunnelError && monetizationFunnel && (
            <div className="space-y-4 text-sm">
              <p className="text-white/50">
                Window: {formatDate(monetizationFunnel.from)} — {formatDate(monetizationFunnel.to)}{' '}
                ({monetizationFunnel.days} days)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/70">
                      <th className="py-2 pr-2">Step</th>
                      <th className="py-2 pr-2 text-right">Events</th>
                      <th className="py-2 pr-2 text-right">Distinct users</th>
                      <th className="py-2 text-right">Distinct sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monetizationFunnel.steps.map((s) => (
                      <tr key={s.eventName} className="border-b border-white/5 text-white/90">
                        <td className="py-2 pr-2">{s.label}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {s.totalEvents.toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {s.distinctUsers.toLocaleString()}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {s.distinctSessions.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 font-medium text-white/90">User conversions (user_id)</p>
                  <p className="text-white/70">
                    Pricing → checkout:{' '}
                    {(monetizationFunnel.userConversions.pricingToCheckout.rate * 100).toFixed(1)}%
                    (
                    {monetizationFunnel.userConversions.pricingToCheckout.converted.toLocaleString()}{' '}
                    /{' '}
                    {monetizationFunnel.userConversions.pricingToCheckout.eligible.toLocaleString()}
                    )
                  </p>
                  <p className="text-white/70">
                    Checkout → completed:{' '}
                    {(monetizationFunnel.userConversions.checkoutToCompleted.rate * 100).toFixed(1)}
                    % (
                    {monetizationFunnel.userConversions.checkoutToCompleted.converted.toLocaleString()}{' '}
                    /{' '}
                    {monetizationFunnel.userConversions.checkoutToCompleted.eligible.toLocaleString()}
                    )
                  </p>
                </div>
                <div className="rounded border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 font-medium text-white/90">Session conversions (anonymous)</p>
                  <p className="text-white/70">
                    Pricing → checkout:{' '}
                    {(monetizationFunnel.sessionConversions.pricingToCheckout.rate * 100).toFixed(
                      1
                    )}
                    % (
                    {monetizationFunnel.sessionConversions.pricingToCheckout.converted.toLocaleString()}{' '}
                    /{' '}
                    {monetizationFunnel.sessionConversions.pricingToCheckout.eligible.toLocaleString()}
                    )
                  </p>
                </div>
              </div>
              <div className="rounded border border-white/10 bg-black/20 p-3 text-white/70">
                <p className="mb-1 font-medium text-white/90">
                  Median seconds (users with both steps)
                </p>
                <p>
                  Pricing → checkout:{' '}
                  {monetizationFunnel.medianSecondsUser.pricingToCheckout != null
                    ? `${Math.round(monetizationFunnel.medianSecondsUser.pricingToCheckout)}s`
                    : '—'}
                </p>
                <p>
                  Checkout → completed:{' '}
                  {monetizationFunnel.medianSecondsUser.checkoutToCompleted != null
                    ? `${Math.round(monetizationFunnel.medianSecondsUser.checkoutToCompleted)}s`
                    : '—'}
                </p>
              </div>
              <p className="text-xs text-white/50">{monetizationFunnel.conversionNotes}</p>
            </div>
          )}
        </div>

        <details className="mb-4 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
          <summary className="cursor-pointer font-medium text-white/90">
            HIIT Ecosystem pricing (product reference)
          </summary>
          <p className="mt-2 text-white/70">
            Value-based scaling: from self-tracking to client management. List prices map to{' '}
            <code className="text-orange-300/90">profiles.purchased_index</code> for admin KPIs (0–3
            Athlete–Studio; 4 Coach Pro legacy; 5 Studio Pro). Est. MRR adds Pro client overage when{' '}
            <code className="text-orange-300/90">profile_billing_snapshot.active_client_count</code>{' '}
            is populated.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-white/70">
            <li>
              <strong>Athlete</strong> ($9.99/mo) — Brain-driven solo tier; 7-day calibration trial
              before first charge; capped monthly AI generation credits.
            </li>
            <li>
              <strong>Host</strong> ($24.99/mo) — Social retention; invite up to 5 Buddies; private
              leaderboard.
            </li>
            <li>
              <strong>Pro</strong> ($49.99/mo base) — Up to 30 paid client slots; +$1/mo per active
              client beyond 30 included in summary MRR when billing snapshot reports{' '}
              <code className="text-orange-300/90">active_client_count</code>. Unlimited AI for the
              practice.
            </li>
            <li>
              <strong>Studio</strong> ($199.99/mo list) — Multi-trainer / boutique; admin analytics;
              first location baseline; multi-location pricing TBD in billing.
            </li>
            <li>
              <strong>Coach Pro (legacy)</strong> ($199/mo list, index 4) — Pre-matrix subscribers;
              reconcile in Stripe when possible.
            </li>
            <li>
              <strong>Studio Pro</strong> ($299.99/mo list, index 5) — Distinct tier; align list
              price with Stripe catalog.
            </li>
          </ul>
        </details>
        {monetizationLoading && <p className="text-white/60">Loading…</p>}
        {monetizationError && <p className="text-red-400">{monetizationError}</p>}
        {!monetizationLoading && !monetizationError && monetization && (
          <div className="space-y-8">
            {/* KPI cards */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Summary</h3>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Active paid</p>
                  <p className="text-xl font-semibold">
                    {monetization.activePaidCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Active trial</p>
                  <p className="text-xl font-semibold">
                    {monetization.activeTrialCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Trial conversion</p>
                  <p className="text-xl font-semibold">
                    {monetization.trialEligible > 0
                      ? `${(monetization.trialConversionRate * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Est. MRR</p>
                  <p className="text-xl font-semibold">${monetization.estimatedMrr.toFixed(2)}</p>
                  {monetization.proOverageMrr > 0 && (
                    <p className="mt-1 text-xs text-white/45">
                      List ${monetization.listPriceMrr.toFixed(2)} + Pro overage $
                      {monetization.proOverageMrr.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">ARPU</p>
                  <p className="text-xl font-semibold">${monetization.arpu.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">LTV heuristic</p>
                  <p className="text-xl font-semibold">${monetization.ltvHeuristic.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Plan mix */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Paid users by plan</h3>
              <div className="overflow-hidden rounded border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-white/80">Plan</th>
                      <th className="px-3 py-2 text-right text-white/80">Count</th>
                      <th className="px-3 py-2 text-right text-white/80">Price</th>
                      <th className="px-3 py-2 text-right text-white/80">Est. MRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {monetization.activeByPlan.map((row) => (
                      <tr key={row.planIndex}>
                        <td className="px-3 py-2 text-white/80">{row.planName}</td>
                        <td className="px-3 py-2 text-right text-white/70">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-white/70">
                          ${row.price.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-white/70">
                          ${(row.count * row.price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Time to convert (TTFC) */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Time to convert (TTFC)</h3>
              <div className="overflow-hidden rounded border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-white/80">Bucket</th>
                      <th className="px-3 py-2 text-right text-white/80">Users</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="px-3 py-2 text-white/80">Same day</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {monetization.ttfcDistribution.sameDay.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-white/80">1–2 days</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {monetization.ttfcDistribution.oneToTwoDays.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-white/80">3–7 days</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {monetization.ttfcDistribution.threeToSevenDays.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-white/80">7+ days</td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {monetization.ttfcDistribution.sevenPlusDays.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {!monetizationLoading && !monetizationError && !monetization && (
          <p className="text-white/60">No monetization data</p>
        )}
      </div>

      {/* Quality & reliability (Phase 6) */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Quality & reliability</h2>
        {qualityLoading && <p className="text-white/60">Loading…</p>}
        {qualityError && <p className="text-red-400">{qualityError}</p>}
        {!qualityLoading && !qualityError && quality && quality.totalErrors === 0 && (
          <p className="text-white/60">No frontend errors in range</p>
        )}
        {!qualityLoading && !qualityError && quality && quality.totalErrors > 0 && (
          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Summary</h3>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Total errors</p>
                  <p className="text-xl font-semibold">{quality.totalErrors.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-xs text-white/50">Top page</p>
                  <p className="text-xl font-semibold">
                    {quality.errorsByPage.length > 0
                      ? quality.errorsByPage[0].page || 'Unknown'
                      : '—'}
                  </p>
                  {quality.errorsByPage.length > 0 && (
                    <p className="text-xs text-white/50">
                      {quality.errorsByPage[0].count.toLocaleString()} errors
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">Errors by page</h3>
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Page</th>
                        <th className="px-3 py-2 text-right text-white/80">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {quality.errorsByPage.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono text-xs text-white/80">
                            {row.page || 'Unknown'}
                          </td>
                          <td className="px-3 py-2 text-right text-white/70">
                            {row.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">Top errors</h3>
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Message</th>
                        <th className="px-3 py-2 text-right text-white/80">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {quality.topErrors.map((row, i) => (
                        <tr key={i}>
                          <td
                            className="px-3 py-2 font-mono text-xs text-white/80"
                            title={row.message}
                          >
                            {truncateUrl(row.message, 60)}
                          </td>
                          <td className="px-3 py-2 text-right text-white/70">
                            {row.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {quality.errorsByDay.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">Errors over time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={quality.errorsByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        name="Errors"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
        {!qualityLoading && !qualityError && !quality && (
          <p className="text-white/60">No quality data</p>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;
