/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analytics dashboard shell (Phase 0). Overview from analytics_events; Phase 1 Acquisition section.
 */

import React, { useState, useEffect } from 'react';
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
  Cell,
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
  featureAdoption: { eventName: string; count7d: number; count30d: number }[];
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
  estimatedMrr: number;
  arpu: number;
  ltvHeuristic: number;
}

interface QualityStats {
  errorsByPage: { page: string; count: number }[];
  totalErrors: number;
  topErrors: { message: string; count: number }[];
  errorsByDay: { date: string; count: number }[];
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

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-6">
      <h2 className="mb-2 font-heading text-xl font-bold">{title}</h2>
      <p className="text-white/60">Coming soon</p>
    </div>
  );
}

const AnalyticsView: React.FC = () => {
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
  const [quality, setQuality] = useState<QualityStats | null>(null);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

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
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-white"
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

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
                          { name: 'OAuth', value: authFunnel.oauthVsEmail.oauth, color: '#22c55e' },
                          { name: 'Email', value: authFunnel.oauthVsEmail.email, color: '#ffbf00' },
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
                      >
                        {[{ color: '#22c55e' }, { color: '#ffbf00' }].map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
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

            {/* Onboarding drop-off (optional) */}
            {authFunnel.onboardingDropOff && authFunnel.onboardingDropOff.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">Onboarding drop-off</h3>
                <div className="overflow-hidden rounded border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-white/80">Step</th>
                        <th className="px-3 py-2 text-right text-white/80">Completed</th>
                        <th className="px-3 py-2 text-right text-white/80">Dropped</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {authFunnel.onboardingDropOff.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-white/80">{row.step}</td>
                          <td className="px-3 py-2 text-right text-white/70">
                            {row.completed.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-white/70">
                            {row.dropped.toLocaleString()}
                          </td>
                        </tr>
                      ))}
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

            {/* Feature adoption */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">Feature adoption</h3>
              <div className="overflow-hidden rounded border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-white/80">Event</th>
                      <th className="px-3 py-2 text-right text-white/80">Last 7 days</th>
                      <th className="px-3 py-2 text-right text-white/80">Last 30 days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {engagement.featureAdoption.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs text-white/80">
                          {row.eventName}
                        </td>
                        <td className="px-3 py-2 text-right text-white/70">
                          {row.count7d.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-white/70">
                          {row.count30d.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Power-user distribution */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white/70">
                Power-user distribution (key events)
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

      {/* Placeholder sections for future phases */}
      <PlaceholderSection title="Retention & cohorts" />

      {/* Monetization (Phase 5) */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 font-heading text-xl font-bold">Monetization</h2>
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
