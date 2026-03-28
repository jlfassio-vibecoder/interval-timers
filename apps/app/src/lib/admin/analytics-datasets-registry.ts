/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight registry of admin analytics datasets: APIs, primary tables, and metric intent.
 * Single map for product and future Growth Engine / analytics-datasets layers.
 */

export type AdminAnalyticsUiPath = '/analytics' | '/funnel' | '/app-analytics';

export interface AdminAnalyticsDataset {
  id: string;
  title: string;
  adminUiPath: AdminAnalyticsUiPath | null;
  sectionHint: string;
  apiRoutes: readonly string[];
  primaryTables: readonly string[];
  metricDefinitions: string;
}

export const ADMIN_ANALYTICS_DATASETS: readonly AdminAnalyticsDataset[] = [
  {
    id: 'overview',
    title: 'Overview',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Overview',
    apiRoutes: ['/api/admin/analytics/overview'],
    primaryTables: ['analytics_events'],
    metricDefinitions:
      'Total event rows and exact COUNT(DISTINCT user_id) via get_admin_analytics_overview. See docs/ADMIN_ANALYTICS.md §Scalability & aggregation (Phase P6).',
  },
  {
    id: 'acquisition',
    title: 'Acquisition & traffic',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Acquisition',
    apiRoutes: ['/api/admin/analytics/acquisition'],
    primaryTables: ['web_events'],
    metricDefinitions:
      'Unique visitors, referrers, UTM, landing pages, device/browser, and geo via get_acquisition_stats RPC.',
  },
  {
    id: 'auth-funnel',
    title: 'Auth & onboarding',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Auth funnel',
    apiRoutes: ['/api/admin/analytics/auth-funnel'],
    primaryTables: ['analytics_events', 'web_events'],
    metricDefinitions:
      'Sign-ups via listUsers; visit/first-action/TTFKA/sign-in rollups via get_auth_funnel_visit_count + get_auth_funnel_activation_stats; minimal onboarding from get_minimal_onboarding_dropoff. See §Scalability (P6) in ADMIN_ANALYTICS.md for TTFKA definition.',
  },
  {
    id: 'engagement',
    title: 'Engagement',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Engagement',
    apiRoutes: ['/api/admin/analytics/engagement'],
    primaryTables: ['analytics_events', 'web_events'],
    metricDefinitions:
      'DAU/WAU/MAU via get_engagement_dau_series; sessions via get_engagement_web_session_stats; feature 7d/30d/WoW + get_feature_activity_daily trends; power-user buckets still capped (10k). See ADMIN_ANALYTICS.md §Scalability (P6).',
  },
  {
    id: 'retention',
    title: 'Retention & cohorts',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Retention',
    apiRoutes: ['/api/admin/analytics/retention'],
    primaryTables: ['profiles', 'analytics_events', 'web_events'],
    metricDefinitions:
      'Cohort matrix by profiles.created_at week/month; active if any analytics_events or web_events with user_id in period; rates = active ÷ cohort size.',
  },
  {
    id: 'monetization-kpis',
    title: 'Monetization KPIs',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Monetization (profiles)',
    apiRoutes: ['/api/admin/analytics/monetization'],
    primaryTables: ['profiles', 'profile_billing_snapshot'],
    metricDefinitions:
      'Paid/trial counts from profiles (purchased_index 0–5: Athlete through Studio Pro), trial conversion, TTFC, listPriceMrr + optional proOverageMrr from profile_billing_snapshot.active_client_count (Pro), estimatedMrr, ARPU/LTV heuristic. See docs/ADMIN_ANALYTICS.md §Estimated MRR.',
  },
  {
    id: 'monetization-funnel',
    title: 'Monetization funnel',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Monetization funnel',
    apiRoutes: ['/api/admin/analytics/monetization-funnel'],
    primaryTables: ['analytics_events'],
    metricDefinitions:
      'Descriptive funnel: pricing viewed → checkout started → checkout completed (Stripe webhook); user and session conversion rates and median inter-step seconds.',
  },
  {
    id: 'quality',
    title: 'Quality & reliability',
    adminUiPath: '/analytics',
    sectionHint: 'Analytics — Quality',
    apiRoutes: ['/api/admin/analytics/quality'],
    primaryTables: ['errors_frontend'],
    metricDefinitions:
      'Frontend errors by page, message, and day via get_errors_frontend_rollups (ADMIN_ANALYTICS.md §Scalability P6).',
  },
  {
    id: 'activation-funnel',
    title: 'Activation Funnel',
    adminUiPath: '/funnel',
    sectionHint: 'Funnel view',
    apiRoutes: ['/api/admin/funnel-stats'],
    primaryTables: ['analytics_events'],
    metricDefinitions:
      'Timer save, account handoff, signup/login, session prefill; hub launches via get_funnel_hub_launch_stats. By-source breakdown still loads event rows in TS.',
  },
  {
    id: 'app-hub-paste',
    title: 'APP Analytics (Hub paste & handoff)',
    adminUiPath: '/app-analytics',
    sectionHint: 'APP Analytics',
    apiRoutes: ['/api/admin/analytics/hub-paste'],
    primaryTables: ['analytics_events'],
    metricDefinitions:
      'Universal Activity Hub anonymous funnel: parse success/fail, actions, handoff outcomes; app_id universal_activity_hub. Capped fetches log [admin-analytics-cap] when hit (ADMIN_ANALYTICS.md §Scalability P6).',
  },
] as const;
