/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin login gate: shows "Admin Login" message, auto-opens AuthModal when
 * unauthenticated, and redirects to /admin after successful login.
 * Uses Supabase Auth (no useAppContext) to avoid SSR issues.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';
import { adminPaths } from '@/lib/admin/config';
import { setAuthCookie } from '@/lib/auth-cookie';

type AccessDeniedReason = 'no_profile' | 'wrong_role' | null;

const AdminLoginGate: React.FC = () => {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [accessDenied, setAccessDenied] = useState<AccessDeniedReason>(null);
  const [retrying, setRetrying] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setCheckingAdmin(false);
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAccessDenied(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checkingAdmin) return;
    if (!user && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showAuthModal'));
    }
  }, [user, checkingAdmin]);

  const checkAndRedirect = useCallback(async () => {
    if (!user) return;
    setAccessDenied(null);
    setProfileError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      setAccessDenied('no_profile');
      setProfileError(error.message);
      return;
    }

    const role = (profile?.role ?? '').toString().trim().toLowerCase();
    if (role === 'admin' || role === 'trainer') {
      setAuthCookie(session);
      window.location.href = adminPaths.root;
    } else if (!profile) {
      setAccessDenied('no_profile');
    } else {
      setAccessDenied('wrong_role');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    checkAndRedirect();
  }, [user, checkAndRedirect]);

  const handleRetry = async () => {
    setRetrying(true);
    await supabase.auth.refreshSession();
    await checkAndRedirect();
    setRetrying(false);
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold text-white md:text-3xl">Admin Login</h1>
      <p className="mt-2 text-white/80">Please sign in to continue.</p>
      {!user && (
        <p className="mt-4 text-sm text-white/60">
          The sign-in modal should open automatically. If it doesn&apos;t, try refreshing the page.
        </p>
      )}
      {user && accessDenied && (
        <div className="mt-4 max-w-lg space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {accessDenied === 'no_profile' ? (
            <>
              <p>
                <strong>No profile found</strong> for your account.
              </p>
              <p className="text-amber-200/90">
                Your user ID:{' '}
                <code className="break-all rounded bg-black/20 px-1 font-mono text-xs">
                  {user.id}
                </code>
              </p>
              <p className="text-amber-200/90">
                App is connected to:{' '}
                <code className="break-all rounded bg-black/20 px-1 font-mono text-xs">
                  {import.meta.env.PUBLIC_SUPABASE_URL ||
                    import.meta.env.VITE_SUPABASE_URL ||
                    import.meta.env.SUPABASE_URL ||
                    '' ||
                    '(not set)'}
                </code>
              </p>
              <p className="text-xs text-amber-200/80">
                Run the SQL below in the <strong>same</strong> Supabase project. If the URL above is{' '}
                <code className="rounded bg-black/20 px-1">http://127.0.0.1:54321</code>, you must
                run SQL in your <strong>local</strong> project (e.g.{' '}
                <code className="rounded bg-black/20 px-1">npx supabase db execute</code> or local
                Studio at :54323), not the hosted dashboard.
              </p>
              <p>
                Create the profile by running this in Supabase → SQL Editor (same project your app
                uses):
              </p>
              <pre className="overflow-x-auto rounded bg-black/30 p-2 text-xs">
                {`INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), u.raw_user_meta_data->>'avatar_url', 'client'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;`}
              </pre>
              <p className="text-amber-200/90">
                Then:{' '}
                <code className="rounded bg-black/20 px-1">
                  UPDATE public.profiles SET role = &apos;admin&apos; WHERE id = &apos;{user.id}
                  &apos;;
                </code>
              </p>
              {profileError && (
                <p className="text-xs text-amber-200/70">Fetch error: {profileError}</p>
              )}
            </>
          ) : (
            <p>
              Your account does not have admin or trainer access. Update{' '}
              <code className="rounded bg-black/20 px-1">profiles.role</code> to{' '}
              <code className="rounded bg-black/20 px-1">admin</code> or{' '}
              <code className="rounded bg-black/20 px-1">trainer</code> in Supabase → Table Editor.
            </p>
          )}
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="rounded border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-medium hover:bg-amber-500/30 disabled:opacity-50"
          >
            {retrying ? 'Checking…' : 'Try again'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminLoginGate;
