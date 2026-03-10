/**
 * Logout route for cross-origin logout propagation.
 * When Programs (different origin) signs out, it redirects here to clear AMRAP session.
 * Then redirects to AMRAP home.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.signOut().finally(() => {
      navigate('/', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0500] text-white">
      <p className="font-mono text-sm text-white/60">Signing out…</p>
    </div>
  );
}
