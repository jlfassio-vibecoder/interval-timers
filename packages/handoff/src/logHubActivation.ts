/**
 * Call Supabase RPC to log hub timer activation (first and second within 48h).
 * Requires authenticated user; RPC no-ops if not logged in.
 * Returns 'first' | 'second' when a milestone was recorded, null otherwise.
 *
 * @param supabase - Supabase client with rpc method (e.g. from createClient)
 * @param appId - App ID from launcher (tabata, daily-warmup, amrap, etc.)
 */
export async function logHubActivation(
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  appId: string
): Promise<'first' | 'second' | null> {
  const { data, error } = await supabase.rpc('log_hub_timer_activation', { p_app_id: appId });
  if (error && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn('[logHubActivation]', error);
  }
  return data === 'first' || data === 'second' ? (data as 'first' | 'second') : null;
}
