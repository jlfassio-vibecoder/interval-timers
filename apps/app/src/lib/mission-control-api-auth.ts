/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Optional Bearer header for Mission Control SPA calls to /api/trainer/*.
 * Server routes use extractAccessToken (cookie or Authorization). Some environments
 * (embedded browsers, strict cookie policies) omit sb-access-token while Supabase
 * still has an in-memory session — mirroring admin persistence patterns.
 */

import { supabase } from '@/lib/supabase/supabase-instance';

export async function missionControlApiAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}
