/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fires trackPageView on mount (Astro full page) or when pathname changes (React Router).
 */

import React, { useEffect } from 'react';
import { trackPageView } from '@interval-timers/analytics';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/supabase-instance';

interface PageViewTrackerProps {
  /** Defaults to app client when omitted (e.g. in BaseLayout). */
  supabase?: SupabaseClient;
  /** When set, fire on every pathname change (use inside React Router). Otherwise fire once on mount. */
  pathname?: string;
  appId?: string;
}

/**
 * Call trackPageView on mount, or whenever pathname changes when pathname is provided.
 */
const PageViewTracker: React.FC<PageViewTrackerProps> = ({
  supabase: supabaseProp,
  pathname,
  appId,
}) => {
  const client = supabaseProp ?? supabase;
  useEffect(
    () => {
      trackPageView(client, { appId });
    },
    [pathname, client, appId]
  );

  return null;
};

export default PageViewTracker;
