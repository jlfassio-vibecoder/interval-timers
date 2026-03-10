/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin login gate: shows "Admin Login" message, auto-opens AuthModal when
 * unauthenticated, and redirects to /admin after successful login.
 * Uses Supabase Auth (no useAppContext) to avoid SSR issues.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { adminPaths } from '@/lib/admin/config';
import { setAuthCookie } from '@/lib/auth-cookie';

const AdminLoginGate: React.FC = () => {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

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
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checkingAdmin) return;
    if (!user && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showAuthModal'));
    }
  }, [user, checkingAdmin]);

  useEffect(() => {
    if (!user) return;

    const goAdmin = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        setAuthCookie(session);
        window.location.href = adminPaths.root;
      }
    };
    goAdmin();
  }, [user]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold text-white md:text-3xl">Admin Login</h1>
      <p className="mt-2 text-white/80">Please sign in to continue.</p>
      {!user && (
        <p className="mt-4 text-sm text-white/60">
          The sign-in modal should open automatically. If it doesn&apos;t, try refreshing the page.
        </p>
      )}
    </div>
  );
};

export default AdminLoginGate;
