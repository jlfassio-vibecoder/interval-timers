/**
 * Logout route for cross-origin logout propagation.
 * When Programs (different origin) signs out, it redirects here to clear AMRAP session.
 * Then redirects to AMRAP home.
 * After signOut we release the auth navigator.locks lock so the tab does not hold a stuck lock.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { releaseAuthLock } from '@/lib/release-auth-lock';

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await supabase.auth.signOut();
      if (cancelled) return;
      releaseAuthLock();
      setTimeout(() => {
        if (!cancelled) navigate('/', { replace: true });
      }, 50);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0500] text-white">
      <p className="font-mono text-sm text-white/60">Signing out…</p>
    </div>
  );
}
