/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { adminPaths } from '@/lib/admin/config';
import { supabase } from '@/lib/supabase/client';
import { setAuthCookie } from '@/lib/auth-cookie';

const AdminFooterButton: React.FC = () => {
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (isMounted) setUser(session?.user ?? null);
    };
    init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setUser(session?.user ?? null);
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAdminClick = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('showAuthModal'));
      }
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setAuthCookie(session);
        const cookieSet = document.cookie.includes('sb-access-token=');
        if (!cookieSet) {
          console.error('[AdminFooterButton] Cookie was not set after setAuthCookie call');
          alert('Failed to set authentication cookie. Please try again.');
          return;
        }
        window.location.assign(adminPaths.root);
      } else {
        alert('Session expired. Please sign in again.');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to authenticate. Please try again.';
      alert(`Authentication error: ${errorMessage}`);
      console.error('[AdminFooterButton] Failed to set auth cookie:', error);
    }
  };

  return (
    <button
      onClick={handleAdminClick}
      type="button"
      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-orange-light"
      title={user ? 'Admin Dashboard' : 'Sign in to access Admin Dashboard'}
    >
      <Settings className="h-5 w-5" />
      Admin
    </button>
  );
};

export default AdminFooterButton;
