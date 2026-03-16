/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Acquisition stats from web_events: unique visitors, referrers, UTM, landing pages, device/browser, geo.
 */

import { getSupabaseServer } from '../server';

export interface AcquisitionStats {
  uniqueVisitorsByDay: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  utmBreakdown: { source: string; medium: string; campaign: string; count: number }[];
  topLandingPages: { path: string; count: number }[];
  deviceBrowser: { device: string; browser: string; count: number }[];
  geo: { country: string; count: number }[];
}

export async function getAcquisitionStats(days: number): Promise<AcquisitionStats> {
  const supabase = getSupabaseServer();

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_acquisition_stats', {
    p_days: days,
  });

  if (rpcError) throw rpcError;

  const raw = (rpcData ?? {}) as {
    uniqueVisitorsByDay?: { date: string; count: number }[] | null;
    topReferrers?: { referrer: string; count: number }[] | null;
    utmBreakdown?: { source: string; medium: string; campaign: string; count: number }[] | null;
    topLandingPages?: { path: string; count: number }[] | null;
    deviceBrowser?: { device: string; browser: string; count: number }[] | null;
    geo?: { country: string; count: number }[] | null;
  };

  const result: AcquisitionStats = {
    uniqueVisitorsByDay: Array.isArray(raw.uniqueVisitorsByDay) ? raw.uniqueVisitorsByDay : [],
    topReferrers: Array.isArray(raw.topReferrers) ? raw.topReferrers : [],
    utmBreakdown: Array.isArray(raw.utmBreakdown) ? raw.utmBreakdown : [],
    topLandingPages: Array.isArray(raw.topLandingPages) ? raw.topLandingPages : [],
    deviceBrowser: [],
    geo: Array.isArray(raw.geo) ? raw.geo : [],
  };

  // Device/browser: fetch user_agent and parse (RPC doesn't parse UA)
  try {
    const { UAParser } = await import('ua-parser-js');
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { data: rows } = await supabase
      .from('web_events')
      .select('user_agent')
      .gte('occurred_at', fromDate.toISOString())
      .not('user_agent', 'is', null)
      .limit(5000);

    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      const ua = (row as { user_agent?: string }).user_agent;
      if (!ua) continue;
      const parser = new UAParser(ua);
      const dev = parser.getDevice();
      const device = dev.type || dev.vendor || 'desktop';
      const browser = parser.getBrowser().name || 'unknown';
      const key = `${device}|${browser}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    result.deviceBrowser = Array.from(map.entries())
      .map(([key, count]) => {
        const [device, browser] = key.split('|');
        return { device, browser, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  } catch {
    // leave deviceBrowser as []
  }

  return result;
}
