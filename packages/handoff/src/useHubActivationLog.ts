import { useEffect, useRef } from 'react';
import { logHubActivation } from './logHubActivation';

/**
 * Call on app mount to log hub timer activation when loaded with ?from_hub=1&app_id=X.
 * Only logs when user has an active Supabase session.
 *
 * @param supabase - Supabase client with rpc and auth
 * @param onMilestone - Optional callback when first or second timer launch is recorded (for analytics)
 */
export function useHubActivationLog(
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    auth: { getSession: () => Promise<{ data: { session: unknown } }> };
  },
  onMilestone?: (milestone: 'first' | 'second', appId: string) => void
): void {
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromHub = params.get('from_hub');
    const appId = params.get('app_id');
    if (fromHub !== '1' || !appId) return;

    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || logged.current || !session) return;
      logged.current = true;
      logHubActivation(supabase, appId).then((milestone) => {
        if (milestone) onMilestone?.(milestone, appId);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, onMilestone]);
}
