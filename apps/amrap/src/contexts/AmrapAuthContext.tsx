import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AmrapProfile {
  amrap_trial_ends_at: string | null;
  purchased_index: number | null;
}

interface AmrapAuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AmrapProfile | null;
  hasFullAccess: boolean;
  loading: boolean;
}

const AmrapAuthContext = createContext<AmrapAuthContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components -- context + hooks in one file
export function useAmrapAuth() {
  const ctx = useContext(AmrapAuthContext);
  if (ctx === undefined) {
    throw new Error('useAmrapAuth must be used within AmrapAuthProvider');
  }
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hooks in one file
export function useAmrapPermissions() {
  const { hasFullAccess, loading } = useAmrapAuth();
  return { hasFullAccess, loading };
}

export function AmrapAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AmrapProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('trial_ends_at, amrap_trial_ends_at, purchased_index')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        setProfile({
          amrap_trial_ends_at: data.trial_ends_at ?? data.amrap_trial_ends_at ?? null,
          purchased_index: data.purchased_index ?? null,
        });
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Use only onAuthStateChange to avoid lock contention: getSession() and onAuthStateChange
  // both acquire the same navigator.locks auth-token lock; in production (or with StrictMode
  // double-mount) that can cause "Lock was stolen by another request" and break the app when
  // logged in. onAuthStateChange emits INITIAL_SESSION with the current session on subscribe.
  // Do NOT await fetchProfile inside the callback—Supabase holds locks during the callback;
  // awaiting nested Supabase calls can deadlock. Defer profile fetch outside the critical path.
  useEffect(() => {
    let mounted = true;

    // Safety: never hang indefinitely if fetchProfile stalls (e.g. profiles RLS, network).
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const userId = s.user.id;
        queueMicrotask(() => {
          void fetchProfile(userId);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const hasFullAccess = useMemo(() => {
    if (!profile) return false;
    if (profile.purchased_index != null) return true;
    if (profile.amrap_trial_ends_at) {
      return new Date(profile.amrap_trial_ends_at) > new Date();
    }
    return false;
  }, [profile]);

  const value: AmrapAuthContextValue = useMemo(
    () => ({ user, session, profile, hasFullAccess, loading }),
    [user, session, profile, hasFullAccess, loading]
  );

  return (
    <AmrapAuthContext.Provider value={value}>
      {children}
    </AmrapAuthContext.Provider>
  );
}
